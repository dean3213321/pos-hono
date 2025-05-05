import { Hono } from 'hono';
import { 
    createCategoryController,
    getCategoryController,
    getSingleCategoryController 
} from './index.js';

const router = new Hono()
    .post('/api/categories', createCategoryController)
    .get('/api/categories', getCategoryController)
    .get('/api/categories/:id', getSingleCategoryController);

export default router 