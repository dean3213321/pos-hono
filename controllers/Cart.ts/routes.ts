import { Hono } from 'hono';
import { 
    getWispayCreditByRfidController,
    processWispayPaymentController,
    addWispayCreditController,
    getUsersController,
    getUsersBalancesController,
} from './index.js';

const router = new Hono()
  .get('/api/wispay/credit', getWispayCreditByRfidController)
  .post('/api/wispay/payment', processWispayPaymentController)
  .post('/api/wispay/credit', addWispayCreditController)
  .get('/api/wispay/user', getUsersController)
  .get('/api/wispay/user/balances', getUsersBalancesController);

export default router 