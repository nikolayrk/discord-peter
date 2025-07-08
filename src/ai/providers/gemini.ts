import { BaseAIProvider } from './base';
import { config } from '../../config/config';
import { GoogleGenAI, createUserContent } from '@google/genai';
import { logger } from '../../utils/logger';
import { AIRequestParams } from '../types';

interface ImageData {
  inlineData: {
    data: string;
    mimeType: string;
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
    try {
      return await this.generateAppropriateResponse(params);
    } catch (error) {
      logger.error('Gemini API error:', error);
      throw new Error(this.formatError(error));
    }
  }

  async generateStreamingResponse(
    params: AIRequestParams,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    try {
      const { prompt, images } = params;
      
      if (!images || images.length === 0) {
        await this.generateTextStream(prompt, onChunk);
      } else {
        await this.generateVisionStream(prompt, images, onChunk);
      }
    } catch (error) {
      logger.error('Gemini API streaming error:', error);
      throw new Error(this.formatError(error));
    }
  }

  private async generateTextStream(
    prompt: string,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const responseStream = await this.ai.models.generateContentStream({
      model: this.textModelName,
      contents: prompt,
      config: {
        systemInstruction: config.systemInstructions
      }
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        onChunk(chunk.text);
      }
    }
  }

  private async generateVisionStream(
    prompt: string,
    images: string[],
    onChunk: (chunk: string) => void
  ): Promise<void> {
    logger.info(`Processing ${images.length} images with prompt for streaming`);
    const imageParts = await this.processImages(images);

    const responseStream = await this.ai.models.generateContentStream({
      model: this.visionModelName,
      contents: [createUserContent([prompt, ...imageParts])],
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        onChunk(chunk.text);
      }
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
    const response = await this.ai.models.generateContent({
      model: this.textModelName,
      contents: prompt,
    });
    return response.text ?? 'Empty text model response';
  }

  private async generateVisionResponse(prompt: string, images: string[]): Promise<string> {
    logger.info(`Processing ${images.length} images with prompt`);
    const imageParts = await this.processImages(images);
    
    const response = await this.ai.models.generateContent({
      model: this.visionModelName,
      contents: [createUserContent([prompt, ...imageParts])],
    });
    return response.text ?? 'Empty vision model response';
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