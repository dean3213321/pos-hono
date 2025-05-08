import { type Context } from "hono";
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs/promises';

const prisma = new PrismaClient();

// Initialize uploads folder on server start
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
await fs.mkdir(uploadsDir, { recursive: true });

export async function createCategoryData(c: Context) {
    try {
        const formData = await c.req.formData();
        const name = formData.get('name');
        const photoFile = formData.get('photo');
        const photoUrl = formData.get('photo_url');

        if (!name || typeof name !== 'string') {
            return c.json({ error: 'Valid name is required' }, 400);
        }

        let photo_path = '';

        // Handle file upload
        if (photoFile instanceof File) {
            const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
            const maxSize = 5 * 1024 * 1024; // 5MB

            // Validate file type
            if (!allowedTypes.includes(photoFile.type)) {
                return c.json({ error: 'Only JPG, PNG, and WEBP images are allowed' }, 400);
            }

            // Validate file size
            if (photoFile.size > maxSize) {
                return c.json({ error: 'Image size must be less than 5MB' }, 400);
            }

            // Generate unique filename
            const fileExt = path.extname(photoFile.name);
            const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`;
            const filePath = path.join(uploadsDir, fileName);

            // Save file
            const buffer = await photoFile.arrayBuffer();
            await fs.writeFile(filePath, Buffer.from(buffer));

            photo_path = `/uploads/${fileName}`;
        } 
        // Handle URL case
        else if (photoUrl && typeof photoUrl === 'string') {
            photo_path = photoUrl;
        } else {
            return c.json({ error: 'Either a file or URL must be provided' }, 400);
        }

        // Create category in database
        const newCategory = await prisma.pos_category.create({
            data: {
                name,
                photo_path,
            },
        });

        return c.json({
            success: true,
            category: newCategory
        }, 201);

    } catch (err) {
        console.error('Error creating category:', err);
        return c.json({ 
            details: process.env.NODE_ENV === 'development' ? (err as Error).message : null
        }, 500);
    }
}

// fetch a single category by ID
export async function getSingleCategoryData(c: Context) {
    const categoryId = c.req.param('id'); // Assuming you're using route parameters like '/categories/:id'
    
    if (!categoryId || isNaN(Number(categoryId))) {
      return c.json({ error: 'Valid category ID is required' }, 400);
    }
  
    try {
      const category = await prisma.pos_category.findUnique({
        where: {
          id: Number(categoryId)
        }
      });
  
      if (!category) {
        return c.json({ error: 'Category not found' }, 404);
      }
  
      return c.json(category, 200);
    } catch (err) {
      console.error('Error fetching category:', err);
      return c.json({ error: 'Failed to fetch category' }, 500);
    }
  }

export async function getCategoryData(c: Context) {
    try {
      // Get all categories
      const categories = await prisma.pos_category.findMany({
        select: {
          id: true,
          name: true,
          photo_path: true,
          created_at: true,
          updated_at: true
        },
        orderBy: {
          created_at: 'desc' // Optional: order by creation date (newest first)
        }
      });
  
      return c.json(categories, 200);
    } catch (err) {
      console.error('Error fetching categories:', err);
      return c.json({ error: 'Failed to fetch categories' }, 500);
    }
}

// Update a category
export async function updateCategoryData(c: Context) {
    const categoryId = c.req.param('id');
  
    if (!categoryId || isNaN(Number(categoryId))) {
      return c.json({ error: 'Valid category ID is required' }, 400);
    }
  
    try {
      const formData = await c.req.formData();
      const name = formData.get('name');
      const photoFile = formData.get('photo');
      const photoUrl = formData.get('photo_url');
      const removePhoto = formData.get('remove_photo') === 'true';
  
      if (!name && !photoFile && !photoUrl && !removePhoto) {
        return c.json({ error: 'At least one field must be provided for update' }, 400);
      }
  
      const currentCategory = await prisma.pos_category.findUnique({
        where: { id: Number(categoryId) }
      });
  
      if (!currentCategory) {
        return c.json({ error: 'Category not found' }, 404);
      }
  
      let photo_path: string | null = currentCategory.photo_path;
  
      // Handle photo upload (only if a real file was selected)
      if (photoFile instanceof File && photoFile.size > 0) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        const maxSize = 5 * 1024 * 1024; // 5MB
  
        if (!allowedTypes.includes(photoFile.type)) {
          return c.json({ error: 'Only JPG, PNG, and WEBP images are allowed' }, 400);
        }
        if (photoFile.size > maxSize) {
          return c.json({ error: 'Image size must be less than 5MB' }, 400);
        }
  
        // Delete old uploaded file if it exists
        if (photo_path && photo_path.startsWith('/uploads/')) {
          try {
            await fs.unlink(path.join(process.cwd(), 'public', photo_path));
          } catch (err) {
            console.error('Error deleting old file:', err);
          }
        }
  
        // Write new file
        const fileExt = path.extname(photoFile.name);
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`;
        const filePath = path.join(uploadsDir, fileName);
        const buffer = await photoFile.arrayBuffer();
        await fs.writeFile(filePath, Buffer.from(buffer));
  
        photo_path = `/uploads/${fileName}`;
      }
      // Handle external URL
      else if (photoUrl && typeof photoUrl === 'string') {
        if (photo_path && photo_path.startsWith('/uploads/')) {
          try {
            await fs.unlink(path.join(process.cwd(), 'public', photo_path));
          } catch (err) {
            console.error('Error deleting old file:', err);
          }
        }
        photo_path = photoUrl;
      }
      // Handle image removal
      else if (removePhoto) {
        if (photo_path && photo_path.startsWith('/uploads/')) {
          try {
            await fs.unlink(path.join(process.cwd(), 'public', photo_path));
          } catch (err) {
            console.error('Error deleting old file:', err);
          }
        }
        photo_path = null;
      }
  
      // Update category
      const updatedCategory = await prisma.pos_category.update({
        where: { id: Number(categoryId) },
        data: {
          name: typeof name === 'string' ? name : undefined,
          photo_path: photo_path ?? undefined,
          updated_at: new Date()
        }
      });
  
      return c.json({
        success: true,
        category: updatedCategory
      });
  
    } catch (err) {
      console.error('Error updating category:', err);
      return c.json({
        error: 'Failed to update category',
        details: process.env.NODE_ENV === 'development' ? (err as Error).message : null
      }, 500);
    }
  }

