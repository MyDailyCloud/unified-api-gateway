import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VersionInfo } from "@/components/VersionInfo";
import { 
  ArrowLeftRight,
  Layers, 
  Zap, 
  Shield, 
  Code2, 
  Server,
  Cpu,
  ArrowRight,
  Check,
  Terminal,
  Globe,
  HardDrive,
  RefreshCw,
  Coins,
  Radio,
  Route,
  Shuffle,
  Settings
} from "lucide-react";

// Provider categories
const cloudProviders = [
  { name: "OpenAI", models: ["GPT-4o", "GPT-4", "O3/O4-mini"], color: "hsl(142 76% 36%)" },
  { name: "Anthropic", models: ["Claude 4", "Claude 3.5"], color: "hsl(43 96% 56%)" },
  { name: "Google", models: ["Gemini 2.0", "Gemini Pro"], color: "hsl(217 91% 60%)" },
  { name: "Cohere", models: ["Command R+", "Command"], color: "hsl(280 70% 50%)" },
  { name: "Mistral", models: ["Large", "Medium", "Small"], color: "hsl(25 95% 53%)" },
  { name: "DeepSeek", models: ["Chat", "Coder", "R1"], color: "hsl(188 78% 41%)" },
];

const localEngines = [
  { name: "Ollama", desc: "本地模型管理", icon: HardDrive },
  { name: "vLLM", desc: "高性能推理", icon: Zap },
  { name: "LM Studio", desc: "桌面应用", icon: Cpu },
  { name: "llama.cpp", desc: "原生推理", icon: Terminal },
];

const endpoints = [
  { path: "/v1/openai/chat/completions", format: "OpenAI", desc: "Chat Completions API" },
  { path: "/v1/anthropic/messages", format: "Anthropic", desc: "Messages API" },
  { path: "/v1/google/generateContent", format: "Google", desc: "Gemini API" },
  { path: "/v1/cohere/chat", format: "Cohere", desc: "Chat API" },
];

// Independent formats with dedicated normalizers
const independentFormats = [
  { id: 'openai', name: 'OpenAI', borderColor: 'border-emerald-500/50', bgColor: 'bg-emerald-500/10', textColor: 'text-emerald-600 dark:text-emerald-400' },
  { id: 'anthropic', name: 'Anthropic', borderColor: 'border-amber-500/50', bgColor: 'bg-amber-500/10', textColor: 'text-amber-600 dark:text-amber-400' },
  { id: 'google', name: 'Google', borderColor: 'border-blue-500/50', bgColor: 'bg-blue-500/10', textColor: 'text-blue-600 dark:text-blue-400' },
  { id: 'cohere', name: 'Cohere', borderColor: 'border-purple-500/50', bgColor: 'bg-purple-500/10', textColor: 'text-purple-600 dark:text-purple-400' },
  { id: 'ollama', name: 'Ollama', borderColor: 'border-orange-500/50', bgColor: 'bg-orange-500/10', textColor: 'text-orange-600 dark:text-orange-400' },
  { id: 'llamacpp', name: 'llama.cpp', borderColor: 'border-slate-500/50', bgColor: 'bg-slate-500/10', textColor: 'text-slate-600 dark:text-slate-400' },
];

// OpenAI-compatible formats (use openaiNormalizer)
const openaiCompatibleFormats = [
  { id: 'mistral', name: 'Mistral' },
  { id: 'vllm', name: 'vLLM' },
  { id: 'lmstudio', name: 'LM Studio' },
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'moonshot', name: 'Moonshot' },
  { id: 'qwen', name: 'Qwen' },
  { id: 'glm', name: 'GLM' },
  { id: 'groq', name: 'Groq' },
  { id: 'together', name: 'Together' },
  { id: 'openrouter', name: 'OpenRouter' },
  { id: 'azure', name: 'Azure OpenAI' },
  { id: 'cerebras', name: 'Cerebras' },
];

const routingStrategies = [
  { name: "Model Match", icon: Route, desc: "按模型名自动选择后端" },
  { name: "Cost Optimized", icon: Coins, desc: "优先选择成本最低后端" },
  { name: "Least Latency", icon: Zap, desc: "选择延迟最低的后端" },
  { name: "Round Robin", icon: RefreshCw, desc: "轮询分配负载" },
];

