import { Hono } from 'hono';
import { 
    createCategoryController,
    getCategoryController,
    getSingleCategoryController,
    updateCategoryController,
    deleteCategoryController
} from './index.js';

const router = new Hono()
    .post('/api/categories', createCategoryController)
    .get('/api/categories', getCategoryController)
    .get('/api/categories/:id', getSingleCategoryController)
    .put('/api/categories/:id', updateCategoryController)
    .delete('/api/categories/:id', deleteCategoryController);

export default router 