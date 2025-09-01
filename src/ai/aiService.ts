import { AIProvider, AIRequestParams } from './types';
import { GeminiProvider } from './providers/gemini';
import { OpenAIProvider } from './providers/openai';
import { OllamaProvider } from './providers/ollama';

export class AIService {
  private provider: AIProvider;

  constructor(providerType: string = 'gemini') {
    this.provider = this.initializeProvider(providerType);
  }

  private initializeProvider(type: string): AIProvider {
    switch (type) {
      case 'gemini':
        return new GeminiProvider();
      case 'openai':
        return new OpenAIProvider();
      case 'ollama':
        return new OllamaProvider();
      default:
        throw new Error(`Unsupported AI provider: ${type}`);
    }
  }

  async generateResponse(params: AIRequestParams): Promise<string> {
    return this.provider.generateResponse(params);
  }

  async generateStreamingResponse(
    params: AIRequestParams,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    return this.provider.generateStreamingResponse(params, onChunk);
  }
}