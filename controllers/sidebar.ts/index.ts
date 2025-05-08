import { type  Context } from "hono"
import { 
    createCategoryData,
    getCategoryData, 
    getSingleCategoryData,
    updateCategoryData,
    deleteCategoryData
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

  export function updateCategoryController(c: Context) {
    return updateCategoryData(c);
  }

export function deleteCategoryController(c: Context) {
    return deleteCategoryData(c);
  }