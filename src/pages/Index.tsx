import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Brain, 
  Layers, 
  Zap, 
  Shield, 
  Code2, 
  GitBranch,
  Server,
  Cpu,
  Database,
  ArrowRight,
  Check,
  Terminal
} from "lucide-react";

const providers = [
  { name: "OpenAI", models: ["GPT-5", "GPT-4.1", "O3/O4"], color: "bg-emerald-500" },
  { name: "Anthropic", models: ["Claude 4", "Claude 3.5"], color: "bg-amber-500" },
  { name: "Cerebras", models: ["Llama 3.3", "Qwen 3"], color: "bg-blue-500" },
  { name: "GLM", models: ["GLM-4 Plus", "GLM-4V"], color: "bg-purple-500" },
  { name: "Groq", models: ["Llama 3.3", "Mixtral"], color: "bg-orange-500" },
  { name: "DeepSeek", models: ["Chat", "Coder", "Reasoner"], color: "bg-cyan-500" },
  { name: "Moonshot", models: ["V1-8K/32K/128K"], color: "bg-indigo-500" },
  { name: "Qwen", models: ["Max", "Plus", "VL"], color: "bg-rose-500" },
];

const architectureLayers = [
  {
    name: "应用层",
    nameEn: "Application Layer",
    icon: Cpu,
    description: "React Hooks & Components",
    items: ["useAI()", "useChat()", "Provider Components"],
    gradient: "from-violet-500 to-purple-600"
  },
  {
    name: "客户端层",
    nameEn: "Client Layer",
    icon: Server,
    description: "统一入口 & 路由",
    items: ["AIClient", "Provider Registry", "Fallback System"],
    gradient: "from-blue-500 to-cyan-600"
  },
  {
    name: "适配器层",
    nameEn: "Adapter Layer",
    icon: Layers,
    description: "多平台适配",
    items: ["OpenAI", "Anthropic", "Cerebras", "GLM", "..."],
    gradient: "from-emerald-500 to-teal-600"
  },
  {
    name: "基础层",
    nameEn: "Base Layer",
    icon: Database,
    description: "通用功能抽象",
    items: ["Retry Logic", "Error Handling", "SSE Parser"],
    gradient: "from-orange-500 to-amber-600"
  },
];

const codeExamples = {
  register: `import { AIClient } from '@/lib/ai';

const client = new AIClient();

// 注册多个 AI 提供商
client.registerProvider({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
});

client.registerProvider({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
});

client.registerProvider({
  provider: 'cerebras',
  apiKey: process.env.CEREBRAS_API_KEY,
});`,

  chat: `// 非流式调用
const response = await client.chat({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: '你好！' }
  ],
}, 'openai');

// 流式调用
for await (const chunk of client.chatStream({
  model: 'claude-sonnet-4-5',
  messages: [...],
}, 'anthropic')) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}`,

  fallback: `// 带回退的智能调用
const response = await client.chatWithFallback(
  {
    model: 'auto',
    messages: [{ role: 'user', content: '分析这段代码' }],
  },
  ['openai', 'anthropic', 'glm'] // 按优先级尝试
);

console.log(\`使用了: \${response.usedProvider}\`);`,

  hooks: `import { useChat } from '@/lib/ai';

function ChatComponent() {
  const { messages, send, isLoading } = useChat({
    provider: 'openai',
    systemPrompt: 'You are a helpful assistant.',
  });

  return (
    <div>
      {messages.map((m, i) => (
        <div key={i}>{m.role}: {m.content}</div>
      ))}
      <button onClick={() => send('Hello!')}>
        {isLoading ? 'Sending...' : 'Send'}
      </button>
    </div>
  );
}`,
};

const features = [
  { icon: Zap, title: "统一接口", desc: "一套API适配所有平台" },
  { icon: Shield, title: "错误处理", desc: "智能重试 & 回退机制" },
  { icon: GitBranch, title: "流式支持", desc: "原生SSE流式响应" },
  { icon: Code2, title: "类型安全", desc: "完整TypeScript支持" },
];

