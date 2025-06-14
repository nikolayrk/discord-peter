export interface AIProvider {
  generateResponse(prompt: string): Promise<string>;
}

export interface AIResponse {
  text: string;
  error?: string;
}