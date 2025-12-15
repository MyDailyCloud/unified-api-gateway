/**
 * 测试工具函数
 * Test Utilities
 */

// ========== 测试结果跟踪 ==========

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

export interface TestGroup {
  name: string;
  results: TestResult[];
}

let currentGroup: TestGroup | null = null;
const groups: TestGroup[] = [];

export function startGroup(name: string) {
  currentGroup = { name, results: [] };
  groups.push(currentGroup);
  console.log(`\n📦 ${name}`);
}

export function pass(name: string, startTime: number) {
  const duration = Date.now() - startTime;
  if (currentGroup) {
    currentGroup.results.push({ name, passed: true, duration });
  }
  console.log(`  ✅ ${name} (${duration}ms)`);
}

export function fail(name: string, error: unknown, startTime: number) {
  const duration = Date.now() - startTime;
  const errorMsg = error instanceof Error ? error.message : String(error);
  if (currentGroup) {
    currentGroup.results.push({ name, passed: false, error: errorMsg, duration });
  }
  console.log(`  ❌ ${name} (${duration}ms)`);
  console.log(`     Error: ${errorMsg}`);
}

export function getResults() {
  let totalPassed = 0;
  let totalFailed = 0;
  let totalDuration = 0;

  for (const group of groups) {
    for (const result of group.results) {
      if (result.passed) totalPassed++;
      else totalFailed++;
      totalDuration += result.duration;
    }
  }

  return { groups, totalPassed, totalFailed, totalDuration };
}

export function printSummary() {
  const { groups, totalPassed, totalFailed, totalDuration } = getResults();
  
  console.log('\n' + '═'.repeat(60));
  console.log('                     TEST SUMMARY');
  console.log('═'.repeat(60));
  
  for (const group of groups) {
    const passed = group.results.filter(r => r.passed).length;
    const failed = group.results.filter(r => !r.passed).length;
    const icon = failed === 0 ? '✅' : '❌';
    console.log(`${icon} ${group.name}: ${passed} passed, ${failed} failed`);
  }
  
  console.log('─'.repeat(60));
  console.log(`Total: ${totalPassed} passed, ${totalFailed} failed (${totalDuration}ms)`);
  console.log('═'.repeat(60));
  
  return totalFailed === 0;
}

// ========== 环境加载 ==========

export async function loadEnv(): Promise<Record<string, string>> {
  const env: Record<string, string> = {};
  
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.slice(0, eqIndex).trim();
          let value = trimmed.slice(eqIndex + 1).trim();
          // 移除引号
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          env[key] = value;
          process.env[key] = value;
        }
      }
    }
  } catch (e) {
    // 忽略错误
  }
  
  return env;
}

// ========== HTTP 客户端 ==========

export interface HttpOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export async function httpRequest(
  baseUrl: string,
  path: string,
  options: HttpOptions = {}
): Promise<{ status: number; body: unknown; headers: Headers }> {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  
  let body: unknown;
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    body = await response.json();
  } else {
    body = await response.text();
  }
  
  return { status: response.status, body, headers: response.headers };
}

// ========== 断言工具 ==========

export function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      `${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

export function assertDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`${message || 'Value is null/undefined'}`);
  }
}

export function assertContains(str: string, substring: string, message?: string) {
  if (!str.includes(substring)) {
    throw new Error(
      `${message || 'String does not contain expected substring'}: "${substring}" not in "${str.slice(0, 100)}..."`
    );
  }
}

// ========== 清理工具 ==========

export async function cleanupTestFiles(paths: string[]) {
  const fs = await import('fs');
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
      }
    } catch (e) {
      // 忽略
    }
  }
}

// ========== 延迟 ==========

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
