export type ProviderCategory = 'cloud' | 'local' | 'china';

export interface ProviderMetadata {
  id: string;
  name: string;
  description: string;
  category: ProviderCategory;
  icon: string;
  docsUrl: string;
  requiresBaseUrl: boolean;
  defaultBaseUrl?: string;
  placeholder?: string;
}

export const PROVIDER_METADATA: Record<string, ProviderMetadata> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4, GPT-3.5 Turbo',
    category: 'cloud',
    icon: '🤖',
    docsUrl: 'https://platform.openai.com/api-keys',
    requiresBaseUrl: false,
    placeholder: 'sk-...',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3.5 Sonnet, Claude 3 Opus',
    category: 'cloud',
    icon: '🧠',
    docsUrl: 'https://console.anthropic.com/',
    requiresBaseUrl: false,
    placeholder: 'sk-ant-...',
  },
  google: {
    id: 'google',
    name: 'Google AI',
    description: 'Gemini Pro, Gemini Ultra',
    category: 'cloud',
    icon: '✨',
    docsUrl: 'https://makersuite.google.com/app/apikey',
    requiresBaseUrl: false,
    placeholder: 'AIza...',
  },
  azure: {
    id: 'azure',
    name: 'Azure OpenAI',
    description: 'Azure-hosted OpenAI models',
    category: 'cloud',
    icon: '☁️',
    docsUrl: 'https://portal.azure.com/',
    requiresBaseUrl: true,
    defaultBaseUrl: 'https://your-resource.openai.azure.com',
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    description: 'Mistral Large, Mixtral',
    category: 'cloud',
    icon: '🌀',
    docsUrl: 'https://console.mistral.ai/',
    requiresBaseUrl: false,
  },
  cohere: {
    id: 'cohere',
    name: 'Cohere',
    description: 'Command R+, Embed',
    category: 'cloud',
    icon: '🔮',
    docsUrl: 'https://dashboard.cohere.com/',
    requiresBaseUrl: false,
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    description: 'Ultra-fast LLM inference',
    category: 'cloud',
    icon: '⚡',
    docsUrl: 'https://console.groq.com/',
    requiresBaseUrl: false,
  },
  together: {
    id: 'together',
    name: 'Together AI',
    description: 'Open source models',
    category: 'cloud',
    icon: '🤝',
    docsUrl: 'https://api.together.xyz/',
    requiresBaseUrl: false,
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Multi-provider gateway',
    category: 'cloud',
    icon: '🔀',
    docsUrl: 'https://openrouter.ai/keys',
    requiresBaseUrl: false,
  },
  cerebras: {
    id: 'cerebras',
    name: 'Cerebras',
    description: 'Wafer-scale AI inference',
    category: 'cloud',
    icon: '🧊',
    docsUrl: 'https://cloud.cerebras.ai/',
    requiresBaseUrl: false,
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek Coder, Chat',
    category: 'china',
    icon: '🔍',
    docsUrl: 'https://platform.deepseek.com/',
    requiresBaseUrl: false,
  },
  qwen: {
    id: 'qwen',
    name: 'Qwen (通义千问)',
    description: 'Alibaba Qwen models',
    category: 'china',
    icon: '🌐',
    docsUrl: 'https://dashscope.console.aliyun.com/',
    requiresBaseUrl: false,
  },
  moonshot: {
    id: 'moonshot',
    name: 'Moonshot (月之暗面)',
    description: 'Kimi AI models',
    category: 'china',
    icon: '🌙',
    docsUrl: 'https://platform.moonshot.cn/',
    requiresBaseUrl: false,
  },
  glm: {
    id: 'glm',
    name: 'GLM (智谱)',
    description: 'ChatGLM models',
    category: 'china',
    icon: '📚',
    docsUrl: 'https://open.bigmodel.cn/',
    requiresBaseUrl: false,
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    description: 'Local model runtime',
    category: 'local',
    icon: '🦙',
    docsUrl: 'https://ollama.ai/',
    requiresBaseUrl: true,
    defaultBaseUrl: 'http://localhost:11434',
  },
  lmstudio: {
    id: 'lmstudio',
    name: 'LM Studio',
    description: 'Local model GUI',
    category: 'local',
    icon: '🎛️',
    docsUrl: 'https://lmstudio.ai/',
    requiresBaseUrl: true,
    defaultBaseUrl: 'http://localhost:1234',
  },
  llamacpp: {
    id: 'llamacpp',
    name: 'llama.cpp',
    description: 'Local GGUF models',
    category: 'local',
    icon: '🔧',
    docsUrl: 'https://github.com/ggerganov/llama.cpp',
    requiresBaseUrl: true,
    defaultBaseUrl: 'http://localhost:8080',
  },
  vllm: {
    id: 'vllm',
    name: 'vLLM',
    description: 'High-throughput inference',
    category: 'local',
    icon: '🚀',
    docsUrl: 'https://vllm.ai/',
    requiresBaseUrl: true,
    defaultBaseUrl: 'http://localhost:8000',
  },
  custom: {
    id: 'custom',
    name: 'Custom Provider',
    description: 'OpenAI-compatible API',
    category: 'local',
    icon: '⚙️',
    docsUrl: '',
    requiresBaseUrl: true,
  },
};

export const PROVIDER_CATEGORIES: Record<ProviderCategory, { name: string; description: string }> = {
  cloud: {
    name: 'Cloud Providers',
    description: 'Commercial AI APIs',
  },
  local: {
    name: 'Local Providers',
    description: 'Self-hosted models',
  },
  china: {
    name: 'China Providers',
    description: 'Chinese AI services',
  },
};

export function getProvidersByCategory(category: ProviderCategory): ProviderMetadata[] {
  return Object.values(PROVIDER_METADATA).filter(p => p.category === category);
}

export function getProviderMetadata(id: string): ProviderMetadata | undefined {
  return PROVIDER_METADATA[id];
}
