 import { Hono } from 'hono';
 import { 
     loginAdminController,
     registerAdminController,
 } from './index.js';
 
 const router = new Hono()
     .post('/api/admin/login', loginAdminController)
     .post('/api/admin/register', registerAdminController)
 
 export default router 
 
 
 