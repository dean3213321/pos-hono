import { type  Context } from "hono"
import { 
    loginAdminData,
    registerAdminData,
} from "../../data/Login.js"


export function loginAdminController(c: Context) {
    return loginAdminData(c);
  }

  export function registerAdminController(c: Context) {
    return registerAdminData(c);
  }