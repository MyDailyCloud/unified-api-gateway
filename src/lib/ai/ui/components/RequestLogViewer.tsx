/**
 * 请求日志查看器
 * Request Log Viewer Component
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { 
  RefreshCw, 
  Trash2, 
  Filter,
  Download,
  Activity,
} from 'lucide-react';
import { useRequestLogs, type LogFilter } from '../hooks/use-request-logs';
import { RequestLogList } from './RequestLogList';
import { 
  RequestLogStats, 
  RequestLogStatusBreakdown,
  RequestLogApiKeyBreakdown,
} from './RequestLogStats';

interface RequestLogViewerProps {
  /** 刷新间隔（毫秒） */
  refreshInterval?: number;
  /** 显示统计 */
  showStats?: boolean;
  /** 显示过滤器 */
  showFilters?: boolean;
}

export function RequestLogViewer({
  refreshInterval = 30000,
  showStats = true,
  showFilters = true,
}: RequestLogViewerProps) {
  const {
    logs,
    stats,
    loading,
    error,
    filter,
    setFilter,
    refresh,
    loadMore,
    clear,
    hasMore,
  } = useRequestLogs({ 
    autoFetch: true,
    refreshInterval,
    initialFilter: { limit: 50 },
  });

  const [pathFilter, setPathFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  const handleApplyFilters = () => {
    const newFilter: LogFilter = {
      limit: 50,
      offset: 0,
    };

    if (pathFilter) {
      newFilter.path = pathFilter;
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'success') {
        newFilter.minStatus = 200;
        newFilter.maxStatus = 399;
      } else if (statusFilter === 'error') {
        newFilter.minStatus = 400;
      } else {
        newFilter.status = parseInt(statusFilter);
      }
    }

    if (methodFilter !== 'all') {
      newFilter.method = methodFilter;
    }

    setFilter(newFilter);
  };

  const handleClearFilters = () => {
    setPathFilter('');
    setStatusFilter('all');
    setMethodFilter('all');
    setFilter({ limit: 50, offset: 0 });
  };

  const handleClearLogs = async () => {
    const success = await clear();
    if (success) {
      toast.success('日志已清除');
    } else {
      toast.error('清除日志失败');
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(logs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `request-logs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('日志已导出');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6" />
            请求日志
          </h2>
          <p className="text-muted-foreground">
            查看和分析所有 API 请求的历史记录
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            导出
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                清除
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认清除日志</AlertDialogTitle>
                <AlertDialogDescription>
                  此操作将删除所有请求日志，且无法恢复。确定要继续吗？
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearLogs}>
                  确认清除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Stats */}
      {showStats && <RequestLogStats stats={stats} loading={loading} />}

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" />
              筛选条件
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="path">路径</Label>
                <Input
                  id="path"
                  placeholder="如: /v1/chat"
                  value={pathFilter}
                  onChange={(e) => setPathFilter(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="method">方法</Label>
                <Select value={methodFilter} onValueChange={setMethodFilter}>
                  <SelectTrigger id="method">
                    <SelectValue placeholder="所有方法" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有方法</SelectItem>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">状态</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="所有状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有状态</SelectItem>
                    <SelectItem value="success">成功 (2xx-3xx)</SelectItem>
                    <SelectItem value="error">错误 (4xx-5xx)</SelectItem>
                    <SelectItem value="200">200 OK</SelectItem>
                    <SelectItem value="400">400 Bad Request</SelectItem>
                    <SelectItem value="401">401 Unauthorized</SelectItem>
                    <SelectItem value="500">500 Server Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleApplyFilters} className="flex-1">
                  应用筛选
                </Button>
                <Button variant="outline" onClick={handleClearFilters}>
                  重置
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Log List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>请求记录</CardTitle>
            <CardDescription>
              共 {stats?.totalRequests || 0} 条记录
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="text-center py-8 text-destructive">
                <p>{error}</p>
                <Button variant="link" onClick={refresh}>
                  重试
                </Button>
              </div>
            ) : (
              <RequestLogList
                logs={logs}
                loading={loading}
                onLoadMore={loadMore}
                hasMore={hasMore}
              />
            )}
          </CardContent>
        </Card>

        {/* Side Stats */}
        <div className="space-y-6">
          <RequestLogStatusBreakdown stats={stats} />
          <RequestLogApiKeyBreakdown stats={stats} />
        </div>
      </div>
    </div>
  );
}
