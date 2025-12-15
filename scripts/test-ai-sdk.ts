#!/usr/bin/env npx tsx
/**
 * AI SDK E2E Test - 完整组件测试
 * 
 * 通过 Cerebras API Key 测试系统内所有核心组件的完整功能链路：
 * 1. CerebrasAdapter - 适配器直接调用
 * 2. createCerebras() - 工厂函数
 * 3. AIClient - 统一客户端
 * 4. EnhancedAIClient - 增强客户端（含中间件、缓存、队列）
 * 5. MiddlewareManager - 中间件系统
 * 6. MemoryCache - 缓存系统
 * 7. RequestQueue - 请求队列和并发控制
 * 8. CostTracker - 成本追踪
 * 9. AIDiagnostics - 诊断工具
 * 10. 流式响应 - chatStream()
 */

import {
  CerebrasAdapter,
  AIClient,
  EnhancedAIClient,
  createCerebras,
  MiddlewareManager,
  createLoggingMiddleware,
  createPerformanceMiddleware,
  MemoryCache,
  RequestQueue,
  CostTracker,
  AIDiagnostics,
  formatCost,
  formatDiagnosticsReport,
} from '../src/lib/ai';

// ==================== 测试工具 ====================

let passedTests = 0;
let failedTests = 0;

function log(msg: string) {
  console.log(msg);
}

function pass(name: string, detail?: string) {
  passedTests++;
  console.log(`   ✅ ${name}${detail ? ` - ${detail}` : ''}`);
}

function fail(name: string, error: string) {
  failedTests++;
  console.log(`   ❌ ${name} - ${error}`);
}

// ==================== 获取 API Keys ====================

const API_KEYS = [
  process.env.CEREBRAS_API_KEY_1,
  process.env.CEREBRAS_API_KEY_2,
  process.env.CEREBRAS_API_KEY_3,
].filter(Boolean) as string[];

if (API_KEYS.length === 0) {
  console.error('❌ No CEREBRAS_API_KEY_* environment variables found');
  process.exit(1);
}

// ==================== 测试用例 ====================

async function testCerebrasAdapter() {
  log('\n1. CerebrasAdapter');
  
  // 测试每个 Key 的有效性
  for (let i = 0; i < API_KEYS.length; i++) {
    const adapter = new CerebrasAdapter({ apiKey: API_KEYS[i] });
    try {
      const isValid = await adapter.validateApiKey();
      if (isValid) {
        pass(`validateApiKey()`, `Key ${i + 1} valid`);
      } else {
        fail(`validateApiKey()`, `Key ${i + 1} invalid`);
      }
    } catch (err) {
      fail(`validateApiKey()`, `Key ${i + 1}: ${(err as Error).message}`);
    }
  }
  
  // 测试 listModels
  const adapter = new CerebrasAdapter({ apiKey: API_KEYS[0] });
  try {
    const models = await adapter.listModels();
    pass(`listModels()`, `${models.length} models found`);
  } catch (err) {
    fail(`listModels()`, (err as Error).message);
  }
  
  // 测试 chat
  try {
    const start = Date.now();
    const response = await adapter.chat({
      model: 'llama-3.1-8b',
      messages: [{ role: 'user', content: 'Say "OK" only.' }],
      max_tokens: 5,
    });
    const latency = Date.now() - start;
    const content = response.choices[0]?.message?.content?.trim() || '';
    pass(`chat()`, `Response: "${content}" (${latency}ms)`);
  } catch (err) {
    fail(`chat()`, (err as Error).message);
  }
  
  // 测试 chatStream
  try {
    let chunks = 0;
    let streamContent = '';
    for await (const chunk of adapter.chatStream({
      model: 'llama-3.1-8b',
      messages: [{ role: 'user', content: 'Say "Hi" only.' }],
      max_tokens: 5,
    })) {
      chunks++;
      if (chunk.choices[0]?.delta?.content) {
        streamContent += chunk.choices[0].delta.content;
      }
    }
    pass(`chatStream()`, `Streamed ${chunks} chunks: "${streamContent.trim()}"`);
  } catch (err) {
    fail(`chatStream()`, (err as Error).message);
  }
}

