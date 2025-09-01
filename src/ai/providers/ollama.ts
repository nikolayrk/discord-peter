import { BaseAIProvider } from './base';
import { config } from '../../config/config';
import { logger } from '../../utils/logger';
import { AIRequestParams, ModelOverloadedError } from '../types';
import { Content } from '@google/genai';

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
}

interface OllamaRequest {
  model: string;
  messages: OllamaMessage[];
  stream: boolean;
  options?: {
    num_predict?: number;
  };
}

interface OllamaResponse {
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

export class OllamaProvider extends BaseAIProvider {
  private baseUrl: string;
  private modelName: string;

  constructor() {
    super();
    
    // Use direct Ollama API (usually port 11434) instead of Open WebUI
    this.baseUrl = config.ai.ollamaUrl;
    this.modelName = config.ai.textModel;
    
    logger.info('Using native Ollama API at:', this.baseUrl);
    logger.info('Using Ollama model:', this.modelName);
  }
  
  async generateResponse(params: AIRequestParams): Promise<string> {
    const { prompt, images, history } = params;

    try {
      const messages = await this.buildMessages(prompt, images, history);
      
      logger.debug(`Ollama request - Model: ${this.modelName}, Messages: ${messages.length}, Has images: ${!!(images && images.length > 0)}`);
      if (images && images.length > 0) {
        logger.debug(`Image count: ${images.length}`);
      }

      const requestBody: OllamaRequest = {
        model: this.modelName,
        messages,
        stream: false,
        options: {
          num_predict: 2000
        }
      };

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data: OllamaResponse = await response.json();
      return data.message.content || 'Empty response';
    } catch (error) {
      logger.error('Ollama API error:', error);
      throw new Error(this.formatError(error));
    }
  }

  async generateStreamingResponse(
    params: AIRequestParams,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const { prompt, images, history } = params;
      
    try {
      const messages = await this.buildMessages(prompt, images, history);
      
      logger.debug(`Ollama streaming request - Model: ${this.modelName}, Messages: ${messages.length}, Has images: ${!!(images && images.length > 0)}`);
      if (images && images.length > 0) {
        logger.debug(`Image count: ${images.length}`);
      }

      const requestBody: OllamaRequest = {
        model: this.modelName,
        messages,
        stream: true,
        options: {
          num_predict: 2000
        }
      };

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data: OllamaResponse = JSON.parse(line);
              if (data.message?.content) {
                onChunk(data.message.content);
              }
            } catch (parseError) {
              logger.warn('Failed to parse Ollama response line:', line);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Ollama API streaming error:', error);
      const errorMessage = this.formatError(error);
      if (errorMessage.includes('503') || errorMessage.includes('overloaded') || errorMessage.includes('rate limit')) {
        throw new ModelOverloadedError('The model is currently overloaded or rate limited.');
      }
      throw new Error(errorMessage);
    }
  }

  private async buildMessages(prompt: string, images: string[] = [], history: Content[] = []): Promise<OllamaMessage[]> {
    const messages: OllamaMessage[] = [];

    // Add system message
    messages.push({
      role: 'system',
      content: config.systemInstruction
    });

    // Convert history to Ollama format
    if (history.length > 0) {
      const convertedHistory = this.convertHistoryToOllama(history);
      messages.push(...convertedHistory);
    }

    // Build current user message with images
    const userMessage: OllamaMessage = {
      role: 'user',
      content: prompt
    };

    // Add images to the message if present
    if (images && images.length > 0) {
      userMessage.images = await this.processImages(images);
      logger.debug(`Added ${userMessage.images.length} images to Ollama message`);
    }

    messages.push(userMessage);
    return messages;
  }

  private convertHistoryToOllama(history: Content[]): OllamaMessage[] {
    return history.map(msg => ({
      role: msg.role === 'model' ? 'assistant' as const : 'user' as const,
      content: msg.parts?.map(part => part.text).join(' ') || ''
    }));
  }

  private async processImages(images: string[]): Promise<string[]> {
    const processedImages: string[] = [];
    
    for (const imageUrl of images) {
      try {
        logger.debug(`Processing image: ${imageUrl}`);
        const response = await fetch(imageUrl);
        if (!response.ok) {
          logger.error(`Failed to fetch image: ${response.status} ${response.statusText}`);
          continue;
        }
        
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        processedImages.push(base64);
        logger.debug(`Successfully converted image to base64 (${base64.length} chars)`);
      } catch (error) {
        logger.error(`Error processing image ${imageUrl}:`, error);
      }
    }
    
    return processedImages;
  }

  protected formatError(error: any): string {
    if (error?.message) {
      return `Ollama API error: ${error.message}`;
    }
    return `Ollama API error: ${error.toString()}`;
  }
}
