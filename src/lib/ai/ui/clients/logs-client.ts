/**
 * 请求日志 API 客户端
 * Request Logs API Client
 */

import { getApiBaseUrl, getAuthToken } from './base-client';

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/** 请求日志条目 */
export interface RequestLogEntry {
  id: string;
  timestamp: number;
  method: string;
  path: string;
  status: number;
  duration: number;
  clientIp?: string;
  userAgent?: string;
  apiKeyId?: string;
  apiKeyName?: string;
  requestSize?: number;
  responseSize?: number;
  error?: string;
  model?: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  metadata?: Record<string, unknown>;
}

/** 日志过滤条件 */
export interface LogFilter {
  startTime?: number;
  endTime?: number;
  path?: string;
  method?: string;
  status?: number;
  minStatus?: number;
  maxStatus?: number;
  apiKeyId?: string;
  hasError?: boolean;
  limit?: number;
  offset?: number;
}

/** 日志统计 */
export interface LogStats {
  totalRequests: number;
  successRequests: number;
  errorRequests: number;
  avgDuration: number;
  totalTokens: number;
  requestsByPath: Record<string, number>;
  requestsByStatus: Record<number, number>;
  requestsByApiKey: Record<string, number>;
}

/**
 * 获取请求日志
 */
export async function getLogs(filter?: LogFilter): Promise<RequestLogEntry[]> {
  try {
    const baseUrl = getApiBaseUrl();
    const params = new URLSearchParams();
    
    if (filter) {
      if (filter.startTime) params.set('startTime', String(filter.startTime));
      if (filter.endTime) params.set('endTime', String(filter.endTime));
      if (filter.path) params.set('path', filter.path);
      if (filter.method) params.set('method', filter.method);
      if (filter.status !== undefined) params.set('status', String(filter.status));
      if (filter.minStatus !== undefined) params.set('minStatus', String(filter.minStatus));
      if (filter.maxStatus !== undefined) params.set('maxStatus', String(filter.maxStatus));
      if (filter.apiKeyId) params.set('apiKeyId', filter.apiKeyId);
      if (filter.hasError !== undefined) params.set('hasError', String(filter.hasError));
      if (filter.limit !== undefined) params.set('limit', String(filter.limit));
      if (filter.offset !== undefined) params.set('offset', String(filter.offset));
    }

    const queryString = params.toString();
    const url = `${baseUrl}/api/logs${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch logs: ${response.statusText}`);
    }

    const data = await response.json();
    return data.logs || [];
  } catch (error) {
    console.error('Failed to fetch logs:', error);
    return [];
  }
}

/**
 * 获取日志统计
 */
export async function getLogStats(filter?: Pick<LogFilter, 'startTime' | 'endTime' | 'apiKeyId'>): Promise<LogStats> {
  try {
    const baseUrl = getApiBaseUrl();
    const params = new URLSearchParams();
    
    if (filter) {
      if (filter.startTime) params.set('startTime', String(filter.startTime));
      if (filter.endTime) params.set('endTime', String(filter.endTime));
      if (filter.apiKeyId) params.set('apiKeyId', filter.apiKeyId);
    }

    const queryString = params.toString();
    const url = `${baseUrl}/api/logs/stats${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch log stats: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch log stats:', error);
    return {
      totalRequests: 0,
      successRequests: 0,
      errorRequests: 0,
      avgDuration: 0,
      totalTokens: 0,
      requestsByPath: {},
      requestsByStatus: {},
      requestsByApiKey: {},
    };
  }
}

/**
 * 清除日志
 */
export async function clearLogs(filter?: Pick<LogFilter, 'startTime' | 'endTime'>): Promise<{ cleared: number }> {
  try {
    const baseUrl = getApiBaseUrl();
    
    const response = await fetch(`${baseUrl}/api/logs/clear`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filter || {}),
    });

    if (!response.ok) {
      throw new Error(`Failed to clear logs: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to clear logs:', error);
    return { cleared: 0 };
  }
}