const codeExamples = {
  gateway: `import { AIGateway } from '@/lib/ai/gateway';

const gateway = new AIGateway({
  backends: [
    { name: 'openai', provider: 'openai', priority: 1 },
    { name: 'ollama', provider: 'ollama', 
      baseURL: 'http://localhost:11434/v1' },
    { name: 'fallback', provider: 'together', priority: 3 },
  ],
  routing: { 
    strategy: 'model-match', 
    autoFailover: true 
  },
  modelAliases: { 
    'gpt-4': 'ollama/llama3.2'  // 本地替代
  },
});`,

  any2any: `// 🎯 Any2Any 格式转换 - 核心能力!

// OpenAI 格式输入 → Anthropic 格式输出
const response = await gateway.handleRequest(
  openaiRequest,    // OpenAI 格式的请求体
  'openai',         // 输入格式
  'anthropic'       // 输出格式 ✨
);

// 或者通过 HTTP Header 控制
fetch('/v1/openai/chat/completions', {
  headers: {
    'X-Response-Format': 'anthropic'  // 魔法在这里!
  },
  body: JSON.stringify(openaiRequest)
});`,

  endpoints: `// 多格式端点 - 同时支持所有主流 API 格式
import { createGatewayServer } from '@/lib/ai/gateway';

const server = createGatewayServer(gateway);

// Edge Function / Express 路由
app.use('/v1/openai/*', server.createHandler('openai'));
app.use('/v1/anthropic/*', server.createHandler('anthropic'));
app.use('/v1/google/*', server.createHandler('google'));
app.use('/v1/cohere/*', server.createHandler('cohere'));

// 或使用统一路由器自动识别
app.use('/v1/*', server.createUnifiedHandler());`,

  streaming: `// 流式响应 - 所有格式都支持 SSE
for await (const chunk of gateway.handleStreamRequest(
  request,
  'openai',      // 输入格式
  'anthropic'    // 输出格式 (可选)
)) {
  // 自动转换为目标格式的流式事件
  console.log(chunk);
}

// 响应格式自动匹配:
// OpenAI:    data: {"choices":[{"delta":{"content":"..."}}]}
// Anthropic: data: {"type":"content_block_delta","delta":{...}}`,
};

const coreAdvantages = [
  {
    icon: Shuffle,
    title: "格式自由",
    desc: "任意输入格式，任意输出格式",
    items: ["OpenAI ⇆ Anthropic", "Google ⇆ Cohere", "任意组合转换"],
  },
  {
    icon: HardDrive,
    title: "本地优先",
    desc: "优先路由到本地推理引擎，降低成本",
    items: ["Ollama 集成", "vLLM 支持", "云端自动回退"],
  },
  {
    icon: Shield,
    title: "智能回退",
    desc: "本地不可用自动切换到云端",
    items: ["熔断器保护", "指数退避重试", "多级回退链"],
  },
  {
    icon: Coins,
    title: "成本优化",
    desc: "按 Token 成本自动选择最优后端",
    items: ["实时成本追踪", "预算控制", "用量统计"],
  },
  {
    icon: Radio,
    title: "流式支持",
    desc: "任意格式都支持 SSE 流式响应",
    items: ["格式自动转换", "AsyncIterable", "中断支持"],
  },
  {
    icon: Code2,
    title: "类型安全",
    desc: "完整 TypeScript 类型定义",
    items: ["类型推导", "IDE 补全", "编译时检查"],
  },
];

