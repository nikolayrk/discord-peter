import { BaseAIProvider } from './base';
import { config } from '../../config/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../../utils/logger';
import { AIRequestParams } from '../types';

interface ImageData {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

export class GeminiProvider extends BaseAIProvider {
  private apiKey: string;
  private textModel: any;
  private visionModel: any;

  constructor() {
    super();
    this.apiKey = config.ai.geminiApiKey;
    this.initializeModels();
  }

  private initializeModels(): void {
    const genAI = new GoogleGenerativeAI(this.apiKey);
    
    const textModelName = config.ai.textModel;
    const visionModelName = config.ai.visionModel;
    
    logger.info('Initializing text model:', textModelName);
    logger.info('Initializing vision model:', visionModelName);
    
    this.textModel = genAI.getGenerativeModel({ model: textModelName });
    this.visionModel = genAI.getGenerativeModel({ model: visionModelName });
  }
  
  async generateResponse(params: AIRequestParams): Promise<string> {
    try {
      return await this.generateAppropriateResponse(params);
    } catch (error) {
      logger.error('Gemini API error:', error);
      throw new Error(this.formatError(error));
    }
  }

  private async generateAppropriateResponse(params: AIRequestParams): Promise<string> {
    const { prompt, images } = params;
    
    if (!images || images.length === 0) {
      return this.generateTextResponse(prompt);
    }

    return this.generateVisionResponse(prompt, images);
  }

  private async generateTextResponse(prompt: string): Promise<string> {
    const result = await this.textModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  private async generateVisionResponse(prompt: string, images: string[]): Promise<string> {
    logger.info(`Processing ${images.length} images with prompt`);
    const imageParts = await this.processImages(images);
    const result = await this.visionModel.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    return response.text();
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