import { type Context } from "hono";
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// api/admin/login
export async function loginAdminData(c: Context) {
  try {
    const { username, password } = await c.req.json();

    if (!username || !password) {
      return c.json({ error: 'Username and password are required' }, 400);
    }

    const admin = await prisma.pos_admin.findUnique({
      where: { username }
    });

    if (!admin) {
      return c.json({ error: 'Invalid username or password' }, 401);
    }

    const isValid = await bcrypt.compare(password, admin.password);

    if (!isValid) {
      return c.json({ error: 'Invalid username or password' }, 401);
    }

    // Success – you could issue a token or session here
    return c.json({
      success: true,
      message: 'Login successful',
      data: {
        id: admin.id,
        username: admin.username,
        created_at: admin.created_at
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    return c.json({ 
      error: 'Login failed',
      details: process.env.NODE_ENV === 'development' ? (err as Error).message : null
    }, 500);
  }
}

// api/admin/register
export async function registerAdminData(c: Context) {
  try {
    const { username, password } = await c.req.json()

    if (!username || !password) {
      return c.json({ error: 'Username and password are required' }, 400)
    }

    const existing = await prisma.pos_admin.findUnique({
      where: { username }
    })
    if (existing) {
      return c.json({ error: 'Username already taken' }, 409)
    }

    const saltRounds = 10
    const hashed = await bcrypt.hash(password, saltRounds)

    const newAdmin = await prisma.pos_admin.create({
      data: {
        username,
        password: hashed
      }
    })

    return c.json({
      success: true,
      message: 'Account created successfully',
      data: {
        id: newAdmin.id,
        username: newAdmin.username,
        created_at: newAdmin.created_at
      }
    }, 201)
  } catch (err) {
    console.error('Register error:', err)
    return c.json({
      error: 'Registration failed',
      details: process.env.NODE_ENV === 'development' ? (err as Error).message : null
    }, 500)
  }
}