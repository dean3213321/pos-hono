import { Hono } from 'hono';
import { 
    createItemController,
    getAllItemsController,
    getItemsByCategoryController 
} from './index.js';

const router = new Hono()
    .post('/api/item', createItemController)
    .get('/api/items', getAllItemsController)
    .get('/api/itemCategory', getItemsByCategoryController);

export default router 