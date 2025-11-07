import { Message, Attachment, TextChannel } from 'discord.js';
import { AIService } from '../ai/aiService';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { redisClient } from '../utils/redisClient';
import { Content } from '@google/genai';
import { ModelOverloadedError } from '../ai/types';

export class MessageHandler {
  private aiService: AIService;
  private readonly RANDOM_RESPONSE_CHANCE = 0.01; // 1% chance for a response to an unprompted message
  private readonly CHAT_HISTORY_EXPIRES_IN = 60 * 60 * 2; // 2 hours in seconds
  private readonly STREAM_EDIT_INTERVAL = 500; // 500 milliseconds

  constructor() {
    this.aiService = new AIService(config.ai.defaultProvider);
  }

  async handleMessage(message: Message): Promise<void> {
    try {
      if (this.shouldSkipMessage(message)) return;

      const { prompt, images, history } = await this.buildChatData(message);

      await this.streamResponseToChannel(message, prompt, images, history);

      logger.info('Finished handling message and streaming response.');
    } catch (error) {
      logger.error('Error handling message:', error);
      if (error instanceof ModelOverloadedError) {
        logger.debug('Sending model overload error response');
        await message.reply("Whoa, hold your horses! My brain's a little fried from all you jabronis askin' questions. Try again in a minute, heheh.");
      } else {
        logger.debug('Sending generic error response');
        await message.reply('Hehehe, sorry folks, I had a bit of a malfunction there!');
      }
    }
  }