// Delete a category
export async function deleteCategoryData(c: Context) {
    const categoryId = c.req.param('id');
    
    if (!categoryId || isNaN(Number(categoryId))) {
        return c.json({ error: 'Valid category ID is required' }, 400);
    }
  
    try {
        // First check if category exists
        const category = await prisma.pos_category.findUnique({
            where: { id: Number(categoryId) }
        });
  
        if (!category) {
            return c.json({ error: 'Category not found' }, 404);
        }
  
        // Check if category has associated items
        const itemsCount = await prisma.pos_items.count({
            where: { category: category.name }
        });
  
        if (itemsCount > 0) {
            return c.json({ 
                error: 'Cannot delete category with associated items',
                items_count: itemsCount
            }, 400);
        }
  
        // Delete photo file if it exists
        let photoDeleted = false;
        if (category.photo_path && category.photo_path.startsWith('/uploads/')) {
            try {
                await fs.unlink(path.join(process.cwd(), 'public', category.photo_path));
                photoDeleted = true;
            } catch (err) {
                console.error('Error deleting category photo:', err);
                // Continue with deletion even if photo deletion fails
            }
        }
  
        // Delete category from database
        await prisma.pos_category.delete({
            where: { id: Number(categoryId) }
        });
  
        return c.json({
            success: true,
            message: 'Category deleted successfully',
            photo_deleted: photoDeleted
        });
  
    } catch (err) {
        console.error('Error deleting category:', err);
        return c.json({ 
            error: 'Failed to delete category',
            details: process.env.NODE_ENV === 'development' ? (err as Error).message : null
        }, 500);
    }
  }