/**
 * 完整端到端集成测试
 * Complete End-to-End Integration Test
 * 
 * 测试流程:
 * 1. 初始化服务器 (自动创建 admin 用户)
 * 2. 登录获取 session token
 * 3. 创建 Gateway Key
 * 4. 注册 Cerebras Provider
 * 5. 通过 Gateway Key 调用 Cerebras API
 * 6. 测试流式响应
 * 7. 验证 Key 统计
 * 8. 测试 Key 禁用/启用
 * 9. 清理资源
 */

import {
  startGroup,
  pass,
  fail,
  loadEnv,
  httpRequest,
  assert,
  assertDefined,
  assertEqual,
  cleanupTestFiles,
  delay,
} from '../utils';

import { initServer, cleanupServer, type ServerInitResult } from '../../../src/lib/ai/server/init';
import { createAICore, type AICore } from '../../../src/lib/ai/core';
import { CerebrasAdapter } from '../../../src/lib/ai/adapters/cerebras-adapter';
import { createAuthRouter } from '../../../src/lib/ai/server/auth/auth-router';
import { createGatewayKeyRouter } from '../../../src/lib/ai/server/auth/gateway-key-router';

// 测试配置
const TEST_PORT = 3456;
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;
const TEST_CREDENTIALS_PATH = './test-credentials.json';
const TEST_KEYS_PATH = './test-gateway-keys.json';

// 测试状态
let serverInit: ServerInitResult | null = null;
let core: AICore | null = null;
let httpServer: { start: () => Promise<void>; stop: () => Promise<void> } | null = null;
let sessionToken: string | null = null;
let gatewayKey: string | null = null;
let gatewayKeyId: string | null = null;

// ========== 测试函数 ==========

async function testServerInitialization() {
  startGroup('Server Initialization');
  
  // 测试 1: 初始化服务器
  let t = Date.now();
  try {
    serverInit = await initServer({
      credentialsPath: TEST_CREDENTIALS_PATH,
      gatewayKeysPath: TEST_KEYS_PATH,
      silent: true,
    });
    
    assertDefined(serverInit.credentialsManager, 'CredentialsManager should be created');
    assertDefined(serverInit.sessionManager, 'SessionManager should be created');
    assertDefined(serverInit.gatewayKeyManager, 'GatewayKeyManager should be created');
    assertDefined(serverInit.authMiddleware, 'AuthMiddleware should be created');
    
    // 首次启动应该生成密码
    if (serverInit.generatedPassword) {
      console.log(`     [Info] Generated admin password: ${serverInit.generatedPassword}`);
    }
    
    pass('initServer() creates all managers', t);
  } catch (e) {
    fail('initServer() creates all managers', e, t);
    throw e; // 关键测试失败，终止
  }
  
  // 测试 2: 创建 AICore
  t = Date.now();
  try {
    core = await createAICore({
      defaultProvider: 'cerebras',
    });
    
    assertDefined(core, 'AICore should be created');
    pass('createAICore() initializes', t);
  } catch (e) {
    fail('createAICore() initializes', e, t);
    throw e;
  }
  
  // 测试 3: 启动 HTTP 服务器
  t = Date.now();
  try {
    // 动态导入避免 ESM 问题
    const { createHttpServer } = await import('../../../src/lib/ai/transport/http/server');
    
    // 创建路由器
    const authRouter = createAuthRouter(serverInit!.authMiddleware);
    const gatewayKeyRouter = createGatewayKeyRouter(
      serverInit!.gatewayKeyManager,
      serverInit!.authMiddleware
    );
    
    httpServer = createHttpServer(core!, {
      port: TEST_PORT,
      authMiddleware: serverInit!.authMiddleware,
      authRouter,
      gatewayKeyRouter,
    });
    
    await httpServer.start();
    
    // 等待服务器完全启动
    await delay(100);
    
    pass('HTTP Server starts on port ' + TEST_PORT, t);
  } catch (e) {
    fail('HTTP Server starts on port ' + TEST_PORT, e, t);
    throw e;
  }
  
  // 测试 4: 健康检查
  t = Date.now();
  try {
    const resp = await httpRequest(TEST_BASE_URL, '/health');
    assertEqual(resp.status, 200, 'Health check status');
    
    const body = resp.body as { status: string };
    assertEqual(body.status, 'ok', 'Health status should be ok');
    
    pass('Health check endpoint works', t);
  } catch (e) {
    fail('Health check endpoint works', e, t);
  }
}

