/**
 * 请求日志 Hook
 * Request Logs Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  getLogs, 
  getLogStats, 
  clearLogs,
  type RequestLogEntry,
  type LogFilter,
  type LogStats,
} from '../clients/logs-client';

export interface UseRequestLogsOptions {
  /** 自动获取 */
  autoFetch?: boolean;
  /** 初始过滤条件 */
  initialFilter?: LogFilter;
  /** 刷新间隔（毫秒） */
  refreshInterval?: number;
}

export interface UseRequestLogsReturn {
  logs: RequestLogEntry[];
  stats: LogStats | null;
  loading: boolean;
  error: string | null;
  filter: LogFilter;
  setFilter: (filter: LogFilter) => void;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  clear: (filter?: Pick<LogFilter, 'startTime' | 'endTime'>) => Promise<boolean>;
  hasMore: boolean;
}

export function useRequestLogs(options: UseRequestLogsOptions = {}): UseRequestLogsReturn {
  const { 
    autoFetch = true, 
    initialFilter = { limit: 50 },
    refreshInterval,
  } = options;

  const [logs, setLogs] = useState<RequestLogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<LogFilter>(initialFilter);
  const [hasMore, setHasMore] = useState(true);

  const fetchLogs = useCallback(async (currentFilter: LogFilter, append = false) => {
    setLoading(true);
    setError(null);

    try {
      const [fetchedLogs, fetchedStats] = await Promise.all([
        getLogs(currentFilter),
        getLogStats({
          startTime: currentFilter.startTime,
          endTime: currentFilter.endTime,
          apiKeyId: currentFilter.apiKeyId,
        }),
      ]);

      if (append) {
        setLogs(prev => [...prev, ...fetchedLogs]);
      } else {
        setLogs(fetchedLogs);
      }
      
      setStats(fetchedStats);
      setHasMore(fetchedLogs.length === (currentFilter.limit || 50));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    const resetFilter = { ...filter, offset: 0 };
    setFilter(resetFilter);
    await fetchLogs(resetFilter, false);
  }, [filter, fetchLogs]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    const newFilter = {
      ...filter,
      offset: (filter.offset || 0) + (filter.limit || 50),
    };
    setFilter(newFilter);
    await fetchLogs(newFilter, true);
  }, [filter, loading, hasMore, fetchLogs]);

  const handleClear = useCallback(async (clearFilter?: Pick<LogFilter, 'startTime' | 'endTime'>): Promise<boolean> => {
    try {
      const result = await clearLogs(clearFilter);
      if (result.cleared > 0) {
        await refresh();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [refresh]);

  const handleSetFilter = useCallback((newFilter: LogFilter) => {
    const resetFilter = { ...newFilter, offset: 0 };
    setFilter(resetFilter);
    fetchLogs(resetFilter, false);
  }, [fetchLogs]);

  useEffect(() => {
    if (autoFetch) {
      fetchLogs(filter, false);
    }
  }, [autoFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const intervalId = setInterval(() => {
        fetchLogs({ ...filter, offset: 0 }, false);
      }, refreshInterval);

      return () => clearInterval(intervalId);
    }
  }, [refreshInterval, filter, fetchLogs]);

  return {
    logs,
    stats,
    loading,
    error,
    filter,
    setFilter: handleSetFilter,
    refresh,
    loadMore,
    clear: handleClear,
    hasMore,
  };
}

export type { RequestLogEntry, LogFilter, LogStats };
