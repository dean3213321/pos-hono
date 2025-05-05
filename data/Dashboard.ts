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

export async function getItemsByCategoryData(c: Context) {
    try {
        const category = c.req.param('category');
        const items = await prisma.pos_items.findMany({
            where: { category },
            orderBy: { name: 'asc' }
        });

        return c.json({
            success: true,
            data: items,
            count: items.length
        });

    } catch (err) {
        console.error('Error fetching items by category:', err);
        return c.json({ 
            error: 'Failed to fetch items',
            details: process.env.NODE_ENV === 'development' ? (err as Error).message : null
        }, 500);
    }
}