async function testAuthentication() {
  startGroup('Authentication');
  
  assertDefined(serverInit, 'Server should be initialized');
  assertDefined(serverInit.generatedPassword, 'Admin password should be generated');
  
  // 测试 1: 登录失败（错误密码）
  let t = Date.now();
  try {
    const resp = await httpRequest(TEST_BASE_URL, '/internal/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'wrongpassword' },
    });
    
    assertEqual(resp.status, 401, 'Login with wrong password should fail');
    pass('Login fails with wrong password', t);
  } catch (e) {
    fail('Login fails with wrong password', e, t);
  }
  
  // 测试 2: 登录成功
  t = Date.now();
  try {
    const resp = await httpRequest(TEST_BASE_URL, '/internal/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: serverInit!.generatedPassword },
    });
    
    assertEqual(resp.status, 200, 'Login should succeed');
    
    const body = resp.body as { success: boolean; token?: string };
    assert(body.success, 'Login response should have success=true');
    assertDefined(body.token, 'Login response should have token');
    
    sessionToken = body.token;
    console.log(`     [Info] Session token: ${sessionToken!.slice(0, 20)}...`);
    
    pass('Login succeeds with correct password', t);
  } catch (e) {
    fail('Login succeeds with correct password', e, t);
    throw e;
  }
  
  // 测试 3: 获取用户信息
  t = Date.now();
  try {
    const resp = await httpRequest(TEST_BASE_URL, '/internal/auth/me', {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    
    assertEqual(resp.status, 200, 'Get me should succeed');
    
    const body = resp.body as { role: string; authenticated: boolean };
    assertEqual(body.role, 'admin', 'Role should be admin');
    assert(body.authenticated, 'Should be authenticated');
    
    pass('Get current user info', t);
  } catch (e) {
    fail('Get current user info', e, t);
  }
}

async function testGatewayKeyManagement() {
  startGroup('Gateway Key Management');
  
  assertDefined(sessionToken, 'Session token should exist');
  
  const authHeaders = { Authorization: `Bearer ${sessionToken}` };
  
  // 测试 1: 创建 Gateway Key
  let t = Date.now();
  try {
    const resp = await httpRequest(TEST_BASE_URL, '/internal/gateway-keys/', {
      method: 'POST',
      headers: authHeaders,
      body: { name: 'Test E2E Key', scopes: ['chat', 'models'] },
    });
    
    assertEqual(resp.status, 201, 'Create key should return 201');
    
    const body = resp.body as { id: string; key: string; prefix: string };
    assertDefined(body.id, 'Response should have key id');
    assertDefined(body.key, 'Response should have plaintext key');
    assertDefined(body.prefix, 'Response should have key prefix');
    
    gatewayKeyId = body.id;
    gatewayKey = body.key;
    
    console.log(`     [Info] Gateway Key ID: ${gatewayKeyId}`);
    console.log(`     [Info] Gateway Key: ${body.prefix}...`);
    
    pass('Create Gateway Key', t);
  } catch (e) {
    fail('Create Gateway Key', e, t);
    throw e;
  }
  
  // 测试 2: 列出 Keys
  t = Date.now();
  try {
    const resp = await httpRequest(TEST_BASE_URL, '/internal/gateway-keys/', {
      headers: authHeaders,
    });
    
    assertEqual(resp.status, 200, 'List keys should succeed');
    
    const body = resp.body as { keys: unknown[]; total: number };
    assert(body.total >= 1, 'Should have at least 1 key');
    
    pass('List Gateway Keys', t);
  } catch (e) {
    fail('List Gateway Keys', e, t);
  }
  
  // 测试 3: 获取单个 Key
  t = Date.now();
  try {
    const resp = await httpRequest(TEST_BASE_URL, `/internal/gateway-keys/${gatewayKeyId}`, {
      headers: authHeaders,
    });
    
    assertEqual(resp.status, 200, 'Get key should succeed');
    
    const body = resp.body as { id: string; name: string };
    assertEqual(body.id, gatewayKeyId, 'Key ID should match');
    assertEqual(body.name, 'Test E2E Key', 'Key name should match');
    
    pass('Get single Gateway Key', t);
  } catch (e) {
    fail('Get single Gateway Key', e, t);
  }
  
  // 测试 4: 获取统计
  t = Date.now();
  try {
    const resp = await httpRequest(TEST_BASE_URL, '/internal/gateway-keys/stats', {
      headers: authHeaders,
    });
    
    assertEqual(resp.status, 200, 'Get stats should succeed');
    
    const body = resp.body as { total: number; active: number };
    assert(body.total >= 1, 'Should have at least 1 key');
    assert(body.active >= 1, 'Should have at least 1 active key');
    
    pass('Get Gateway Key stats', t);
  } catch (e) {
    fail('Get Gateway Key stats', e, t);
  }
}

async function testProviderRegistration() {
  startGroup('Provider Registration');
  
  assertDefined(core, 'AICore should exist');
  
  // 获取 Cerebras API Key
  const apiKey = process.env.CEREBRAS_API_KEY_1 || process.env.CEREBRAS_API_KEY;
  
  if (!apiKey) {
    console.log('  ⚠️  No CEREBRAS_API_KEY found, skipping provider tests');
    return false;
  }
  
  // 测试 1: 注册 Cerebras Provider
  let t = Date.now();
  try {
    const adapter = new CerebrasAdapter({ apiKey });
    core!.registerProviderWithAdapter('cerebras', adapter);
    
    const providers = core!.getRegisteredProviders();
    assert(providers.includes('cerebras'), 'Cerebras should be registered');
    
    pass('Register Cerebras provider', t);
  } catch (e) {
    fail('Register Cerebras provider', e, t);
    return false;
  }
  
  return true;
}

async function testChatViaGateway() {
  startGroup('Chat via Gateway Key');
  
  assertDefined(gatewayKey, 'Gateway Key should exist');
  
  const apiHeaders = { Authorization: `Bearer ${gatewayKey}` };
  
  // 测试 1: 非流式聊天
  let t = Date.now();
  try {
    const resp = await httpRequest(TEST_BASE_URL, '/v1/chat/completions', {
      method: 'POST',
      headers: apiHeaders,
      body: {
        model: 'llama-3.3-70b',
        messages: [{ role: 'user', content: 'Say "Hello E2E Test" exactly.' }],
        max_tokens: 50,
      },
    });
    
    assertEqual(resp.status, 200, 'Chat should succeed');
    
    const body = resp.body as {
      choices: Array<{ message: { content: string } }>;
    };
    
    assertDefined(body.choices, 'Response should have choices');
    assert(body.choices.length > 0, 'Should have at least 1 choice');
    assertDefined(body.choices[0].message, 'Choice should have message');
    
    const content = body.choices[0].message.content;
    console.log(`     [Response] ${content.slice(0, 100)}...`);
    
    pass('Non-streaming chat via Gateway', t);
  } catch (e) {
    fail('Non-streaming chat via Gateway', e, t);
  }
  
  // 测试 2: 流式聊天
  t = Date.now();
  try {
    const response = await fetch(`${TEST_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${gatewayKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b',
        messages: [{ role: 'user', content: 'Count from 1 to 3.' }],
        max_tokens: 50,
        stream: true,
      }),
    });
    
    assertEqual(response.status, 200, 'Stream should start');
    assertDefined(response.body, 'Response should have body');
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let chunkCount = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          chunkCount++;
          try {
            const data = JSON.parse(line.slice(6));
            const content = data.choices?.[0]?.delta?.content;
            if (content) fullContent += content;
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
    
    assert(chunkCount > 0, 'Should receive chunks');
    console.log(`     [Stream] Received ${chunkCount} chunks: "${fullContent.slice(0, 50)}..."`);
    
    pass('Streaming chat via Gateway', t);
  } catch (e) {
    fail('Streaming chat via Gateway', e, t);
  }
}

async function testKeyDisableEnable() {
  startGroup('Key Disable/Enable');
  
  assertDefined(sessionToken, 'Session token should exist');
  assertDefined(gatewayKeyId, 'Gateway Key ID should exist');
  assertDefined(gatewayKey, 'Gateway Key should exist');
  
  const authHeaders = { Authorization: `Bearer ${sessionToken}` };
  const apiHeaders = { Authorization: `Bearer ${gatewayKey}` };
  
  // 测试 1: 禁用 Key
  let t = Date.now();
  try {
    const resp = await httpRequest(TEST_BASE_URL, `/internal/gateway-keys/${gatewayKeyId}/disable`, {
      method: 'POST',
      headers: authHeaders,
    });
    
    assertEqual(resp.status, 200, 'Disable should succeed');
    pass('Disable Gateway Key', t);
  } catch (e) {
    fail('Disable Gateway Key', e, t);
  }
  
  // 测试 2: 禁用后 API 调用失败
  t = Date.now();
  try {
    const resp = await httpRequest(TEST_BASE_URL, '/v1/chat/completions', {
      method: 'POST',
      headers: apiHeaders,
      body: {
        model: 'llama-3.3-70b',
        messages: [{ role: 'user', content: 'Test' }],
      },
    });
    
    assertEqual(resp.status, 401, 'API call with disabled key should fail');
    pass('API fails with disabled key', t);
  } catch (e) {
    fail('API fails with disabled key', e, t);
  }
  
  // 测试 3: 重新启用 Key
  t = Date.now();
  try {
    const resp = await httpRequest(TEST_BASE_URL, `/internal/gateway-keys/${gatewayKeyId}/enable`, {
      method: 'POST',
      headers: authHeaders,
    });
    
    assertEqual(resp.status, 200, 'Enable should succeed');
    pass('Enable Gateway Key', t);
  } catch (e) {
    fail('Enable Gateway Key', e, t);
  }
  
  // 测试 4: 启用后 API 调用成功
  t = Date.now();
  try {
    const resp = await httpRequest(TEST_BASE_URL, '/health');
    assertEqual(resp.status, 200, 'API should work again');
    pass('API works after re-enabling key', t);
  } catch (e) {
    fail('API works after re-enabling key', e, t);
  }
}

async function testCleanup() {
  startGroup('Cleanup');
  
  // 测试 1: 删除 Gateway Key
  let t = Date.now();
  try {
    if (gatewayKeyId && sessionToken) {
      const resp = await httpRequest(TEST_BASE_URL, `/internal/gateway-keys/${gatewayKeyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      assertEqual(resp.status, 200, 'Delete key should succeed');
    }
    pass('Delete Gateway Key', t);
  } catch (e) {
    fail('Delete Gateway Key', e, t);
  }
  
  // 测试 2: 停止 HTTP 服务器
  t = Date.now();
  try {
    if (httpServer) {
      await httpServer.stop();
    }
    pass('Stop HTTP Server', t);
  } catch (e) {
    fail('Stop HTTP Server', e, t);
  }
  
  // 测试 3: 清理 AICore
  t = Date.now();
  try {
    if (core) {
      await core.close();
    }
    pass('Close AICore', t);
  } catch (e) {
    fail('Close AICore', e, t);
  }
  
  // 测试 4: 清理 Server
  t = Date.now();
  try {
    if (serverInit) {
      cleanupServer(serverInit);
    }
    pass('Cleanup Server resources', t);
  } catch (e) {
    fail('Cleanup Server resources', e, t);
  }
  
  // 测试 5: 删除测试文件
  t = Date.now();
  try {
    await cleanupTestFiles([TEST_CREDENTIALS_PATH, TEST_KEYS_PATH]);
    pass('Delete test files', t);
  } catch (e) {
    fail('Delete test files', e, t);
  }
}

// ========== 主函数 ==========

export async function runE2ETests(): Promise<boolean> {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║           AI SDK End-to-End Integration Tests                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  await loadEnv();
  
  let hasApiKey = true;
  
  try {
    await testServerInitialization();
    await testAuthentication();
    await testGatewayKeyManagement();
    hasApiKey = await testProviderRegistration();
    
    if (hasApiKey) {
      await testChatViaGateway();
      await testKeyDisableEnable();
    }
  } catch (e) {
    console.error('\n💥 Fatal error:', e);
  } finally {
    await testCleanup();
  }
  
  return hasApiKey;
}

// 直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
  runE2ETests().then(success => {
    process.exit(success ? 0 : 1);
  });
}
