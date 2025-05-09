import { Hono } from 'hono';
import { 
    createItemController,
    getAllItemsController,
    getItemsByCategoryController,
    updateItemController,
    deleteItemController,
} from './index.js';

const router = new Hono()
    .post('/api/item', createItemController)
    .get('/api/items', getAllItemsController)
    .get('/api/itemCategory', getItemsByCategoryController)
    .put('/api/items/:id', updateItemController)
    .delete('/api/items/:id', deleteItemController)

export default router 