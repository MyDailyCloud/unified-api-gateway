import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PROVIDER_METADATA } from '@/lib/ai/providers-metadata';

interface ModelSelectorProps {
  provider: string;
  model: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
}

const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  google: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  mistral: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'],
  groq: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
  ollama: ['llama3.2', 'mistral', 'codellama', 'phi'],
  deepseek: ['deepseek-chat', 'deepseek-coder'],
};

export function ModelSelector({ 
  provider, 
  model, 
  onProviderChange, 
  onModelChange 
}: ModelSelectorProps) {
  const providers = Object.keys(PROVIDER_MODELS);
  const models = PROVIDER_MODELS[provider] || [];

  const handleProviderChange = (newProvider: string) => {
    onProviderChange(newProvider);
    const newModels = PROVIDER_MODELS[newProvider];
    if (newModels && newModels.length > 0) {
      onModelChange(newModels[0]);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={provider} onValueChange={handleProviderChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Provider" />
        </SelectTrigger>
        <SelectContent>
          {providers.map((p) => (
            <SelectItem key={p} value={p}>
              <span className="flex items-center gap-2">
                <span>{PROVIDER_METADATA[p]?.icon || '🤖'}</span>
                <span>{PROVIDER_METADATA[p]?.name || p}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={model} onValueChange={onModelChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Model" />
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
