import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  RefreshCw, 
  Key, 
  Clock, 
  Wifi, 
  Server,
  CreditCard
} from 'lucide-react';
import { 
  AIError, 
  RateLimitError, 
  AuthenticationError, 
  NetworkError,
  APIError 
} from '@/lib/ai/types';

interface AIErrorBoundaryProps {
  children: ReactNode;
  onRetry?: () => void;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRetries?: number;
  retryDelay?: number;
}

interface AIErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorType: 'rate_limit' | 'auth' | 'network' | 'api' | 'unknown';
  retryCount: number;
  isRetrying: boolean;
}

/**
 * AI 专用错误边界组件
 * AI-specific Error Boundary Component
 * 
 * 针对 AI 请求的各类错误提供特定处理：
 * - RateLimitError: 显示重试倒计时
 * - AuthenticationError: 提示检查 API Key
 * - NetworkError: 显示网络状态
 * - APIError: 显示 API 错误详情
 */
export class AIErrorBoundary extends Component<AIErrorBoundaryProps, AIErrorBoundaryState> {
  private retryTimeoutId: number | null = null;

  static defaultProps = {
    maxRetries: 3,
    retryDelay: 1000,
  };

  constructor(props: AIErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorType: 'unknown',
      retryCount: 0,
      isRetrying: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AIErrorBoundaryState> {
    let errorType: AIErrorBoundaryState['errorType'] = 'unknown';
    
    if (error instanceof RateLimitError) {
      errorType = 'rate_limit';
    } else if (error instanceof AuthenticationError) {
      errorType = 'auth';
    } else if (error instanceof NetworkError) {
      errorType = 'network';
    } else if (error instanceof APIError || error instanceof AIError) {
      errorType = 'api';
    }
    
    return { hasError: true, error, errorType };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
    
    if (process.env.NODE_ENV === 'development') {
      console.error('AIErrorBoundary caught an error:', error);
      console.error('Error type:', this.state.errorType);
    }
  }

  componentWillUnmount(): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  handleRetry = async (): Promise<void> => {
    const { maxRetries = 3, retryDelay = 1000, onRetry } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) {
      return;
    }

    this.setState({ isRetrying: true });

    // 指数退避
    const delay = retryDelay * Math.pow(2, retryCount);
    
    await new Promise(resolve => {
      this.retryTimeoutId = window.setTimeout(resolve, delay);
    });

    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorType: 'unknown',
      retryCount: prevState.retryCount + 1,
      isRetrying: false,
    }));

    onRetry?.();
  };

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorType: 'unknown',
      retryCount: 0,
      isRetrying: false,
    });
  };

  getErrorConfig() {
    const { error, errorType } = this.state;
    
    const configs = {
      rate_limit: {
        icon: Clock,
        title: '请求过于频繁',
        description: '已达到 API 速率限制，请稍后再试。',
        hint: error instanceof RateLimitError && error.retryAfter 
          ? `建议等待 ${error.retryAfter} 秒后重试` 
          : '建议等待几分钟后重试',
        canRetry: true,
        color: 'text-amber-500',
        bgColor: 'bg-amber-500/10',
      },
      auth: {
        icon: Key,
        title: 'API 密钥无效',
        description: '认证失败，请检查您的 API 密钥是否正确。',
        hint: '请在设置中更新您的 API 密钥',
        canRetry: false,
        color: 'text-destructive',
        bgColor: 'bg-destructive/10',
      },
      network: {
        icon: Wifi,
        title: '网络连接失败',
        description: '无法连接到 AI 服务，请检查网络连接。',
        hint: '请检查您的网络连接后重试',
        canRetry: true,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
      },
      api: {
        icon: Server,
        title: 'API 请求失败',
        description: error?.message || 'AI 服务返回了错误响应。',
        hint: '这可能是临时问题，请稍后重试',
        canRetry: true,
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
      },
      unknown: {
        icon: AlertTriangle,
        title: '发生未知错误',
        description: error?.message || '处理 AI 请求时发生未知错误。',
        hint: '请刷新页面后重试',
        canRetry: true,
        color: 'text-muted-foreground',
        bgColor: 'bg-muted/50',
      },
    };

    return configs[errorType];
  }

  render(): ReactNode {
    const { children } = this.props;
    const { hasError, retryCount, isRetrying } = this.state;
    const { maxRetries = 3 } = this.props;

    if (!hasError) {
      return children;
    }

    const config = this.getErrorConfig();
    const Icon = config.icon;
    const canRetryMore = config.canRetry && retryCount < maxRetries;

    return (
      <div className="min-h-[300px] flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full ${config.bgColor}`}>
            <Icon className={`w-7 h-7 ${config.color}`} />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              {config.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {config.description}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {config.hint}
            </p>
          </div>

          {retryCount > 0 && (
            <p className="text-xs text-muted-foreground">
              已重试 {retryCount}/{maxRetries} 次
            </p>
          )}

          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleReset}
              disabled={isRetrying}
            >
              重置
            </Button>
            {canRetryMore && (
              <Button
                size="sm"
                onClick={this.handleRetry}
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    重试中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    重试
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default AIErrorBoundary;
