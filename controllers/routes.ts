import sidebarRouter from './sidebar.ts/routes.js'
import dashboardRouter from './Dashboard.ts/routes.js'

export const routes = [sidebarRouter, dashboardRouter] as const

export type AppRoutes = typeof routes[number];