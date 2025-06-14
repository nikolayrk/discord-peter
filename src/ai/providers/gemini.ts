import { BaseAIProvider } from './base';
import { config } from '../../config/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../../utils/logger';

export class GeminiProvider extends BaseAIProvider {
  private apiKey: string;
  private model: any;

  constructor() {
    super();
    this.apiKey = config.ai.geminiApiKey;
    const genAI = new GoogleGenerativeAI(this.apiKey);
    
    const modelName = config.ai.model;
    logger.info('Initializing with model:', modelName);
    this.model = genAI.getGenerativeModel({ model: modelName });
  }
  
  async generateResponse(prompt: string): Promise<string> {
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      throw new Error(this.formatError(error));
    }
  }
}