import { AIProvider, AIRequestParams } from '../types';

export abstract class BaseAIProvider implements AIProvider {
  abstract generateResponse(params: AIRequestParams): Promise<string>;
  
  abstract generateStreamingResponse(
    params: AIRequestParams,
    onChunk: (chunk: string) => void
  ): Promise<void>;
  
  protected formatError(error: any): string {
    return `Error generating AI response: ${error.message || 'Unknown error'}`;
  }
}