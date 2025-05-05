import sidebarRouter from './sidebar.ts/routes.js'

export const routes = [sidebarRouter] as const

export type AppRoutes = typeof routes[number];