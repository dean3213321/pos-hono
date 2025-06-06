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
        const quantity = formData.get('quantity') || 0; // Default to 0 if not provided

        // Validate required fields
        if (!name || typeof name !== 'string') {
            return c.json({ error: 'Valid name is required' }, 400);
        }

        if (!price || isNaN(Number(price))) {
            return c.json({ error: 'Valid price is required' }, 400);
        }

        if (isNaN(Number(quantity))) {
            return c.json({ error: 'Quantity must be a number' }, 400);
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

            // Generate filename with timestamp prefix to ensure uniqueness
            const originalName = photoFile.name;
            const fileName = `${originalName}`;
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
                quantity: Number(quantity),
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
    const { category, min_price, max_price, search, min_quantity, max_quantity } = c.req.query();

    const where: any = {};

    if (category) where.category = category;
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (min_price || max_price) {
      where.price = {};
      if (min_price) where.price.gte = Number(min_price);
      if (max_price) where.price.lte = Number(max_price);
    }
    if (min_quantity || max_quantity) {
      where.quantity = {};
      if (min_quantity) where.quantity.gte = Number(min_quantity);
      if (max_quantity) where.quantity.lte = Number(max_quantity);
    }

    const items = await prisma.pos_items.findMany({
      where,
      orderBy: { name: 'asc' },
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

export async function updateItemData(c: Context) {
    try {
        const itemId = c.req.param('id');
        const formData = await c.req.formData();
        const name = formData.get('name');
        const photoFile = formData.get('photo');
        const photoUrl = formData.get('photo_url');
        const category = formData.get('category');
        const priceRaw = formData.get('price');
        const quantityRaw = formData.get('quantity');

        // Validate required fields
        if (!name || typeof name !== 'string') {
            return c.json({ error: 'Valid name is required' }, 400);
        }
        if (!priceRaw || isNaN(Number(priceRaw))) {
            return c.json({ error: 'Valid price is required' }, 400);
        }
        if (quantityRaw === null || isNaN(Number(quantityRaw))) {
            return c.json({ error: 'Valid quantity is required' }, 400);
        }
        const price = Number(priceRaw);
        const quantity = Number(quantityRaw);

        // Fetch existing
        const existingItem = await prisma.pos_items.findUnique({
            where: { id: Number(itemId) }
        });
        if (!existingItem) {
            return c.json({ error: 'Item not found' }, 404);
        }

        let photo_path = existingItem.photo_path;

        // —— NEW UPLOAD CHECK ——
        if (photoFile instanceof File && photoFile.size > 0) {
            const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
            const maxSize = 5 * 1024 * 1024;
            if (!allowedTypes.includes(photoFile.type)) {
                return c.json({ error: 'Only JPG, PNG, and WEBP images are allowed' }, 400);
            }
            if (photoFile.size > maxSize) {
                return c.json({ error: 'Image size must be less than 5MB' }, 400);
            }

            // Save new file with timestamp-prefixed original name
            const originalName = photoFile.name;
            const fileName = `${originalName}`;
            const filePath = path.join(uploadsDir, fileName);
            const buffer = await photoFile.arrayBuffer();
            await fs.writeFile(filePath, Buffer.from(buffer));

            // Delete old file if it exists and is a local file
            if (photo_path && !photo_path.startsWith('http')) {
                const old = path.join(uploadsDir, path.basename(photo_path));
                fs.unlink(old).catch(() => {/* ignore */});
            }
            photo_path = `/uploads/${fileName}`;
        }
        else if (photoUrl && typeof photoUrl === 'string') {
            // Handle URL case (existing behavior remains the same)
            if (photo_path && !photo_path.startsWith('http')) {
                const old = path.join(uploadsDir, path.basename(photo_path));
                fs.unlink(old).catch(() => {/* ignore */});
            }
            photo_path = photoUrl;
        }

        // Rest of your update logic...
        const updatedItem = await prisma.pos_items.update({
            where: { id: Number(itemId) },
            data: {
                name,
                photo_path,
                category: category ? String(category) : null,
                price,
                quantity
            }
        });

        return c.json(updatedItem);
    } catch (error) {
        console.error('Error updating item:', error);
        return c.json({ error: 'Internal server error' }, 500);
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

export async function createOrderData(c: Context) {
  try {
    const { items, paymentType, rfid, total } = await c.req.json<{
      items: { id: number; quantity: number; price: number; name: string }[]
      paymentType: 'Cash' | 'Wispay'
      rfid?: string
      total: number
    }>();

    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ success: false, error: 'No items to order' }, 400);
    }

    // Generate order number (e.g., ORD-YYYYMMDD-XXXXX)
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const orderNumber = `WIS-${dateStr}-${randomNum}`;

    // Create the order with items
    const order = await prisma.pos_Order.create({
      data: {
        orderNumber,
        status: 'Preparing',
        paymentType,
        rfid,
        total,
        items: {
          create: items.map(item => ({
            itemId: item.id,
            quantity: item.quantity,
            price: item.price,
            name: item.name
          }))
        }
      },
      include: {
        items: true
      }
    });

    // Update inventory
    const ops = items.map(item =>
      prisma.pos_items.update({
        where: { id: item.id },
        data: {
          quantity: {
            decrement: item.quantity,
          },
        },
      })
    );

    await prisma.$transaction(ops);

    return c.json({ 
      success: true, 
      orderNumber: order.orderNumber 
    });
  } catch (err) {
    console.error('Error creating order:', err);
    return c.json(
      { success: false, error: 'Failed to create order' },
      500
    );
  }
}

export async function getOrdersData(c: Context) {
  const orders = await prisma.pos_Order.findMany({
    orderBy: { createdAt: 'desc' },
    include: { items: true }
  });
  return c.json(orders);
}

export async function updateOrderStatusData(c: Context) {
  const orderNumber = c.req.param('orderNumber');
  const { status } = await c.req.json<{ status: string }>();

  const validStatuses = ['Preparing', 'Serving', 'Completed', 'Cancelled'];
  if (!validStatuses.includes(status)) {
    return c.json({ error: 'Invalid status' }, 400);
  }

  const order = await prisma.pos_Order.update({
    where: { orderNumber },
    data: { status: status as any } // Replace 'any' with 'OrderStatus' if you have the enum imported
  });

  return c.json(order);
}