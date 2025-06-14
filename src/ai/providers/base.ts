import { AIProvider, AIRequestParams } from '../types';

export abstract class BaseAIProvider implements AIProvider {
  abstract generateResponse(params: AIRequestParams): Promise<string>;
  
  protected formatError(error: any): string {
    return `Error generating AI response: ${error.message || 'Unknown error'}`;
  }
}