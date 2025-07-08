import { Message, Attachment, Collection } from 'discord.js';
import { AIService } from '../ai/aiService';
import { config } from '../config/config';
import { logger } from '../utils/logger';
export class MessageHandler {
  private aiService: AIService;
  private readonly BASE_DELAY = 500;
  private readonly CHARS_PER_SECOND = 20;
  private readonly RANDOM_RESPONSE_CHANCE = 0.01; // 1% chance for a response to an unprompted message
  private readonly CONTEXT_LAST_MESSAGES_IN_MINS = 10; // context messages from the last 10 minutes
  private readonly CONTEXT_LAST_MESSAGE_OLDEST_HOURS = 24; // context the last message if within 24 hours
  private readonly MAX_CONTEXT_LAST_MESSAGES = 50;

  constructor() {
    this.aiService = new AIService(config.ai.defaultProvider);
  }

  async handleMessage(message: Message): Promise<void> {
    try {
      if (this.shouldSkipMessage(message)) return;

      const { prompt, images } = await this.buildPrompt(message);
      const response = await this.getAIResponse(prompt, images);
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

  private async buildPrompt(message: Message): Promise<{ prompt: string; images: string[] }> {
    logger.info(`Received message from ${message.author.tag}: "${message.content}"`);

    const images = this.getImagesFromMessage(message);
    const contextResult = await this.getContextFromReply(message);
    const recentMessages = await this.getRecentMessages(message);

    const basePrompt = this.buildBasePrompt(contextResult, recentMessages, message);
    const allImages = [...images, ...(contextResult?.images || [])];

    const cleanedPrompt = this.cleanPrompt(message, basePrompt);

    logger.info('Sending prompt to AI:', cleanedPrompt);
    logger.info(`Including ${allImages.length} images`);

    return { prompt: cleanedPrompt, images: allImages };
  }

  private buildBasePrompt(contextResult: any, recentMessages: Message[], message: Message): string {
    const basePromptParts = [message.content]; // Start with the current message
    if (contextResult?.prompt) {
      basePromptParts.push(`[Reply Context: ${contextResult.prompt}]`);
    }

    // Sort recent messages by creation time in descending order
    const sortedRecentMessages = [...recentMessages].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    sortedRecentMessages.forEach(recentMessage => {
      // Add image URLs from attachments to the prompt
      const imageAttachments = recentMessage.attachments
        .filter(this.isImageAttachment)
        .map(attachment => attachment.url);
      let messageContent = `[Recent Message: ${recentMessage.content}]`;
      if (imageAttachments.length > 0) {
        messageContent += ` [Images: ${imageAttachments.join(', ')}]`;
      }
      basePromptParts.push(messageContent);
    });

    const combinedPrompt = basePromptParts.join('\n---\n');
    return combinedPrompt;
  }

  private getImagesFromMessage(message: Message): string[] {
    const images = [
      ...message.attachments.filter(this.isImageAttachment).map(att => att.url),
      ...this.extractImageUrls(message.content)
    ];

    if (images.length > 0) {
      logger.info(`Found ${images.length} images in message`);
    }

    return images;
  }

  private isImageAttachment(attachment: Attachment): boolean {
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    return imageTypes.includes(attachment.contentType || '');
  }

  private extractImageUrls(content: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp))/gi;
    return content.match(urlRegex) || [];
  }

  private async getContextFromReply(message: Message): Promise<{ prompt: string; images: string[] } | null> {
    if (!message.reference?.messageId) return null;

    try {
      const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
      const contextImages = this.getImagesFromMessage(repliedMessage);
      const contextPrompt = `[Previous message: "${repliedMessage.content}" ${message.content}]`;
      logger.info('Added context from replied message:', repliedMessage.content);
      if (contextImages.length > 0) {
        logger.info(`Added ${contextImages.length} images from replied message`);
      }
      return { prompt: contextPrompt, images: contextImages };
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

  private async getAIResponse(prompt: string, images: string[]): Promise<string> {
    const response = await this.aiService.generateResponse({
      prompt: config.promptTemplate.replace('{message}', prompt),
      images
    });
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
    const isRandomResponse = Math.random() < this.RANDOM_RESPONSE_CHANCE;
    const shouldRespond = message.mentions.has(message.client.user!) || isRandomResponse;
    const reason = message.mentions.has(message.client.user!) ? 'mention' : (isRandomResponse ? 'random' : 'no');
    logger.debug(`Message ${shouldRespond ? 'requires' : 'does not require'} response due to ${reason}`);
    return shouldRespond;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async getRecentMessages(message: Message): Promise<Message[]> {
    try {
      const fetchedMessages = await message.channel.messages.fetch({ limit: this.MAX_CONTEXT_LAST_MESSAGES });
      const messages = this.filterMessages(message, fetchedMessages);
      const lastMessage = await this.getLastMessageWithinOneDay(message, fetchedMessages);

      let combinedMessages: Message[] = [...messages];
      if (lastMessage && !messages.find(m => m.id === lastMessage.id) && lastMessage.id !== message.id) {
        combinedMessages.push(lastMessage);
      }

      logger.info(`Added ${combinedMessages.length} recent messages`);
      return combinedMessages;
    } catch (error) {
      logger.error('Error fetching messages:', error);
      return [];
    }
  }

  private filterMessages(message: Message, fetchedMessages: Collection<string, Message<boolean>>): Message[] {
    const now = Date.now();
    const tenMinutesAgo = new Date(now - this.CONTEXT_LAST_MESSAGES_IN_MINS * 60 * 1000);
    const messages: Message[] = [];

    for (const fetchedMessage of fetchedMessages.values()) {
      if (fetchedMessage.author.id === message.client.user?.id) {
        break; // Stop if the message is from the bot itself
      }

      if (fetchedMessage.createdAt >= tenMinutesAgo && fetchedMessage.createdAt <= new Date(now) && fetchedMessage.id !== message.id && !fetchedMessage.author.bot) {
        messages.push(fetchedMessage);
      }
    }

    return messages;
  }

  private async getLastMessageWithinOneDay(message: Message, fetchedMessages: any): Promise<Message | null> {
    const now = Date.now();
    const oneDayAgo = new Date(now - this.CONTEXT_LAST_MESSAGE_OLDEST_HOURS * 60 * 60 * 1000);
    const isWithinOneDay = (m: Message) => m.createdAt >= oneDayAgo;
    const lastMessage = fetchedMessages.last();

    if (lastMessage && isWithinOneDay(lastMessage) && lastMessage.id !== message.id && !lastMessage.author.bot) {
      return lastMessage;
    }

    return null;
  }
}
