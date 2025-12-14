/**
 * 请求日志统计组件
 * Request Log Stats Component
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Zap,
  Key,
} from 'lucide-react';
import type { LogStats } from '../hooks/use-request-logs';

interface RequestLogStatsProps {
  stats: LogStats | null;
  loading?: boolean;
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  description,
  variant = 'default',
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  variant?: 'default' | 'success' | 'error' | 'warning';
}) {
  const variantStyles = {
    default: 'text-primary',
    success: 'text-green-500',
    error: 'text-red-500',
    warning: 'text-yellow-500',
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${variantStyles[variant]}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function RequestLogStats({ stats, loading }: RequestLogStatsProps) {
  if (loading || !stats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
              <div className="h-4 w-4 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const successRate = stats.totalRequests > 0 
    ? ((stats.successRequests / stats.totalRequests) * 100).toFixed(1)
    : 0;

  const topPaths = Object.entries(stats.requestsByPath)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([path]) => path.split('/').pop() || path)
    .join(', ');

  const topApiKeys = Object.entries(stats.requestsByApiKey)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([key]) => key)
    .join(', ');

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="总请求数"
        value={stats.totalRequests.toLocaleString()}
        icon={Activity}
        description={topPaths ? `热门: ${topPaths}` : undefined}
      />
      <StatCard
        title="成功率"
        value={`${successRate}%`}
        icon={CheckCircle}
        variant="success"
        description={`${stats.successRequests} 成功 / ${stats.errorRequests} 失败`}
      />
      <StatCard
        title="平均响应时间"
        value={`${stats.avgDuration}ms`}
        icon={Clock}
        variant={stats.avgDuration > 2000 ? 'warning' : 'default'}
        description={stats.avgDuration > 2000 ? '响应较慢' : '响应正常'}
      />
      <StatCard
        title="Token 消耗"
        value={stats.totalTokens.toLocaleString()}
        icon={Zap}
        description={topApiKeys ? `主要: ${topApiKeys}` : undefined}
      />
    </div>
  );
}

export function RequestLogStatusBreakdown({ stats }: { stats: LogStats | null }) {
  if (!stats) return null;

  const statusGroups = Object.entries(stats.requestsByStatus).reduce((acc, [status, count]) => {
    const statusNum = parseInt(status);
    const group = Math.floor(statusNum / 100);
    const key = `${group}xx`;
    acc[key] = (acc[key] || 0) + count;
    return acc;
  }, {} as Record<string, number>);

  const total = stats.totalRequests || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">状态码分布</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Object.entries(statusGroups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([group, count]) => {
              const percentage = ((count / total) * 100).toFixed(1);
              const colors: Record<string, string> = {
                '2xx': 'bg-green-500',
                '3xx': 'bg-blue-500',
                '4xx': 'bg-yellow-500',
                '5xx': 'bg-red-500',
              };
              return (
                <div key={group} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{group}</span>
                    <span className="text-muted-foreground">{count} ({percentage}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colors[group] || 'bg-primary'} transition-all`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}

export function RequestLogApiKeyBreakdown({ stats }: { stats: LogStats | null }) {
  if (!stats || Object.keys(stats.requestsByApiKey).length === 0) return null;

  const sorted = Object.entries(stats.requestsByApiKey)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const total = stats.totalRequests || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Key className="h-4 w-4" />
          API Key 使用分布
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sorted.map(([key, count]) => {
            const percentage = ((count / total) * 100).toFixed(1);
            return (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium truncate max-w-[150px]">{key}</span>
                  <span className="text-muted-foreground">{count} ({percentage}%)</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
