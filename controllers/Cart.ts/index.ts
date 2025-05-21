import { type  Context } from "hono"
import { 
    getWispayCreditByRfidData,
    processWispayPaymentData,
    addWispayCreditData,
    getUsersData,
    getUsersBalancesData,
} from "../../data/Cart.js"

export function getWispayCreditByRfidController(c: Context) {
    return getWispayCreditByRfidData(c);
  }

export function processWispayPaymentController(c: Context) {
    return processWispayPaymentData(c);
  }

export function addWispayCreditController(c: Context) {
    return addWispayCreditData(c);
  }

export function getUsersController(c: Context) {
    return getUsersData(c);
  }

export function getUsersBalancesController(c: Context) {
    return getUsersBalancesData(c);
  }
