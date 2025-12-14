/**
 * 服务器初始化
 * Server Initialization
 */

import { detectRuntimeMode, getRuntimeDescription } from './auth/runtime-mode';
import { createCredentialsManager, type CredentialsManager } from './auth/credentials';
import { createSessionManager, type SessionManager } from './auth/session';
import { createAuthMiddleware, type AuthMiddleware, type AuthMiddlewareConfig } from './auth/middleware';
import { createAuthRouter, type AuthRouter } from './auth/auth-router';
import { createGatewayKeyManager, type GatewayKeyManager } from './auth/gateway-keys';
import { createGatewayKeyRouter, type GatewayKeyRouter } from './auth/gateway-key-router';
import type { AuthConfig } from './auth/types';

export interface ServerInitConfig {
  /** 认证配置 */
  auth?: Partial<AuthConfig>;
  /** 凭据存储路径 */
  credentialsPath?: string;
  /** Gateway Keys 存储路径 */
  gatewayKeysPath?: string;
  /** 会话超时时间 */
  sessionTimeout?: number;
  /** 是否静默模式 */
  silent?: boolean;
}

export interface ServerInitResult {
  /** 运行时模式 */
  runtimeMode: 'electron' | 'node';
  /** 凭据管理器 */
  credentialsManager: CredentialsManager;
  /** 会话管理器 */
  sessionManager: SessionManager;
  /** Gateway Key 管理器 */
  gatewayKeyManager: GatewayKeyManager;
  /** 认证中间件 */
  authMiddleware: AuthMiddleware;
  /** 认证路由器 */
  authRouter: AuthRouter;
  /** Gateway Key 路由器 */
  gatewayKeyRouter: GatewayKeyRouter;
  /** 生成的 Admin 密码（仅首次启动） */
  generatedPassword?: string;
}

/**
 * 初始化服务器
 * 根据运行时模式配置认证
 */
export async function initServer(config: ServerInitConfig = {}): Promise<ServerInitResult> {
  const runtimeMode = detectRuntimeMode();
  const silent = config.silent ?? false;

  if (!silent) {
    console.log(`\n🔧 Initializing AI Server...`);
    console.log(`   Runtime: ${getRuntimeDescription()}`);
  }

  // 创建凭据管理器
  const credentialsManager = createCredentialsManager(config.credentialsPath);

  // 创建会话管理器
  const sessionManager = createSessionManager(config.sessionTimeout);
  sessionManager.startCleanup();

  // 创建 Gateway Key 管理器
  const gatewayKeyManager = createGatewayKeyManager(config.gatewayKeysPath);
  await gatewayKeyManager.load();

  let generatedPassword: string | undefined;

  // Node.js 模式：初始化 Admin 凭据
  if (runtimeMode === 'node') {
    const { credentials, generatedPassword: newPassword } = await credentialsManager.initialize();
    
    if (newPassword) {
      generatedPassword = newPassword;
      
      if (!silent) {
        console.log(`\n   ╔════════════════════════════════════════════════════════╗`);
        console.log(`   ║  🔐 Admin Credentials Generated (First Launch)         ║`);
        console.log(`   ╠════════════════════════════════════════════════════════╣`);
        console.log(`   ║  Username: admin                                       ║`);
        console.log(`   ║  Password: ${newPassword.padEnd(42)}  ║`);
        console.log(`   ╠════════════════════════════════════════════════════════╣`);
        console.log(`   ║  ⚠️  Save this password! It won't be shown again.      ║`);
        console.log(`   ║  You can change it via /internal/auth/change-password  ║`);
        console.log(`   ╚════════════════════════════════════════════════════════╝\n`);
      }
    } else {
      if (!silent) {
        console.log(`   Admin: ${credentials.username} (configured)`);
      }
    }

    // 显示 Gateway Keys 统计
    const keyStats = gatewayKeyManager.getStats();
    if (!silent && keyStats.total > 0) {
      console.log(`   Gateway Keys: ${keyStats.active} active, ${keyStats.total} total`);
    }
  } else {
    if (!silent) {
      console.log(`   Auth: Disabled (Electron mode - user is admin)`);
    }
  }

  // 创建认证中间件
  const authMiddlewareConfig: AuthMiddlewareConfig = {
    enabled: runtimeMode === 'node',
    gatewayApiKey: config.auth?.gatewayApiKey,
    sessionTimeout: config.sessionTimeout,
    credentialsManager,
    sessionManager,
    gatewayKeyManager,
  };

  const authMiddleware = createAuthMiddleware(authMiddlewareConfig);

  // 创建认证路由器
  const authRouter = createAuthRouter(authMiddleware);

  // 创建 Gateway Key 路由器
  const gatewayKeyRouter = createGatewayKeyRouter(gatewayKeyManager, authMiddleware);

  return {
    runtimeMode,
    credentialsManager,
    sessionManager,
    gatewayKeyManager,
    authMiddleware,
    authRouter,
    gatewayKeyRouter,
    generatedPassword,
  };
}

/**
 * 清理服务器资源
 */
export function cleanupServer(result: ServerInitResult): void {
  result.sessionManager.stopCleanup();
}
