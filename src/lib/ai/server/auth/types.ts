/**
 * 认证系统类型定义
 * Authentication System Types
 */

/** 运行时模式 */
export type RuntimeMode = 'electron' | 'node';

/** 用户角色 */
export type UserRole = 'admin' | 'anonymous';

/** 认证模式 */
export type AuthMode = 'gateway' | 'passthrough' | 'none';

/** 认证上下文 */
export interface AuthContext {
  /** 用户角色 */
  role: UserRole;
  /** 认证模式 */
  mode: AuthMode;
  /** 用户 ID（admin 或 anonymous） */
  userId: string;
  /** 是否已认证 */
  authenticated: boolean;
  /** Provider API Key（passthrough 模式） */
  providerApiKey?: string;
  /** 目标 Provider（passthrough 模式） */
  targetProvider?: string;
}

/** Admin 凭据 */
export interface AdminCredentials {
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
  updatedAt: number;
}

/** 认证配置 */
export interface AuthConfig {
  /** 是否启用认证（Node.js 模式默认启用） */
  enabled: boolean;
  /** Gateway API Key（外部访问） */
  gatewayApiKey?: string;
  /** 会话超时时间（毫秒） */
  sessionTimeout?: number;
  /** 凭据存储路径 */
  credentialsPath?: string;
}

/** 会话信息 */
export interface Session {
  id: string;
  userId: string;
  role: UserRole;
  createdAt: number;
  expiresAt: number;
}

/** 登录请求 */
export interface LoginRequest {
  username: string;
  password: string;
}

/** 登录响应 */
export interface LoginResponse {
  success: boolean;
  token?: string;
  expiresAt?: number;
  error?: string;
}

/** 修改密码请求 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
