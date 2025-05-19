import { type  Context } from "hono"
import { 
    createItemData, 
    getAllItemsData,
    getItemsByCategoryData,
    updateItemData,
    deleteItemData,
    createOrderData,
    getOrdersData,
    updateOrderStatusData,
} from "../../data/Dashboard.js"


export function createItemController(c: Context) {
    return createItemData(c);
  }

export function getAllItemsController(c: Context) {
    return getAllItemsData(c);
  }

export function getItemsByCategoryController(c: Context) {
    return getItemsByCategoryData(c);
  }

export function updateItemController(c: Context) {
    return updateItemData(c);
  }

export function deleteItemController(c: Context) {
    return deleteItemData(c);
  }

export function createOrderController(c: Context) {
    return createOrderData(c);
  }

export function getOrdersController(c: Context) {
    return getOrdersData(c);
  }

export function updateOrderStatusController(c: Context) {
    return updateOrderStatusData(c);
  }