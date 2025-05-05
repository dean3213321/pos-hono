import { type  Context } from "hono"
import { 
    createCategoryData,
    getCategoryData, 
    getSingleCategoryData
  } from "../../data/sidebar.js"



export function createCategoryController(c: Context) {
    return createCategoryData(c);
  }

export function getCategoryController(c: Context) {
    return getCategoryData(c);
  }

export function getSingleCategoryController(c: Context) {
    return getSingleCategoryData(c);
  }

