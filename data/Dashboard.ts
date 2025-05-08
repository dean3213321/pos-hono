import { type Context } from "hono";
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs/promises';

const prisma = new PrismaClient();
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
await fs.mkdir(uploadsDir, { recursive: true });


export async function createItemData(c: Context) {
    try {
        const formData = await c.req.formData();
        const name = formData.get('name');
        const photoFile = formData.get('photo');
        const photoUrl = formData.get('photo_url');
        const category = formData.get('category');
        const price = formData.get('price');

        // Validate required fields
        if (!name || typeof name !== 'string') {
            return c.json({ error: 'Valid name is required' }, 400);
        }

        if (!price || isNaN(Number(price))) {
            return c.json({ error: 'Valid price is required' }, 400);
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
        }
        // Photo is optional in the schema, so we don't return an error if neither is provided
             
        // Create item in database
        const newItem = await prisma.pos_items.create({
            data: {
                name,
                photo_path: photo_path || null,
                category: typeof category === 'string' ? category : null,
                price: Number(price),
            },
        });

        return c.json({
            success: true,
            item: newItem
        }, 201);

    } catch (err) {
        console.error('Error creating item:', err);
        return c.json({ 
            error: 'Failed to create item',
            details: process.env.NODE_ENV === 'development' ? (err as Error).message : null
        }, 500);
    }
}

export async function getItemsByCategoryData(c: Context) {
    try {
        // Get the category from query parameters
        const category = c.req.query('category');
        
        // If a specific category is requested (e.g., "Drinks")
        if (category) {
            const items = await prisma.pos_items.findMany({
                where: {
                    category: category,
                },
                orderBy: { name: 'asc' },
            });
            
            return c.json({
                success: true,
                data: items,
                count: items.length,
            });
        }
        
        // If no category is provided, return all distinct categories
        const categories = await prisma.pos_items.findMany({
            distinct: ['category'],
            select: {
                category: true
            },
            orderBy: { category: 'asc' },
        });
        
        return c.json({
            success: true,
            categories: categories.map(c => c.category).filter(Boolean),
        });
        
    } catch (err) {
        console.error('Error fetching items by category:', err);
        return c.json({ 
            error: 'Failed to fetch items by category',
            details: process.env.NODE_ENV === 'development' ? (err as Error).message : null
        }, 500);
    }
}

export async function getAllItemsData(c: Context) {
    try {
        const { category, min_price, max_price, search } = c.req.query();

        // Build the where clause dynamically based on query parameters
        const where: any = {};

        if (category) where.category = category;
        if (search) where.name = { contains: search, mode: 'insensitive' };
        if (min_price || max_price) {
            where.price = {};
            if (min_price) where.price.gte = Number(min_price);
            if (max_price) where.price.lte = Number(max_price);
        }

        const items = await prisma.pos_items.findMany({
            where,
            orderBy: { name: 'asc' }, // Default sorting by name
        });

        return c.json({
            success: true,
            data: items,
            count: items.length
        });

    } catch (err) {
        console.error('Error fetching items:', err);
        return c.json({ 
            error: 'Failed to fetch items',
            details: process.env.NODE_ENV === 'development' ? (err as Error).message : null
        }, 500);
    }
}

export async function updateItemData(c: Context) {
    try {
      const itemId = c.req.param('id')
      const formData = await c.req.formData()
      const name = formData.get('name')
      const photoFile = formData.get('photo')
      const photoUrl = formData.get('photo_url')
      const category = formData.get('category')
      const price = formData.get('price')
  
      // Validate required fields
      if (!name || typeof name !== 'string') {
        return c.json({ error: 'Valid name is required' }, 400)
      }
      if (!price || isNaN(Number(price))) {
        return c.json({ error: 'Valid price is required' }, 400)
      }
  
      // Fetch existing
      const existingItem = await prisma.pos_items.findUnique({
        where: { id: Number(itemId) }
      })
      if (!existingItem) {
        return c.json({ error: 'Item not found' }, 404)
      }
  
      let photo_path = existingItem.photo_path
  
      //
      // —— NEW UPLOAD CHECK —— 
      // Only treat as a new upload when the File object actually has size > 0
      //
      if (photoFile instanceof File && photoFile.size > 0) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
        const maxSize = 5 * 1024 * 1024
        if (!allowedTypes.includes(photoFile.type)) {
          return c.json({ error: 'Only JPG, PNG, and WEBP images are allowed' }, 400)
        }
        if (photoFile.size > maxSize) {
          return c.json({ error: 'Image size must be less than 5MB' }, 400)
        }
  
        // Save new file
        const fileExt = path.extname(photoFile.name)
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`
        const filePath = path.join(uploadsDir, fileName)
        const buffer = await photoFile.arrayBuffer()
        await fs.writeFile(filePath, Buffer.from(buffer))
  
        // Delete old upload if it wasn’t a URL
        if (photo_path && !photo_path.startsWith('http')) {
          const old = path.join(uploadsDir, path.basename(photo_path))
          fs.unlink(old).catch(() => {/* ignore */})
        }
  
        photo_path = `/uploads/${fileName}`
      }
      // If user provided a direct URL override
      else if (photoUrl && typeof photoUrl === 'string') {
        if (photo_path && !photo_path.startsWith('http')) {
          const old = path.join(uploadsDir, path.basename(photo_path))
          fs.unlink(old).catch(() => {/* ignore */})
        }
        photo_path = photoUrl
      }
      // else: no new file, no URL → keep existing photo_path
  
      // Persist update
      const updatedItem = await prisma.pos_items.update({
        where: { id: Number(itemId) },
        data: {
          name,
          photo_path: photo_path || null,
          category: typeof category === 'string' ? category : null,
          price: Number(price),
        },
      })
  
      return c.json({ success: true, item: updatedItem })
  
    } catch (err) {
      console.error('Error updating item:', err)
      return c.json({
        error: 'Failed to update item',
        details: process.env.NODE_ENV === 'development' ? (err as Error).message : null
      }, 500)
    }
  }

export async function deleteItemData(c: Context) {
    try {
        const itemId = c.req.param('id');

        // Check if item exists
        const existingItem = await prisma.pos_items.findUnique({
            where: { id: Number(itemId) }
        });

        if (!existingItem) {
            return c.json({ error: 'Item not found' }, 404);
        }

        // Delete associated photo file if it exists and is not a URL
        if (existingItem.photo_path && !existingItem.photo_path.startsWith('http')) {
            const filePath = path.join(uploadsDir, path.basename(existingItem.photo_path));
            try {
                await fs.unlink(filePath);
            } catch (err) {
                console.warn('Failed to delete associated image:', err);
            }
        }

        // Delete item from database
        await prisma.pos_items.delete({
            where: { id: Number(itemId) }
        });

        return c.json({
            success: true,
            message: 'Item deleted successfully'
        });

    } catch (err) {
        console.error('Error deleting item:', err);
        return c.json({ 
            error: 'Failed to delete item',
            details: process.env.NODE_ENV === 'development' ? (err as Error).message : null
        }, 500);
    }
}