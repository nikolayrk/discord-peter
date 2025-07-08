import { BaseAIProvider } from './base';
import { config } from '../../config/config';
import { GoogleGenAI } from '@google/genai';
import { logger } from '../../utils/logger';
import { AIRequestParams } from '../types';

interface ImageData {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

function createUserContent(parts: any[]) {
  return {
    role: 'user',
    parts: parts.map(part => {
      if (typeof part === 'string') {
        return { text: part };
      } else {
        return part;
      }
    })
  };
}

export class GeminiProvider extends BaseAIProvider {
  private ai!: GoogleGenAI;
  private textModelName!: string;
  private visionModelName!: string;

  constructor() {
    super();
    
    const {
      ai,
      textModelName,
      visionModelName
    } = this.initializeModels(config.ai.geminiApiKey);

    this.ai = ai;
    this.textModelName = textModelName;
    this.visionModelName = visionModelName;
  }

  private initializeModels(apiKey: string): {
    ai: GoogleGenAI,
    textModelName: string,
    visionModelName: string } {
    const ai = new GoogleGenAI({ apiKey });
    
    const textModelName = config.ai.textModel;
    const visionModelName = config.ai.visionModel;
    
    logger.info('Using Gemini with text model:', textModelName);
    logger.info('Using Gemini with vision model:', visionModelName);

    return { ai, textModelName, visionModelName };
  }
  
  async generateResponse(params: AIRequestParams): Promise<string> {
    const { prompt, images, history } = params;
    const modelName = (!images || images.length === 0) ? this.textModelName : this.visionModelName;

    try {
      const chat = this.ai.chats.create({
        model: modelName,
        history: history || [],
        config: {
          systemInstruction: config.systemInstruction
        }
      });

      const imageParts = images ? await this.processImages(images) : [];
      const messagePayload = [prompt, ...imageParts];

      const response = await chat.sendMessage({ message: messagePayload });
      return response.text ?? 'Empty chat response';
    } catch (error) {
      logger.error('Gemini API error:', error);
      throw new Error(this.formatError(error));
    }
  }

  async generateStreamingResponse(
    params: AIRequestParams,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const { prompt, images, history } = params;
    const modelName = (!images || images.length === 0) ? this.textModelName : this.visionModelName;
      
    try {
      const chat = this.ai.chats.create({
        model: modelName,
        history: history || [],
        config: {
          systemInstruction: config.systemInstruction
        }
    });

      const imageParts = images ? await this.processImages(images) : [];
      const messagePayload = [prompt, ...imageParts];

      const responseStream = await chat.sendMessageStream({
        message: messagePayload,
      });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        onChunk(chunk.text);
      }
    }
    } catch (error) {
      logger.error('Gemini API streaming error:', error);
      throw new Error(this.formatError(error));
  }
  }

  private async processImages(images: string[]): Promise<ImageData[]> {
    return Promise.all(images.map(this.processImage));
  }

  private async processImage(imageUrl: string): Promise<ImageData> {
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    
    return {
      inlineData: {
        data: Buffer.from(buffer).toString('base64'),
        mimeType: response.headers.get('content-type') || 'image/jpeg'
      }
    };
  }
}
