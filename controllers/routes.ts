import sidebarRouter from './sidebar.ts/routes.js'
import dashboardRouter from './Dashboard.ts/routes.js'
import cartRouter from './Cart.ts/routes.js'
import loginRouter from './Login.ts/routes.js'

export const routes = [sidebarRouter, dashboardRouter, cartRouter, loginRouter] as const

export type AppRoutes = typeof routes[number];