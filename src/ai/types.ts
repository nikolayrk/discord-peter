import { Content } from '@google/genai';

export interface AIRequestParams {
  prompt: string;
  images?: string[];
  history?: Content[];
}

export interface AIProvider {
  generateResponse(params: AIRequestParams): Promise<string>;
  generateStreamingResponse(params: AIRequestParams, onChunk: (chunk: string) => void): Promise<void>;
}

export interface AIResponse {
  text: string;
  error?: string;
}