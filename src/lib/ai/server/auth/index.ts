/**
 * 认证模块导出
 * Authentication Module Exports
 */

export * from './types';
export * from './runtime-mode';
export * from './credentials';
export * from './session';
export { 
  AuthMiddleware, 
  ROUTE_PERMISSIONS, 
  checkRoutePermission, 
  createAuthMiddleware 
} from './middleware';
export type { AuthMiddlewareConfig, RoutePermission, ExtendedAuthContext } from './middleware';
export { AuthRouter, createAuthRouter } from './auth-router';
export type { AuthRouterConfig } from './auth-router';
export type { HttpRequest, HttpResponse } from './auth-router';

// Gateway API Key 管理
export * from './gateway-keys';
export { GatewayKeyRouter, createGatewayKeyRouter } from './gateway-key-router';
export type { GatewayKeyRouterConfig } from './gateway-key-router';
