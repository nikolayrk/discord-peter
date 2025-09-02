import { BaseAIProvider } from './base';
import { config } from '../../config/config';
import OpenAI from 'openai';
import { logger } from '../../utils/logger';
import { AIRequestParams, ModelOverloadedError } from '../types';
import { Content } from '@google/genai';

export class OpenAIProvider extends BaseAIProvider {
  private client!: OpenAI;
  private textModelName!: string;
  private visionModelName!: string;

  constructor() {
    super();
    
    const {
      client,
      textModelName,
      visionModelName
    } = this.initializeModels(config.ai.openaiApiKey, config.ai.openaiBaseUrl);

    this.client = client;
    this.textModelName = textModelName;
    this.visionModelName = visionModelName;
  }

  private initializeModels(apiKey: string, baseUrl?: string): {
    client: OpenAI,
    textModelName: string,
    visionModelName: string } {
    
    const clientOptions: { apiKey: string; baseURL?: string } = { apiKey };
    if (baseUrl) {
      clientOptions.baseURL = baseUrl;
      logger.info('Using custom OpenAI base URL:', baseUrl);
    }
    
    const client = new OpenAI(clientOptions);
    
    const textModelName = config.ai.textModel;
    const visionModelName = config.ai.visionModel;
    
    logger.info('Using OpenAI with text model:', textModelName);
    logger.info('Using OpenAI with vision model:', visionModelName);

    return { client, textModelName, visionModelName };
  }
  
  async generateResponse(params: AIRequestParams): Promise<string> {
    const { prompt, images, history } = params;
    
    // For local models like Ollama, use the same model for both text and vision
    const isLikelyLocalModel = this.textModelName.includes(':') || 
                              this.textModelName.startsWith('llama') || 
                              this.textModelName.startsWith('gemma') ||
                              this.textModelName.startsWith('mistral');
    
    const modelName = isLikelyLocalModel ? this.textModelName : 
                     ((!images || images.length === 0) ? this.textModelName : this.visionModelName);

    try {
      const messages = this.buildMessages(prompt, images, history);
      
      logger.debug(`OpenAI request - Model: ${modelName}, Messages: ${messages.length}, Has images: ${!!(images && images.length > 0)}`);
      if (images && images.length > 0) {
        logger.debug(`Image URLs: ${images.join(', ')}`);
      }

      const response = await this.client.chat.completions.create({
        model: modelName,
        messages,
        max_tokens: 2000,
      });

      return response.choices[0]?.message?.content || 'Empty response';
    } catch (error) {
      logger.error('OpenAI API error:', error);
      throw new Error(this.formatError(error));
    }
  }

  async generateStreamingResponse(
    params: AIRequestParams,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const { prompt, images, history } = params;
    
    // For local models like Ollama, use the same model for both text and vision
    const isLikelyLocalModel = this.textModelName.includes(':') || 
                              this.textModelName.startsWith('llama') || 
                              this.textModelName.startsWith('gemma') ||
                              this.textModelName.startsWith('mistral');
    
    const modelName = isLikelyLocalModel ? this.textModelName : 
                     ((!images || images.length === 0) ? this.textModelName : this.visionModelName);
      
    try {
      const messages = this.buildMessages(prompt, images, history);
      
      logger.debug(`OpenAI streaming request - Model: ${modelName}, Messages: ${messages.length}, Has images: ${!!(images && images.length > 0)}`);
      if (images && images.length > 0) {
        logger.debug(`Image URLs: ${images.join(', ')}`);
        logger.debug(`User message content type: ${typeof messages[messages.length - 1].content}`);
        logger.debug(`Final user message content: ${JSON.stringify(messages[messages.length - 1].content).substring(0, 200)}...`);
        if (Array.isArray(messages[messages.length - 1].content)) {
          logger.debug(`Multimodal content parts: ${(messages[messages.length - 1].content as any[]).length}`);
        }
      }

      const stream = await this.client.chat.completions.create({
        model: modelName,
        messages,
        max_tokens: 2000,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          onChunk(content);
        }
      }
    } catch (error) {
      logger.error('OpenAI API streaming error:', error);
      const errorMessage = this.formatError(error);
      if (errorMessage.includes('503') || errorMessage.includes('overloaded') || errorMessage.includes('rate limit')) {
        throw new ModelOverloadedError('The model is currently overloaded or rate limited.');
      }
      throw new Error(errorMessage);
    }
  }

  private buildMessages(prompt: string, images: string[] = [], history: Content[] = []): OpenAI.ChatCompletionMessageParam[] {
    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    // Add system message
    messages.push({
      role: 'system',
      content: config.systemInstruction
    });

    // Convert history to OpenAI format
    if (history.length > 0) {
      const convertedHistory = this.convertHistoryToOpenAI(history);
      messages.push(...convertedHistory);
    }

    // Build current user message
    const userMessage: OpenAI.ChatCompletionMessageParam = {
      role: 'user',
      content: this.buildUserContent(prompt, images)
    };

    messages.push(userMessage);
    return messages;
  }

  private convertHistoryToOpenAI(history: Content[]): OpenAI.ChatCompletionMessageParam[] {
    return history.map(msg => ({
      role: msg.role === 'model' ? 'assistant' as const : 'user' as const,
      content: msg.parts?.map(part => part.text).join(' ') || ''
    }));
  }

  private buildUserContent(prompt: string, images: string[] = []): string | Array<OpenAI.ChatCompletionContentPart> {
    if (!images || images.length === 0) {
      return prompt;
    }

    // Check if this is likely a local/Ollama model
    const isLikelyLocalModel = this.visionModelName.includes(':') || 
                              this.visionModelName.startsWith('llama') || 
                              this.visionModelName.startsWith('gemma') ||
                              this.visionModelName.startsWith('mistral');

    if (isLikelyLocalModel) {
      logger.info(`Using local model ${this.visionModelName} with Ollama-style vision (images in text)`);
      // For Ollama models, include images directly in the text prompt
      const imageUrls = images.join(' ');
      const finalContent = `[IMPORTANT: The user has shared an image at this URL: ${imageUrls}. You must describe what you actually see in this image, not hallucinate or make up content. Look at the image first before responding.] User message: ${prompt}`;
      logger.debug(`Ollama prompt with images: ${finalContent}`);
      return finalContent;
    }

    // Build multimodal content for official OpenAI models
    logger.info(`Using OpenAI vision model ${this.visionModelName} with multimodal content`);
    const content: Array<OpenAI.ChatCompletionContentPart> = [
      { type: 'text', text: prompt }
    ];

    images.forEach(imageUrl => {
      content.push({
        type: 'image_url',
        image_url: { 
          url: imageUrl,
          detail: 'auto'
        }
      });
    });

    return content;
  }

  protected formatError(error: any): string {
    // Handle OpenAI API errors more comprehensively
    if (error?.error?.message) {
      return `OpenAI API error: ${error.error.message}`;
    }
    if (error?.response?.data?.error?.message) {
      return `OpenAI API error: ${error.response.data.error.message}`;
    }
    if (error?.response?.data?.error) {
      return `OpenAI API error: ${JSON.stringify(error.response.data.error)}`;
    }
    if (error?.status && error?.message) {
      return `OpenAI API error: ${error.status} - ${error.message}`;
    }
    if (error?.status) {
      return `OpenAI API error: ${error.status} status code${error.body ? ` - ${JSON.stringify(error.body)}` : ' (no body)'}`;
    }
    if (error?.message) {
      return `OpenAI API error: ${error.message}`;
    }
    return `OpenAI API error: ${error.toString()}`;
  }
}
