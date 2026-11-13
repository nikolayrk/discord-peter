import { randomUUID } from 'crypto';
import { Content } from '@google/genai';
import { config } from '../../config/config';
import { logger } from '../../utils/logger';
import { AIRequestParams, ModelOverloadedError } from '../types';
import { BaseAIProvider } from './base';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  parentId?: string;
  childrenIds?: string[];
  models?: string[];
  model?: string;
  modelName?: string;
  modelIdx?: number;
  done?: boolean;
}

const TASK_POLL_INTERVAL_MS = 1_000;
const REQUEST_TIMEOUT_MS = 10 * 60 * 1_000;

/** Open WebUI provider that invokes its native server-side web search tool. */
export class OpenWebUIProvider extends BaseAIProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly modelName: string;

  constructor() {
    super();
    this.baseUrl = config.ai.openWebUIUrl.replace(/\/+$/, '');
    this.apiKey = config.ai.openWebUIApiKey;
    this.modelName = config.ai.textModel;
    logger.info('Using Open WebUI at:', this.baseUrl);
    logger.info('Using Open WebUI model:', this.modelName);
  }

  async generateResponse(params: AIRequestParams): Promise<string> {
    return this.runWithWebSearch(params);
  }

  async generateStreamingResponse(
    params: AIRequestParams,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    // Open WebUI's native built-in tools require its saved-chat streaming flow.
    // The HTTP call acknowledges the task, so the finished text is read back
    // from the chat and delivered as one chunk after the server-side loop ends.
    const response = await this.runWithWebSearch(params);
    if (response) onChunk(response);
  }

  private async runWithWebSearch(params: AIRequestParams): Promise<string> {
    const { prompt, images = [], history = [] } = params;
    const userId = randomUUID();
    const assistantId = randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);
    let chatId: string | undefined;

    try {
      const chatResponse = await this.request('/api/v1/chats/new', {
        method: 'POST',
        body: JSON.stringify({
          chat: {
            title: prompt.slice(0, 80) || 'Discord conversation',
            models: [this.modelName],
            history: {
              currentId: assistantId,
              messages: {
                [userId]: {
                  id: userId,
                  role: 'user',
                  content: prompt,
                  timestamp,
                  models: [this.modelName],
                  childrenIds: [assistantId],
                },
                [assistantId]: {
                  id: assistantId,
                  role: 'assistant',
                  content: '',
                  parentId: userId,
                  childrenIds: [],
                  model: this.modelName,
                  modelName: this.modelName,
                  modelIdx: 0,
                  done: false,
                  timestamp: timestamp + 1,
                },
              },
            },
          },
        }),
      });
      chatId = chatResponse.id;
      if (!chatId) throw new Error('Open WebUI did not return a chat id');

      const messages = [
        { role: 'system', content: config.systemInstruction },
        ...this.convertHistory(history),
        {
          role: 'user',
          content: images.length
            ? [
                { type: 'text', text: prompt },
                ...images.map(url => ({ type: 'image_url', image_url: { url } })),
              ]
            : prompt,
        },
      ];

      await this.request('/api/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: this.modelName,
          messages,
          stream: true,
          chat_id: chatId,
          id: assistantId,
          session_id: `discord-${randomUUID()}`,
          features: { web_search: true },
          background_tasks: {
            title_generation: false,
            tags_generation: false,
            follow_up_generation: false,
          },
        }),
      });

      await this.waitForCompletion(chatId);
      const chat = await this.request(`/api/v1/chats/${encodeURIComponent(chatId)}`);
      const result = chat.chat?.history?.messages?.[assistantId]?.content;
      if (typeof result !== 'string' || !result.trim()) {
        throw new Error('Open WebUI completed without returning an assistant message');
      }
      return result;
    } catch (error) {
      logger.error('Open WebUI API error:', error);
      const message = this.formatError(error);
      if (/\b(429|503)\b|overloaded|rate limit/i.test(message)) {
        throw new ModelOverloadedError('The model is currently overloaded or rate limited.');
      }
      throw new Error(message);
    } finally {
      if (chatId) {
        try {
          await this.request(`/api/v1/chats/${encodeURIComponent(chatId)}`, { method: 'DELETE' });
        } catch (error) {
          logger.warn('Failed to delete temporary Open WebUI chat:', error);
        }
      }
    }
  }

  private async waitForCompletion(chatId: string): Promise<void> {
    const deadline = Date.now() + REQUEST_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const taskState = await this.request(`/api/tasks/chat/${encodeURIComponent(chatId)}`);
      if (!Array.isArray(taskState.task_ids) || taskState.task_ids.length === 0) return;
      await new Promise(resolve => setTimeout(resolve, TASK_POLL_INTERVAL_MS));
    }
    throw new Error(`Open WebUI request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds`);
  }

  private async request(path: string, init: RequestInit = {}): Promise<any> {
    if (!this.baseUrl) throw new Error('OPEN_WEBUI_URL is not configured');
    if (!this.apiKey) throw new Error('OPEN_WEBUI_API_KEY is not configured');
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
      signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw new Error(`Open WebUI API error: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`);
    }
    if (response.status === 204) return {};
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  private convertHistory(history: Content[]): Array<{ role: 'user' | 'assistant'; content: string }> {
    return history.map(message => ({
      role: message.role === 'model' ? 'assistant' : 'user',
      content: message.parts?.map(part => part.text || '').join(' ') || '',
    }));
  }
}
