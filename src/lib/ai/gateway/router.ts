/**
 * Gateway Router
 * 智能路由器 - 根据策略选择最优后端
 */

import type {
  GatewayRouter as IGatewayRouter,
  RouterStats,
  BackendConfig,
  RoutingConfig,
  UnifiedRequest,
} from './types';
import { createModelRouter } from '../registry';

interface BackendStats {
  name: string;
  requestCount: number;
  errorCount: number;
  totalLatency: number;
  latencyHistory: number[];
  lastError?: string;
  lastUsed?: number;
  consecutiveFailures: number;
  circuitOpen: boolean;
  circuitOpenUntil?: number;
}

const MAX_LATENCY_HISTORY = 100;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 30000;

export class GatewayRouter implements IGatewayRouter {
  private backends: BackendConfig[] = [];
  private stats: Map<string, BackendStats> = new Map();
  private roundRobinIndex = 0;
  private modelRouter = createModelRouter();
  
  constructor(private config?: RoutingConfig) {}
  
  /**
   * Register backends
   */
  setBackends(backends: BackendConfig[]): void {
    this.backends = backends.filter(b => b.enabled !== false);
    
    // Sort by priority
    this.backends.sort((a, b) => (a.priority || 100) - (b.priority || 100));
    
    // Initialize stats
    for (const backend of this.backends) {
      if (!this.stats.has(backend.name)) {
        this.stats.set(backend.name, {
          name: backend.name,
          requestCount: 0,
          errorCount: 0,
          totalLatency: 0,
          latencyHistory: [],
          consecutiveFailures: 0,
          circuitOpen: false,
        });
      }
    }
  }
  
  /**
   * Select optimal backend for request
   */
  selectBackend(request: UnifiedRequest): BackendConfig {
    const strategy = this.config?.strategy || 'model-match';
    const available = this.getAvailableBackends();
    
    if (available.length === 0) {
      throw new Error('No available backends');
    }
    
    let selected: BackendConfig | undefined;
    
    switch (strategy) {
      case 'model-match':
        selected = this.selectByModelMatch(request.model, available);
        break;
      case 'round-robin':
        selected = this.selectRoundRobin(available);
        break;
      case 'least-latency':
        selected = this.selectLeastLatency(available);
        break;
      case 'cost-optimized':
        selected = this.selectCostOptimized(request, available);
        break;
      case 'priority':
        selected = this.selectByPriority(available);
        break;
      case 'random':
        selected = this.selectRandom(available);
        break;
      default:
        selected = available[0];
    }
    
    if (!selected) {
      selected = available[0];
    }
    
    // Update stats
    const stats = this.stats.get(selected.name);
    if (stats) {
      stats.requestCount++;
      stats.lastUsed = Date.now();
    }
    
    return selected;
  }
  
  /**
   * Get available (healthy) backends
   */
  getAvailableBackends(): BackendConfig[] {
    return this.backends.filter(b => this.isHealthy(b.name));
  }
  
  /**
   * Report backend latency
   */
  reportLatency(backendName: string, latencyMs: number): void {
    const stats = this.stats.get(backendName);
    if (!stats) return;
    
    stats.totalLatency += latencyMs;
    stats.latencyHistory.push(latencyMs);
    
    // Keep history bounded
    if (stats.latencyHistory.length > MAX_LATENCY_HISTORY) {
      stats.latencyHistory.shift();
    }
    
    // Successful request resets consecutive failures
    stats.consecutiveFailures = 0;
    stats.circuitOpen = false;
  }
  
  /**
   * Report backend failure
   */
  reportFailure(backendName: string, error: Error): void {
    const stats = this.stats.get(backendName);
    if (!stats) return;
    
    stats.errorCount++;
    stats.consecutiveFailures++;
    stats.lastError = error.message;
    
    // Circuit breaker
    if (stats.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      stats.circuitOpen = true;
      stats.circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_RESET_MS;
    }
  }
  
  /**
   * Check if backend is healthy
   */
  isHealthy(backendName: string): boolean {
    const stats = this.stats.get(backendName);
    if (!stats) return true;
    
    // Check circuit breaker
    if (stats.circuitOpen) {
      if (stats.circuitOpenUntil && Date.now() > stats.circuitOpenUntil) {
        // Reset circuit breaker (half-open state)
        stats.circuitOpen = false;
        stats.consecutiveFailures = 0;
        return true;
      }
      return false;
    }
    
    return true;
  }
  