export default function Index() {
  const [activeTab, setActiveTab] = useState("gateway");
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent" />
        
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-4 top-1/4 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -right-4 top-1/2 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        </div>
        
        <div className="container relative mx-auto px-4 py-20 lg:py-32">
          <div className="flex flex-col items-center text-center">
            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm font-medium border border-primary/20 bg-primary/5">
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Universal AI Gateway
            </Badge>
            
            <h1 className="mb-6 text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Any2Any
              <span className="mt-2 block bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                API
              </span>
            </h1>
            
            <p className="mb-8 max-w-2xl text-lg text-muted-foreground lg:text-xl">
              任意 AI API 格式互转网关。接收 OpenAI、Anthropic、Google、Cohere 任意格式，
              智能路由到最优后端，返回您期望的<strong className="text-foreground">任意格式</strong>。
            </p>
            
            {/* Format flow visualization */}
            <div className="mb-10 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border/50 bg-card/50 px-6 py-4 backdrop-blur-sm">
              <Badge variant="outline" className="border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">OpenAI</Badge>
              <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400">Anthropic</Badge>
              <Badge variant="outline" className="border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400">Google</Badge>
              <Badge variant="outline" className="border-purple-500/50 bg-purple-500/10 text-purple-600 dark:text-purple-400">Cohere</Badge>
              <ArrowRight className="mx-2 h-5 w-5 text-muted-foreground" />
              <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5">
                <Shuffle className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-primary">Any2Any</span>
              </div>
              <ArrowRight className="mx-2 h-5 w-5 text-muted-foreground" />
              <Badge variant="outline" className="border-primary/50 bg-primary/10 text-primary">任意格式</Badge>
            </div>
            
            <div className="flex flex-wrap justify-center gap-4">
              {[
                { icon: Shuffle, label: "格式自由" },
                { icon: Route, label: "智能路由" },
                { icon: HardDrive, label: "本地优先" },
                { icon: Radio, label: "流式支持" },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-4 py-2 text-sm backdrop-blur-sm">
                  <f.icon className="h-4 w-4 text-primary" />
                  <span className="font-medium">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Any2Any Flow Diagram */}
      <section className="container mx-auto px-4 py-16 lg:py-24">
        <h2 className="mb-4 text-center text-3xl font-bold lg:text-4xl">
          Any2Any 转换流程
        </h2>
        <p className="mb-12 text-center text-muted-foreground">
          双向格式转换：任意格式输入，任意格式输出
        </p>
        
        <div className="mx-auto max-w-5xl">
          {/* Flow diagram */}
          <div className="grid gap-4 lg:grid-cols-5">
            {/* Input Column */}
            <div className="space-y-3 lg:col-span-1">
              <div className="mb-4 text-center text-sm font-semibold text-muted-foreground">INPUT</div>
              {["OpenAI", "Anthropic", "Google", "Cohere"].map((format, i) => (
                <Card key={format} className="border-border/50 bg-card/50 transition-all hover:border-primary/50 hover:shadow-md">
                  <CardContent className="flex items-center gap-2 p-3">
                    <div className={`h-2 w-2 rounded-full ${
                      i === 0 ? "bg-emerald-500" : 
                      i === 1 ? "bg-amber-500" : 
                      i === 2 ? "bg-blue-500" : "bg-purple-500"
                    }`} />
                    <span className="text-sm font-medium">{format}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Arrow */}
            <div className="flex items-center justify-center lg:col-span-1">
              <ArrowRight className="h-8 w-8 rotate-90 text-muted-foreground/50 lg:rotate-0" />
            </div>
            
            {/* Center - Unified + Router */}
            <div className="space-y-4 lg:col-span-1">
              <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
                <CardContent className="p-4 text-center">
                  <Layers className="mx-auto mb-2 h-8 w-8 text-primary" />
                  <div className="font-semibold">Unified Format</div>
                  <div className="text-xs text-muted-foreground">统一中间格式</div>
                </CardContent>
              </Card>
              
              <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
                <CardContent className="p-4 text-center">
                  <Route className="mx-auto mb-2 h-8 w-8 text-primary" />
                  <div className="font-semibold">Smart Router</div>
                  <div className="mt-2 flex flex-wrap justify-center gap-1">
                    {routingStrategies.map((s) => (
                      <Badge key={s.name} variant="outline" className="text-xs border-primary/30">
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border border-border/50 bg-card/50">
                <CardContent className="p-4 text-center">
                  <Server className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                  <div className="text-sm font-medium">Backends</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Cloud & Local
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Arrow */}
            <div className="flex items-center justify-center lg:col-span-1">
              <ArrowRight className="h-8 w-8 rotate-90 text-muted-foreground/50 lg:rotate-0" />
            </div>
            
            {/* Output Column */}
            <div className="space-y-3 lg:col-span-1">
              <div className="mb-4 text-center text-sm font-semibold text-muted-foreground">OUTPUT</div>
              {["OpenAI", "Anthropic", "Google", "Cohere"].map((format, i) => (
                <Card key={format} className="border-border/50 bg-card/50 transition-all hover:border-primary/50 hover:shadow-md">
                  <CardContent className="flex items-center gap-2 p-3">
                    <div className={`h-2 w-2 rounded-full ${
                      i === 0 ? "bg-emerald-500" : 
                      i === 1 ? "bg-amber-500" : 
                      i === 2 ? "bg-blue-500" : "bg-purple-500"
                    }`} />
                    <span className="text-sm font-medium">{format}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Conversion Matrix Section */}
      <section className="border-y border-border/40 bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-4 text-center text-3xl font-bold lg:text-4xl">
            转换矩阵
          </h2>
          <p className="mb-12 text-center text-muted-foreground">
            6 种独立格式 × 6 = <strong className="text-foreground">36</strong> 种转换组合，全部支持
          </p>
          
          <div className="mx-auto max-w-4xl overflow-x-auto">
            <TooltipProvider delayDuration={100}>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-3 text-left text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">INPUT</span>
                        <ArrowRight className="h-3 w-3" />
                        <span className="font-medium">OUTPUT</span>
                      </div>
                    </th>
                    {independentFormats.map((f, colIndex) => (
                      <th 
                        key={f.id} 
                        className={`p-3 text-center transition-all duration-200 ${
                          hoveredCell?.col === colIndex ? 'bg-primary/10' : ''
                        }`}
                      >
                        <Badge 
                          variant="outline" 
                          className={`${f.borderColor} ${f.bgColor} ${f.textColor} transition-transform duration-200 ${
                            hoveredCell?.col === colIndex ? 'scale-105' : ''
                          }`}
                        >
                          {f.name}
                        </Badge>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {independentFormats.map((input, rowIndex) => (
                    <tr 
                      key={input.id} 
                      className={`border-t border-border/50 transition-all duration-200 ${
                        hoveredCell?.row === rowIndex ? 'bg-primary/10' : ''
                      }`}
                    >
                      <td className={`p-3 transition-all duration-200 ${
                        hoveredCell?.row === rowIndex ? 'bg-primary/10' : ''
                      }`}>
                        <Badge 
                          variant="outline" 
                          className={`${input.borderColor} ${input.bgColor} ${input.textColor} transition-transform duration-200 ${
                            hoveredCell?.row === rowIndex ? 'scale-105' : ''
                          }`}
                        >
                          {input.name}
                        </Badge>
                      </td>
                      {independentFormats.map((output, colIndex) => (
                        <td 
                          key={output.id} 
                          className={`p-3 text-center transition-all duration-200 ${
                            hoveredCell?.row === rowIndex && hoveredCell?.col === colIndex
                              ? 'bg-primary/20'
                              : hoveredCell?.row === rowIndex || hoveredCell?.col === colIndex
                              ? 'bg-primary/10'
                              : ''
                          }`}
                          onMouseEnter={() => setHoveredCell({ row: rowIndex, col: colIndex })}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 transition-all duration-200 cursor-pointer ${
                                hoveredCell?.row === rowIndex && hoveredCell?.col === colIndex
                                  ? 'bg-primary/30 scale-110 shadow-lg shadow-primary/20'
                                  : 'hover:bg-primary/20'
                              }`}>
                                <Check className={`h-4 w-4 text-primary transition-transform duration-200 ${
                                  hoveredCell?.row === rowIndex && hoveredCell?.col === colIndex ? 'scale-110' : ''
                                }`} />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="font-medium">
                              {input.name} → {output.name}
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TooltipProvider>
          </div>
          
          {/* OpenAI Compatible Formats */}
          <div className="mx-auto mt-12 max-w-4xl">
            <div className="rounded-xl border border-border/50 bg-card/50 p-6">
              <div className="mb-4 flex items-center gap-2">
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/50" variant="outline">
                  OpenAI 兼容
                </Badge>
                <span className="text-sm text-muted-foreground">
                  以下格式使用 OpenAI 标准，自动支持与所有格式互转
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {openaiCompatibleFormats.map((f) => (
                  <Badge 
                    key={f.id} 
                    variant="outline" 
                    className="border-border bg-background/50"
                  >
                    {f.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          
          {/* Matrix Stats */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              ✓ 总计 <strong className="text-foreground">{independentFormats.length + openaiCompatibleFormats.length}</strong> 种格式 
              • <strong className="text-foreground">{(independentFormats.length + openaiCompatibleFormats.length) ** 2}</strong> 种转换组合
            </p>
          </div>
        </div>
      </section>

      {/* Endpoints Section */}
      <section className="border-y border-border/40 bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-4 text-center text-3xl font-bold">
            多格式端点
          </h2>
          <p className="mb-12 text-center text-muted-foreground">
            一个网关，支持所有主流 AI API 格式
          </p>
          
          <div className="mx-auto max-w-4xl space-y-3">
            {endpoints.map((ep) => (
              <Card key={ep.path} className="overflow-hidden transition-all hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-4">
                  <Badge className="shrink-0 bg-primary/10 text-primary hover:bg-primary/20">POST</Badge>
                  <code className="flex-1 font-mono text-sm">{ep.path}</code>
                  <Badge variant="outline" className="shrink-0">{ep.format}</Badge>
                  <span className="hidden text-sm text-muted-foreground sm:inline">{ep.desc}</span>
                </CardContent>
              </Card>
            ))}
            
            {/* X-Response-Format hint */}
            <Card className="mt-6 border-dashed border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Zap className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <div className="font-semibold">跨格式响应</div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      使用 <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">X-Response-Format</code> 请求头
                      控制响应格式。例如：用 OpenAI 格式请求，返回 Anthropic 格式响应！
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Supported Platforms */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="mb-4 text-center text-3xl font-bold">
          支持的平台
        </h2>
        <p className="mb-12 text-center text-muted-foreground">
          云端 API 和本地推理引擎，一个网关全部支持
        </p>
        
        <div className="mx-auto max-w-5xl">
          {/* Cloud APIs */}
          <div className="mb-8">
            <div className="mb-4 flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Cloud APIs</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {cloudProviders.map((provider) => (
                <Card key={provider.name} className="group overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5">
                  <div className="h-1" style={{ backgroundColor: provider.color }} />
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: provider.color }} />
                      <span className="font-medium">{provider.name}</span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {provider.models.join(", ")}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          
          {/* Local Engines */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Local Engines</h3>
              <Badge variant="secondary" className="text-xs">本地优先</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {localEngines.map((engine) => (
                <Card key={engine.name} className="group overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <engine.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{engine.name}</div>
                      <div className="text-xs text-muted-foreground">{engine.desc}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Code Examples */}
      <section className="border-y border-border/40 bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-4 text-center text-3xl font-bold">
            代码示例
          </h2>
          <p className="mb-12 text-center text-muted-foreground">
            简洁的 API，强大的功能
          </p>
          
          <div className="mx-auto max-w-4xl">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-6 grid w-full grid-cols-2 lg:grid-cols-4">
                <TabsTrigger value="gateway" className="text-sm">
                  网关初始化
                </TabsTrigger>
                <TabsTrigger value="any2any" className="text-sm">
                  Any2Any 转换
                </TabsTrigger>
                <TabsTrigger value="endpoints" className="text-sm">
                  多端点
                </TabsTrigger>
                <TabsTrigger value="streaming" className="text-sm">
                  流式响应
                </TabsTrigger>
              </TabsList>
              
              {Object.entries(codeExamples).map(([key, code]) => (
                <TabsContent key={key} value={key}>
                  <Card className="overflow-hidden border-2">
                    <CardHeader className="border-b bg-card py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <div className="h-3 w-3 rounded-full bg-destructive/60" />
                          <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                          <div className="h-3 w-3 rounded-full bg-green-500/60" />
                        </div>
                        <span className="ml-2 text-sm font-medium text-muted-foreground">TypeScript</span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <pre className="overflow-x-auto bg-muted/50 p-6 text-sm">
                        <code className="text-foreground/90">{code}</code>
                      </pre>
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>
      </section>

      {/* Core Advantages */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="mb-4 text-center text-3xl font-bold">
          核心优势
        </h2>
        <p className="mb-12 text-center text-muted-foreground">
          为多 AI 应用场景设计
        </p>
        
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2 lg:grid-cols-3">
          {coreAdvantages.map((item, i) => (
            <Card key={i} className="group transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <item.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">{item.title}</CardTitle>
                <CardDescription>{item.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {item.items.map((point, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                      {point}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Routing Strategies */}
      <section className="border-t border-border/40 bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-4 text-center text-3xl font-bold">
            智能路由策略
          </h2>
          <p className="mb-12 text-center text-muted-foreground">
            根据需求自动选择最优后端
          </p>
          
          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 lg:grid-cols-4">
            {routingStrategies.map((strategy) => (
              <Card key={strategy.name} className="text-center transition-all hover:shadow-md hover:-translate-y-0.5">
                <CardContent className="p-6">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <strategy.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="font-semibold">{strategy.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{strategy.desc}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="text-center sm:text-left">
              <div className="mb-1 text-xl font-bold">
                Any2Any<span className="text-primary"> API</span>
              </div>
              <p className="text-sm text-muted-foreground">
                任意 AI API 格式互转网关
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin" className="gap-2">
                <Settings className="h-4 w-4" />
                Admin Dashboard
              </Link>
            </Button>
          </div>
          
          {/* Version Info */}
          <div className="mt-6 border-t border-border/30 pt-6">
            <VersionInfo />
          </div>
        </div>
      </footer>
    </div>
  );
}
