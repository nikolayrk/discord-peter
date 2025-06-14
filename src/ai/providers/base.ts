import { AIProvider } from '../types';

export abstract class BaseAIProvider implements AIProvider {
  abstract generateResponse(prompt: string): Promise<string>;
  
  protected formatError(error: any): string {
    return `Error generating AI response: ${error.message || 'Unknown error'}`;
  }
}