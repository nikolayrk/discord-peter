export interface AIRequestParams {
  prompt: string;
  images?: string[];
}

export interface AIProvider {
  generateResponse(params: AIRequestParams): Promise<string>;
}

export interface AIResponse {
  text: string;
  error?: string;
}