  /**
   * Get router statistics
   */
  getStats(): RouterStats {
    const backendStats = Array.from(this.stats.values()).map(s => ({
      name: s.name,
      healthy: this.isHealthy(s.name),
      avgLatency: s.latencyHistory.length > 0
        ? s.latencyHistory.reduce((a, b) => a + b, 0) / s.latencyHistory.length
        : 0,
      requestCount: s.requestCount,
      errorCount: s.errorCount,
      lastError: s.lastError,
      lastUsed: s.lastUsed,
    }));
    
    return {
      backends: backendStats,
      totalRequests: backendStats.reduce((sum, b) => sum + b.requestCount, 0),
      totalErrors: backendStats.reduce((sum, b) => sum + b.errorCount, 0),
    };
  }
  
  // =========================================================================
  // Selection Strategies
  // =========================================================================
  
  private selectByModelMatch(model: string, available: BackendConfig[]): BackendConfig | undefined {
    // Check for exact model match in backend config
    for (const backend of available) {
      if (backend.models?.some(pattern => {
        if (pattern.includes('*')) {
          const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
          return regex.test(model);
        }
        return pattern === model;
      })) {
        return backend;
      }
    }
    
    // Use model router to infer provider
    const { provider } = this.modelRouter.route(model);
    const providerMatch = available.find(b => b.provider === provider);
    if (providerMatch) return providerMatch;
    
    // Check if model name contains provider hint
    const modelLower = model.toLowerCase();
    for (const backend of available) {
      const providerLower = backend.provider.toLowerCase();
      if (modelLower.includes(providerLower) || modelLower.startsWith(providerLower + '/')) {
        return backend;
      }
    }
    
    return available[0];
  }
  
  private selectRoundRobin(available: BackendConfig[]): BackendConfig {
    const index = this.roundRobinIndex % available.length;
    this.roundRobinIndex++;
    return available[index];
  }
  
  private selectLeastLatency(available: BackendConfig[]): BackendConfig {
    let best = available[0];
    let bestLatency = Infinity;
    
    for (const backend of available) {
      const stats = this.stats.get(backend.name);
      if (!stats || stats.latencyHistory.length === 0) {
        // Prefer backends we haven't tried yet
        return backend;
      }
      
      const avgLatency = stats.latencyHistory.reduce((a, b) => a + b, 0) / stats.latencyHistory.length;
      if (avgLatency < bestLatency) {
        bestLatency = avgLatency;
        best = backend;
      }
    }
    
    return best;
  }
  
  private selectCostOptimized(request: UnifiedRequest, available: BackendConfig[]): BackendConfig {
    // Estimate token count (rough approximation)
    const inputTokens = request.messages.reduce((sum, m) => {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return sum + Math.ceil(content.length / 4);
    }, 0);
    const outputTokens = request.max_tokens || 1000;
    
    let best = available[0];
    let bestCost = Infinity;
    
    for (const backend of available) {
      if (backend.costPer1kTokens) {
        const cost = 
          (inputTokens / 1000) * backend.costPer1kTokens.input +
          (outputTokens / 1000) * backend.costPer1kTokens.output;
        
        if (cost < bestCost) {
          bestCost = cost;
          best = backend;
        }
      }
    }
    
    return best;
  }
  
  private selectByPriority(available: BackendConfig[]): BackendConfig {
    // Already sorted by priority in setBackends
    return available[0];
  }
  
  private selectRandom(available: BackendConfig[]): BackendConfig {
    // Weighted random if weights are specified
    const hasWeights = available.some(b => b.weight !== undefined);
    
    if (hasWeights) {
      const totalWeight = available.reduce((sum, b) => sum + (b.weight || 1), 0);
      let random = Math.random() * totalWeight;
      
      for (const backend of available) {
        random -= backend.weight || 1;
        if (random <= 0) {
          return backend;
        }
      }
    }
    
    return available[Math.floor(Math.random() * available.length)];
  }
}

/**
 * Create gateway router
 */
export function createGatewayRouter(config?: RoutingConfig): GatewayRouter {
  return new GatewayRouter(config);
}

export default GatewayRouter;
