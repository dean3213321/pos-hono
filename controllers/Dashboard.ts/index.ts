import { type  Context } from "hono"
import { 
    createItemData, 
    getAllItemsData,
    getItemsByCategoryData
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