  private async streamResponseToChannel(message: Message, prompt: string, images: string[], history: Content[]): Promise<void> {
    let replyMessage: Message | null = null;
    let fullResponseText = '';
    let lastEditTime = 0;
    let editQueue = '';
    let isCreatingMessage = false;
    let isEditingMessage = false;
    let typingInterval: NodeJS.Timeout | null = null;
    let messageCreationPromise: Promise<void> | null = null;

    try {
      if (message.channel.isTextBased()) {
        logger.debug('Starting typing indicator in channel');
        (message.channel as TextChannel).sendTyping();
        typingInterval = setInterval(() => {
          logger.debug('Sending typing indicator');
          (message.channel as TextChannel).sendTyping();
        }, 9000);
      }

      const onChunk = async (chunk: string) => {
        fullResponseText += chunk;
        editQueue += chunk;
        const now = Date.now();

        if (!replyMessage && !isCreatingMessage) {
          isCreatingMessage = true;
          logger.debug('Creating initial reply message with content length:', editQueue.length);

          messageCreationPromise = message.reply({
            content: editQueue,
            allowedMentions: { parse: [] }
          }).then(msg => {
            logger.debug('Successfully created initial reply message with ID:', msg.id);
            replyMessage = msg;
            editQueue = '';
            lastEditTime = now;
            isCreatingMessage = false;
          }).catch(err => {
            logger.error("Error sending initial reply:", err);
            isCreatingMessage = false;
          });
          return;
        }

        if (replyMessage && now - lastEditTime > this.STREAM_EDIT_INTERVAL && !isEditingMessage) {
          if (editQueue.length > 0) {
            isEditingMessage = true;
            logger.debug('Editing message with new content length:', fullResponseText.length);
            
            try {
              await replyMessage.edit(fullResponseText);
              logger.debug('Successfully edited message');
              editQueue = '';
              lastEditTime = now;
            } catch (err) {
              logger.error("Error editing message:", err);
            } finally {
              isEditingMessage = false;
            }
          }
        }
      };

      await this.aiService.generateStreamingResponse(
        { prompt, images, history },
        onChunk
      );

      // Wait for any pending message creation
      if (messageCreationPromise) {
        await messageCreationPromise;
      }

      // Wait for any pending edits to complete
      while (isEditingMessage) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Always perform a final edit to ensure the complete response is sent
      if (replyMessage && fullResponseText.length > 0) {
        try {
          logger.debug('Final edit ensuring complete response, full length:', fullResponseText.length);
          await (replyMessage as Message).edit(fullResponseText);
          logger.debug('Successfully completed final edit');
        } catch (err) {
          logger.error("Error in final edit:", err);
        }
      }

      if (!replyMessage) {
        if (fullResponseText.length > 0) {
          try {
            logger.debug('Creating final reply message with full response length:', fullResponseText.length);
            replyMessage = await message.reply({ content: fullResponseText, allowedMentions: { parse: [] } });
            logger.debug('Successfully created final reply message with ID:', replyMessage.id);
          } catch (err) { logger.error("Error sending final fast reply:", err); }
        } else {
          try {
            logger.debug('Creating empty response fallback message');
            replyMessage = await message.reply({ content: "Heh. Yeah, I got nothin'.", allowedMentions: { parse: [] } });
            logger.debug('Successfully created empty response message with ID:', replyMessage.id);
          } catch (err) { logger.error("Error sending empty response message:", err); }
        }
      }
      if (replyMessage) {
        logger.info('Full AI response received:', fullResponseText);
        await this.saveChatHistory(replyMessage.id, prompt, fullResponseText);
      } else {
        logger.error("Failed to create or edit a reply message, cannot save chat history.");
      }
    } finally {
      // Ensure the typing indicator is always stopped
      if (typingInterval) {
        logger.debug('Stopping typing indicator');
        clearInterval(typingInterval);
      }
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

  private async buildChatData(message: Message): Promise<{ prompt: string; images: string[]; history: Content[] }> {
    logger.info(`Received message from ${message.author.tag}: "${message.content}"`);

    const images = this.getImagesFromMessage(message);
    const history = await this.getChatHistory(message);

    // Also include images from the referenced message if any
    const referencedImages: string[] = [];
    if (message.reference?.messageId) {
      try {
        const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
        if (referencedMessage && !referencedMessage.author.bot) {
          const refImages = this.getImagesFromMessage(referencedMessage);
          referencedImages.push(...refImages);
        }
      } catch (error) {
        logger.error('Error fetching referenced message for images:', error);
      }
    }

    const allImages = [...referencedImages, ...images];
    const prompt = this.cleanPrompt(message, message.content);

    logger.info('Sending prompt to AI:', prompt);
    if (allImages.length > 0) logger.info(`Including ${allImages.length} images (${referencedImages.length} from referenced message, ${images.length} from current message)`);
    if (history.length > 0) logger.info(`Including ${history.length / 2} pairs of messages from history`);

    return { prompt, images: allImages, history };
  }

  private async getChatHistory(message: Message): Promise<Content[]> {
    if (!message.reference?.messageId) return [];
    
    const history: Content[] = [];
    
    try {
      // First, try to fetch the actual Discord message being replied to
      const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
      if (referencedMessage && !referencedMessage.author.bot) {
        logger.info(`Found referenced message from ${referencedMessage.author.tag}: "${referencedMessage.content}"`);
        
        // Get images from the referenced message
        const referencedImages = this.getImagesFromMessage(referencedMessage);
        
        // Build the content parts for the referenced message
        const parts: any[] = [];
        if (referencedMessage.content.trim()) {
          parts.push({ text: referencedMessage.content });
        }
        if (referencedImages.length > 0) {
          logger.info(`Including ${referencedImages.length} images from referenced message`);
          // For now, we'll include image URLs as text since the AI service handles image processing
          parts.push({ text: `[Images: ${referencedImages.join(', ')}]` });
        }
        
        if (parts.length > 0) {
          history.push({ role: 'user', parts });
        }
      }
      
      // Then, try to fetch any existing chat history from Redis
      const historyJson = await redisClient.get(`chat:${message.reference.messageId}`);
      if (historyJson) {
        logger.info(`Found additional chat history for replied message ${message.reference.messageId}`);
        const existingHistory = JSON.parse(historyJson) as Content[];
        history.push(...existingHistory);
      }
    } catch (error) {
      logger.error('Error fetching chat history:', error);
    }
    
    return history;
  }

  private async saveChatHistory(messageId: string, userPrompt: string, modelResponse: string): Promise<void> {
    const newHistory: Content[] = [
      { role: 'user', parts: [{ text: userPrompt }] },
      { role: 'model', parts: [{ text: modelResponse }] },
    ];

    try {
      // Fetch existing history if any, to append
      const parentMessageId = (await (await redisClient.get(`chat:${messageId}`))) ? messageId : null;
      let history: Content[] = [];
      if (parentMessageId) {
        const existingHistoryJson = await redisClient.get(`chat:${parentMessageId}`);
        if (existingHistoryJson) {
          history = JSON.parse(existingHistoryJson);
        }
      }


      const updatedHistory = [...history, ...newHistory];

      await redisClient.set(`chat:${messageId}`, JSON.stringify(updatedHistory), {
        EX: this.CHAT_HISTORY_EXPIRES_IN,
      });
      logger.info(`Saved chat history for message ${messageId}`);
    } catch (error) {
      logger.error('Error saving chat history to Redis:', error);
    }
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

  private cleanPrompt(message: Message, prompt: string): string {
    const botMention = `@${message.client.user?.username || ''}`;
    return prompt
      .replace(new RegExp(botMention, 'g'), '')
      .replace(/<@\d+>/g, '')
      .trim();
  }

  private shouldRespond(message: Message): boolean {
    const isMentioned = message.mentions.has(message.client.user!);
    const isReplyToBot = message.reference?.messageId ?
      message.channel.messages.cache.get(message.reference.messageId)?.author.id === message.client.user?.id :
      false;
    const isRandomResponse = false; // Math.random() < this.RANDOM_RESPONSE_CHANCE; // Disable random responses for now

    // Always respond if mentioned or replied to. Only sometimes respond otherwise.
    const shouldRespond = isMentioned || isReplyToBot || isRandomResponse;

    let reason = 'no';
    if (isMentioned) reason = 'mention';
    else if (isReplyToBot) reason = 'reply';
    else if (isRandomResponse) reason = 'random';

    logger.debug(`Message ${shouldRespond ? 'requires' : 'does not require'} response due to ${reason}`);
    return shouldRespond;
  }
}
