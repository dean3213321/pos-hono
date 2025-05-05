import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/serve-static';
import path from 'path';
import fs from 'fs/promises';
import { routes } from "../controllers/routes.js";

const app = new Hono();
const prisma = new PrismaClient();

// Initialize uploads directory
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
await fs.mkdir(uploadsDir, { recursive: true });

// Add CORS middleware to allow requests from the frontend
app.use('/api/*', cors());

// Custom static file serving middleware
app.use('/uploads/*', async (c, next) => {
  const filePath = c.req.path.replace('/uploads/', '');
  const fullPath = path.join(uploadsDir, filePath);

  try {
    const file = await fs.readFile(fullPath);
    const ext = path.extname(filePath).slice(1);
    return new Response(file, {
      headers: {
        'Content-Type': getContentType(ext),
        'Cache-Control': 'public, max-age=604800' // 1 week cache
      }
    });
  } catch (err) {
    return c.notFound();
  }
});

// Helper function to get content type
function getContentType(ext: string): string {
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml'
  };
  return types[ext.toLowerCase()] || 'application/octet-stream';
}

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Check database connection
prisma.$connect()
  .then(() => {
    console.log('Connected to the database successfully!');
  })
  .catch((error) => {
    console.error('Failed to connect to the database:', error);
  });

/* Routes */
routes.forEach((route) => {
  app.route("/", route);
});

// Error handling middleware
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : null
  }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Endpoint not found' }, 404);
});

// Start the server on port 3000
serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
  console.log(`Uploads directory: ${uploadsDir}`);
});