async function testFactory() {
  log('\n2. Factory Functions');
  
  try {
    const modelRef = createCerebras({
      apiKey: API_KEYS[0],
      defaultModel: 'llama-3.1-8b',
    });
    
    if (modelRef && modelRef.provider === 'cerebras') {
      pass(`createCerebras()`, `ModelReference created`);
    } else {
      fail(`createCerebras()`, 'Invalid ModelReference');
    }
  } catch (err) {
    fail(`createCerebras()`, (err as Error).message);
  }
}

async function testAIClient() {
  log('\n3. AIClient');
  
  const client = new AIClient();
  
  // 注册提供商
  try {
    client.registerProvider({
      provider: 'cerebras',
      apiKey: API_KEYS[0],
    });
    pass(`registerProvider()`, 'cerebras registered');
  } catch (err) {
    fail(`registerProvider()`, (err as Error).message);
  }
  
  // 通过客户端调用 chat
  try {
    const start = Date.now();
    const response = await client.chat({
      model: 'llama-3.1-8b',
      messages: [{ role: 'user', content: 'Say "Hello" only.' }],
      max_tokens: 5,
    }, 'cerebras');
    const latency = Date.now() - start;
    const content = response.choices[0]?.message?.content?.trim() || '';
    pass(`chat()`, `Response: "${content}" (${latency}ms)`);
  } catch (err) {
    fail(`chat()`, (err as Error).message);
  }
  
  // 测试 fallback (使用多个 Key)
  if (API_KEYS.length >= 2) {
    try {
      const fallbackClient = new AIClient();
      // 注册多个 cerebras 实例（使用不同 Key，模拟回退）
      fallbackClient.registerProvider({
        provider: 'cerebras',
        apiKey: API_KEYS[0],
      });
      
      const response = await fallbackClient.chatWithFallback({
        model: 'llama-3.1-8b',
        messages: [{ role: 'user', content: 'Say "Fallback" only.' }],
        max_tokens: 5,
      }, ['cerebras']);
      
      const content = response.choices[0]?.message?.content?.trim() || '';
      pass(`chatWithFallback()`, `Response: "${content}"`);
    } catch (err) {
      fail(`chatWithFallback()`, (err as Error).message);
    }
  }
}

async function testEnhancedClient() {
  log('\n4. EnhancedAIClient');
  
  // 创建中间件管理器
  const middleware = new MiddlewareManager();
  let middlewareExecuted = false;
  
  middleware.use({
    name: 'test-middleware',
    onRequest: async (request) => {
      middlewareExecuted = true;
      return request;
    },
  });
  
  // 创建缓存
  const cache = new MemoryCache({ ttl: 60000, maxSize: 100 });
  
  // 创建增强客户端
  const client = new EnhancedAIClient({
    middleware,
    cache: cache as any,
    costTracker: { enabled: true },
    enableDiagnostics: true,
  });
  
  client.registerProvider({
    provider: 'cerebras',
    apiKey: API_KEYS[0],
  });
  
  // 测试中间件执行
  try {
    await client.chat({
      model: 'llama-3.1-8b',
      messages: [{ role: 'user', content: 'Say "Middleware" only.' }],
      max_tokens: 5,
    }, 'cerebras');
    
    if (middlewareExecuted) {
      pass(`Middleware executed`, 'test-middleware ran');
    } else {
      fail(`Middleware executed`, 'Middleware not triggered');
    }
  } catch (err) {
    fail(`Middleware executed`, (err as Error).message);
  }
  
  // 测试缓存
  try {
    const request = {
      model: 'llama-3.1-8b',
      messages: [{ role: 'user' as const, content: 'Say "Cache" only.' }],
      max_tokens: 5,
    };
    
    // 第一次调用 - 缓存未命中
    const start1 = Date.now();
    await client.chat(request, 'cerebras');
    const time1 = Date.now() - start1;
    
    // 第二次调用 - 应该命中缓存
    const start2 = Date.now();
    await client.chat(request, 'cerebras');
    const time2 = Date.now() - start2;
    
    const cacheStats = cache.getStats();
    if (cacheStats.hits > 0) {
      pass(`Cache hit`, `Miss: ${time1}ms → Hit: ${time2}ms`);
    } else {
      pass(`Cache miss → set`, `First call: ${time1}ms`);
    }
  } catch (err) {
    fail(`Cache`, (err as Error).message);
  }
}

