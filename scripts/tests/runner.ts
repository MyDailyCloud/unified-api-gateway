/**
 * AI SDK 测试运行器
 * AI SDK Test Runner
 * 
 * 用法:
 *   npx tsx scripts/tests/runner.ts           # 运行所有测试
 *   npx tsx scripts/tests/runner.ts --e2e     # 只运行 E2E 测试
 *   npx tsx scripts/tests/runner.ts --sdk     # 只运行 SDK 组件测试
 */

import { printSummary } from './utils';
import { runE2ETests } from './integration/test-e2e-flow';

async function main() {
  const args = process.argv.slice(2);
  const runAll = args.length === 0 || args.includes('--all');
  const runE2E = runAll || args.includes('--e2e') || args.includes('--integration');
  const runSDK = runAll || args.includes('--sdk');
  
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    AI SDK Test Suite                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\nRun mode: ${runAll ? 'All Tests' : args.join(', ')}`);
  console.log(`Date: ${new Date().toISOString()}\n`);
  
  try {
    // 运行 E2E 测试（服务器初始化、认证、Gateway Key、API 调用）
    if (runE2E) {
      await runE2ETests();
    }
    
    // 打印汇总
    const success = printSummary();
    
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('\n💥 Test runner error:', error);
    process.exit(1);
  }
}

main();