export default function Index() {
  const [activeTab, setActiveTab] = useState("register");

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        
        <div className="container relative mx-auto px-4 py-20 lg:py-28">
          <div className="flex flex-col items-center text-center">
            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm font-medium">
              <Brain className="mr-2 h-4 w-4" />
              Unified AI SDK v1.0
            </Badge>
            
            <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              多平台 AI 统一适配器
              <span className="mt-2 block bg-gradient-to-r from-primary via-violet-500 to-purple-600 bg-clip-text text-transparent">
                架构设计
              </span>
            </h1>
            
            <p className="mb-8 max-w-2xl text-lg text-muted-foreground">
              一个支持 OpenAI、Anthropic、Cerebras、GLM 等多个 AI 平台的统一适配器架构，
              自适应各个 API 端点，为 Electron 本地应用和未来 AI 项目提供完美的底层支持。
            </p>
            
            <div className="flex flex-wrap justify-center gap-3">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-2 rounded-full bg-muted/50 px-4 py-2 text-sm">
                  <f.icon className="h-4 w-4 text-primary" />
                  <span className="font-medium">{f.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Diagram */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="mb-12 text-center text-3xl font-bold">
          分层架构设计
        </h2>
        
        <div className="mx-auto max-w-4xl space-y-4">
          {architectureLayers.map((layer, index) => (
            <div key={layer.name} className="relative">
              <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
                <div className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${layer.gradient}`} />
                <CardContent className="flex items-center gap-6 p-6 pl-8">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${layer.gradient} text-white shadow-lg`}>
                    <layer.icon className="h-7 w-7" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold">{layer.name}</h3>
                      <span className="text-sm text-muted-foreground">/ {layer.nameEn}</span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{layer.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {layer.items.map((item, i) => (
                        <Badge key={i} variant="outline" className="font-mono text-xs">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
              {index < architectureLayers.length - 1 && (
                <div className="ml-8 flex h-4 items-center justify-start">
                  <div className="h-full w-0.5 bg-border" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Supported Providers */}
      <section className="border-y border-border/40 bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-3xl font-bold">
            支持的 AI 平台
          </h2>
          
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-4">
            {providers.map((provider) => (
              <Card key={provider.name} className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                <div className={`absolute inset-x-0 top-0 h-1 ${provider.color}`} />
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${provider.color}`} />
                    <h3 className="font-semibold">{provider.name}</h3>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {provider.models.map((model, i) => (
                      <span key={i} className="text-xs text-muted-foreground">
                        {model}{i < provider.models.length - 1 && ", "}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Code Examples */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="mb-12 text-center text-3xl font-bold">
          代码示例
        </h2>
        
        <div className="mx-auto max-w-4xl">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6 grid w-full grid-cols-4">
              <TabsTrigger value="register" className="text-sm">
                注册提供商
              </TabsTrigger>
              <TabsTrigger value="chat" className="text-sm">
                发送消息
              </TabsTrigger>
              <TabsTrigger value="fallback" className="text-sm">
                智能回退
              </TabsTrigger>
              <TabsTrigger value="hooks" className="text-sm">
                React Hooks
              </TabsTrigger>
            </TabsList>
            
            {Object.entries(codeExamples).map(([key, code]) => (
              <TabsContent key={key} value={key}>
                <Card className="overflow-hidden border-2">
                  <CardHeader className="border-b bg-muted/50 py-3">
                    <div className="flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">TypeScript</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <pre className="overflow-x-auto p-6 text-sm">
                      <code className="text-foreground/90">{code}</code>
                    </pre>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="border-t border-border/40 bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-3xl font-bold">
            核心优势
          </h2>
          
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "统一类型定义",
                desc: "Message、Request、Response 等类型统一，切换平台无需改代码",
                items: ["TypeScript 完整支持", "类型推导友好", "IDE 自动补全"],
              },
              {
                title: "智能适配转换",
                desc: "自动处理各平台 API 差异，如 Anthropic 的 messages 格式转换",
                items: ["请求格式自动转换", "响应格式统一", "参数差异兼容"],
              },
              {
                title: "企业级可靠性",
                desc: "内置重试、超时、错误处理，生产环境开箱即用",
                items: ["指数退避重试", "速率限制处理", "多提供商回退"],
              },
              {
                title: "流式原生支持",
                desc: "SSE 流解析器支持所有平台的实时流式响应",
                items: ["AsyncIterable API", "分块解析", "中断支持"],
              },
              {
                title: "Electron 友好",
                desc: "纯 TypeScript 实现，完美支持 Electron 主进程/渲染进程",
                items: ["无 Node 特定依赖", "IPC 通信友好", "安全存储集成"],
              },
              {
                title: "扩展性设计",
                desc: "BaseAdapter 抽象，添加新平台只需继承并实现少量方法",
                items: ["适配器模式", "自定义适配器", "插件化架构"],
              },
            ].map((item, i) => (
              <Card key={i} className="transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                <CardHeader>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription>{item.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {item.items.map((point, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-primary" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Unified AI SDK - 为多 AI 应用提供完美的底层架构支持</p>
        </div>
      </footer>
    </div>
  );
}
