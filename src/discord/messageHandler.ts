import { Message } from 'discord.js';
import { AIService } from '../ai/aiService';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export class MessageHandler {
  private aiService: AIService;
  private readonly BASE_DELAY = 500;
  private readonly CHARS_PER_SECOND = 20;

  constructor() {
    this.aiService = new AIService(config.ai.defaultProvider);
  }

  async handleMessage(message: Message): Promise<void> {
    try {
      if (this.shouldSkipMessage(message)) return;

      const prompt = await this.buildPrompt(message);
      const response = await this.getAIResponse(prompt);
      await this.sendResponseMessages(message, response);
      logger.info('Finished sending all messages');
    } catch (error) {
      logger.error('Error handling message:', error);
      await message.reply('Hehehe, sorry folks, I had a bit of a malfunction there!');
    }
  }

  private shouldSkipMessage(message: Message): boolean {
    if (message.author.bot) {
      logger.debug('Ignoring bot message');
      return true;
    }

    if (!this.shouldRespond(message)) {
      logger.debug('Message does not require response');
      return true;
    }

    return false;
  }

  private async buildPrompt(message: Message): Promise<string> {
    logger.info(`Received message from ${message.author.tag}: "${message.content}"`);

    const contextPrompt = await this.getContextFromReply(message);
    const cleanedPrompt = this.cleanPrompt(message, contextPrompt || message.content);

    logger.info('Sending prompt to AI:', cleanedPrompt);
    return cleanedPrompt;
  }

  private async getContextFromReply(message: Message): Promise<string | null> {
    if (!message.reference?.messageId) return null;

    try {
      const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
      const contextPrompt = `[Previous message: "${repliedMessage.content}"] ${message.content}`;
      logger.info('Added context from replied message:', repliedMessage.content);
      return contextPrompt;
    } catch (error) {
      logger.error('Error fetching replied message:', error);
      return null;
    }
  }

  private cleanPrompt(message: Message, prompt: string): string {
    const botMention = `@${message.client.user?.username || ''}`;
    return prompt
      .replace(new RegExp(botMention, 'g'), '')
      .replace(/<@\d+>/g, '')
      .trim();
  }

  private async getAIResponse(prompt: string): Promise<string> {
    const response = await this.aiService.generateResponse(
      config.promptTemplate.replace('{message}', prompt)
    );
    logger.info('Received AI response:', response);
    return response;
  }

  private async sendResponseMessages(message: Message, response: string): Promise<void> {
    const paragraphs = this.splitIntoParagraphs(response);
    logger.info(`Preparing to send ${paragraphs.length} messages`);

    await paragraphs.reduce(async (promise, paragraph, index) => {
      await promise;
      await this.sendSingleMessage(message, paragraph, index === 0);
    }, Promise.resolve());
  }

  private splitIntoParagraphs(text: string): string[] {
    return text
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  private async sendSingleMessage(message: Message, content: string, isFirstMessage: boolean): Promise<void> {
    const readingTime = this.calculateReadingTime(content);
    logger.debug(`Waiting ${readingTime}ms before sending message`);
    await this.delay(readingTime);

    if (isFirstMessage) {
      logger.info(`Sending first message as reply: "${content}"`);
      await message.reply({ content, allowedMentions: { parse: [] } });
      return;
    }

    if ('send' in message.channel) {
      logger.info(`Sending follow-up message: "${content}"`);
      await message.channel.send({ content, allowedMentions: { parse: [] } });
    }
  }

  private calculateReadingTime(content: string): number {
    return Math.max(
      this.BASE_DELAY,
      (content.length / this.CHARS_PER_SECOND) * 1000
    );
  }

  private shouldRespond(message: Message): boolean {
    const shouldRespond = message.mentions.has(message.client.user!);
    logger.debug(`Message ${shouldRespond ? 'requires' : 'does not require'} response`);
    return shouldRespond;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
