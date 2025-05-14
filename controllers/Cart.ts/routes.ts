import { Hono } from 'hono';
import { 
    getWispayCreditByRfidController,
    processWispayPaymentController,
    addWispayCreditController,
} from './index.js';

const router = new Hono()
  .get('/api/wispay/credit', getWispayCreditByRfidController)
  .post('/api/wispay/payment', processWispayPaymentController)
  .post('/api/wispay/credit', addWispayCreditController);

export default router 