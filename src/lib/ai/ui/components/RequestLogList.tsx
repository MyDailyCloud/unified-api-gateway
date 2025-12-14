/**
 * 请求日志列表组件
 * Request Log List Component
 */

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Key, 
  Zap,
  AlertTriangle,
} from 'lucide-react';
import type { RequestLogEntry } from '../hooks/use-request-logs';

interface RequestLogListProps {
  logs: RequestLogEntry[];
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-green-600 dark:text-green-400';
  if (status >= 300 && status < 400) return 'text-blue-600 dark:text-blue-400';
  if (status >= 400 && status < 500) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function getStatusBadgeVariant(status: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status >= 200 && status < 300) return 'default';
  if (status >= 400 && status < 500) return 'secondary';
  if (status >= 500) return 'destructive';
  return 'outline';
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function RequestLogList({ 
  logs, 
  loading, 
  onLoadMore, 
  hasMore 
}: RequestLogListProps) {
  if (logs.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Clock className="h-12 w-12 mb-4 opacity-50" />
        <p>暂无请求日志</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[600px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">时间</TableHead>
            <TableHead className="w-[80px]">方法</TableHead>
            <TableHead>路径</TableHead>
            <TableHead className="w-[80px]">状态</TableHead>
            <TableHead className="w-[100px]">耗时</TableHead>
            <TableHead className="w-[120px]">API Key</TableHead>
            <TableHead className="w-[100px]">Token</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id} className="group">
              <TableCell className="font-mono text-xs text-muted-foreground">
                <Tooltip>
                  <TooltipTrigger>
                    {formatDistanceToNow(log.timestamp, { 
                      addSuffix: true, 
                      locale: zhCN 
                    })}
                  </TooltipTrigger>
                  <TooltipContent>
                    {new Date(log.timestamp).toLocaleString('zh-CN')}
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-mono text-xs">
                  {log.method}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-sm max-w-[200px] truncate">
                <Tooltip>
                  <TooltipTrigger className="text-left truncate block">
                    {log.path}
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1">
                      <p>{log.path}</p>
                      {log.model && <p className="text-xs">模型: {log.model}</p>}
                      {log.requestSize && <p className="text-xs">请求: {formatBytes(log.requestSize)}</p>}
                      {log.responseSize && <p className="text-xs">响应: {formatBytes(log.responseSize)}</p>}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {log.status >= 200 && log.status < 400 ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : log.status >= 400 && log.status < 500 ? (
                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                  <Badge variant={getStatusBadgeVariant(log.status)} className="font-mono text-xs">
                    {log.status}
                  </Badge>
                </div>
                {log.error && (
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="text-xs text-destructive truncate block max-w-[80px]">
                        {log.error}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {log.error}
                    </TooltipContent>
                  </Tooltip>
                )}
              </TableCell>
              <TableCell>
                <div className={`flex items-center gap-1 font-mono text-xs ${
                  log.duration > 5000 ? 'text-red-500' : 
                  log.duration > 2000 ? 'text-yellow-500' : 
                  'text-muted-foreground'
                }`}>
                  <Zap className="h-3 w-3" />
                  {formatDuration(log.duration)}
                </div>
              </TableCell>
              <TableCell>
                {log.apiKeyId ? (
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="flex items-center gap-1 text-xs">
                        <Key className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate max-w-[80px]">
                          {log.apiKeyName || log.apiKeyId}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>ID: {log.apiKeyId}</p>
                      {log.apiKeyName && <p>名称: {log.apiKeyName}</p>}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                {log.tokens ? (
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="font-mono text-xs">
                        {log.tokens.total.toLocaleString()}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1 text-xs">
                        <p>输入: {log.tokens.prompt.toLocaleString()}</p>
                        <p>输出: {log.tokens.completion.toLocaleString()}</p>
                        <p>总计: {log.tokens.total.toLocaleString()}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {hasMore && onLoadMore && (
        <div className="p-4 text-center">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="text-sm text-primary hover:underline disabled:opacity-50"
          >
            {loading ? '加载中...' : '加载更多'}
          </button>
        </div>
      )}
    </ScrollArea>
  );
}