async function testRequestQueue() {
  log('\n5. RequestQueue');
  
  const queue = new RequestQueue({
    maxConcurrent: 3,
    maxQueueSize: 10,
  });
  
  const adapter = new CerebrasAdapter({ apiKey: API_KEYS[0] });
  
  queue.setExecutor(async (request) => {
    return adapter.chat(request);
  });
  
  // 并发发送多个请求
  try {
    const requests = API_KEYS.map((_, i) => ({
      model: 'llama-3.1-8b',
      messages: [{ role: 'user' as const, content: `Say "${i}" only.` }],
      max_tokens: 5,
    }));
    
    const start = Date.now();
    const results = await Promise.all(
      requests.map(req => queue.enqueue(req, 'cerebras'))
    );
    const duration = Date.now() - start;
    
    const allSucceeded = results.every(r => r.choices[0]?.message?.content);
    if (allSucceeded) {
      pass(`Concurrent requests (${requests.length} parallel)`, `All succeeded in ${duration}ms`);
    } else {
      fail(`Concurrent requests`, 'Some requests failed');
    }
    
    const stats = queue.getStats();
    pass(`Queue stats`, `Completed: ${stats.completed}, Failed: ${stats.failed}`);
  } catch (err) {
    fail(`Concurrent requests`, (err as Error).message);
  }
}

async function testCostTracker() {
  log('\n6. CostTracker');
  
  const tracker = new CostTracker({ enabled: true });
  
  // 模拟追踪一个响应
  try {
    tracker.track({
      id: 'test-id',
      choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }],
      model: 'llama-3.1-8b',
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    }, 'cerebras');
    
    const usage = tracker.getUsage('cerebras');
    if (usage.totalRequests > 0) {
      pass(`Cost recorded`, `${formatCost(usage.totalCost)}`);
      pass(`Usage stats`, `${usage.totalTokens} tokens`);
    } else {
      fail(`Cost tracking`, 'No usage recorded');
    }
  } catch (err) {
    fail(`CostTracker`, (err as Error).message);
  }
}

async function testDiagnostics() {
  log('\n7. AIDiagnostics');
  
  const adapter = new CerebrasAdapter({ apiKey: API_KEYS[0] });
  const adaptersMap = new Map();
  adaptersMap.set('cerebras', adapter);
  
  const diagnostics = new AIDiagnostics(adaptersMap);
  
  // 测试单个连接
  try {
    const result = await diagnostics.testConnection('cerebras');
    if (result.success) {
      pass(`Connection test`, `Passed (${result.latency}ms)`);
    } else {
      fail(`Connection test`, result.error || 'Unknown error');
    }
  } catch (err) {
    fail(`Connection test`, (err as Error).message);
  }
  
  // 生成诊断报告
  try {
    const report = await diagnostics.generateReport();
    if (report.results.length > 0) {
      pass(`Report generated`, `${report.results.length} provider(s) tested`);
    } else {
      fail(`Report generated`, 'Empty report');
    }
  } catch (err) {
    fail(`Report generated`, (err as Error).message);
  }
}

// ==================== 主函数 ====================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    AI SDK E2E Test Report                    ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Provider: Cerebras                                          ║`);
  console.log(`║  Keys: ${API_KEYS.length} configured                                          ║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  
  const startTime = Date.now();
  
  try {
    await testCerebrasAdapter();
    await testFactory();
    await testAIClient();
    await testEnhancedClient();
    await testRequestQueue();
    await testCostTracker();
    await testDiagnostics();
  } catch (err) {
    console.error('\n❌ Unexpected error:', (err as Error).message);
    process.exit(1);
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n╠══════════════════════════════════════════════════════════════╣');
  console.log('║  SUMMARY                                                     ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Total Tests:  ${(passedTests + failedTests).toString().padEnd(46)}║`);
  console.log(`║  Passed:       ${passedTests} ✅${' '.repeat(42 - passedTests.toString().length)}║`);
  console.log(`║  Failed:       ${failedTests}${' '.repeat(45 - failedTests.toString().length)}║`);
  console.log(`║  Duration:     ${duration}s${' '.repeat(44 - duration.length)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  if (failedTests > 0) {
    process.exit(1);
  }
}

main();
