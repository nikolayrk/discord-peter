import { AIProvider, AIRequestParams } from './types';
import { GeminiProvider } from './providers/gemini';

export class AIService {
  private provider: AIProvider;

  constructor(providerType: string = 'gemini') {
    this.provider = this.initializeProvider(providerType);
  }

  private initializeProvider(type: string): AIProvider {
    switch (type) {
      case 'gemini':
        return new GeminiProvider();
      default:
        throw new Error(`Unsupported AI provider: ${type}`);
    }
  }

  async generateResponse(params: AIRequestParams): Promise<string> {
    return this.provider.generateResponse(params);
  }
}