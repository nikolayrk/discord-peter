import { Message, Attachment, TextChannel, ThreadChannel } from 'discord.js';
import { AIService } from '../ai/aiService';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { redisClient } from '../utils/redisClient';
import { Content } from '@google/genai';
import { ModelOverloadedError } from '../ai/types';
import { splitDiscordResponse } from './responseChunks';

type Redis = Pick<typeof redisClient, 'get' | 'set' | 'sAdd' | 'sMembers' | 'expire'>;
type Provider = Pick<AIService, 'generateStreamingResponse'> & Partial<Pick<AIService, 'generateResponse'>>;
type Pending = { message: Message; timer?: NodeJS.Timeout; started: number };

export class MessageHandler {
  private aiService: Provider;
  private readonly CHAT_HISTORY_EXPIRES_IN = 7200;
  private readonly STREAM_EDIT_INTERVAL = 500;
  private readonly QUIET_WINDOW_MS = 2000;
  private readonly MAX_BATCH_MS = 10000;
  private pending = new Map<string, Pending[]>();
  private active = new Set<string>();

  constructor(options: { provider?: Provider; redis?: Redis; clock?: () => number; logger?: typeof logger } = {}) {
    this.aiService = options.provider || new AIService(config.ai.defaultProvider);
    this.redis = options.redis || redisClient;
    this.clock = options.clock || Date.now;
    this.log = options.logger || logger;
  }
  private redis: Redis;
  private clock: () => number;
  private log: typeof logger;

  close(): void {
    for (const items of this.pending.values()) for (const item of items) if (item.timer) clearTimeout(item.timer);
    this.pending.clear();
  }

  async handleMessage(message: Message): Promise<void> {
    if (message.author.bot) return;
    const threadId = this.threadId(message);
    const participating = threadId ? await this.isParticipating(threadId) : false;
    if (threadId && participating) {
      this.queueFollowUp(threadId, message);
      return;
    }
    if (!(await this.shouldRespond(message))) return;

    try {
      const thread = threadId ? message.channel as ThreadChannel : await this.openThread(message);
      if (!thread) return;
      await this.redis.sAdd('peter:threads', thread.id);
      // The first message creates the thread and is answered directly. Do not enqueue it.
      this.active.add(thread.id);
      try { await this.generateForMessages(thread.id, [message], thread); }
      finally {
        this.active.delete(thread.id);
        this.schedulePending(thread.id);
      }
    } catch (error) {
      this.log.error('Unable to start thread response:', error);
      await this.notifyParent(message);
    }
  }

  private threadId(message: Message): string | undefined {
    return message.channel.isThread() ? message.channelId : undefined;
  }

  private async isParticipating(threadId: string): Promise<boolean> {
    try { return (await this.redis.sMembers('peter:threads')).includes(threadId); }
    catch (error) { this.log.error('Unable to read participating threads:', error); return false; }
  }

  private async openThread(message: Message): Promise<ThreadChannel | null> {
    const channel: any = message.channel;
    if (!channel.isTextBased() || typeof channel.threads?.create !== 'function' || !message.guild) {
      await this.notifyParent(message);
      return null;
    }
    if (message.hasThread) return message.thread;
    const topic = message.content.replace(/<@!?\d+>/g, '').trim();
    let name = topic.split(/\r?\n/)[0]?.slice(0, 100) || 'Chat with Peter';
    if (topic && this.aiService.generateResponse) {
      try {
        const title = await this.aiService.generateResponse({ prompt: `Write a short, descriptive Discord thread title for the conversation topic below. Return only the title, without quotes, mentions, commentary, or a prefix.\n\n${topic}` });
        const cleaned = title.split(/\r?\n/)[0].replace(/<@!?\d+>/g, '').trim().replace(/^[\s"'“”]+|[\s"'“”]+$/g, '').slice(0, 100).trim();
        if (cleaned) name = cleaned;
      } catch (error) {
        this.log.warn('Unable to generate thread title:', error);
      }
    }
    return message.startThread({ name, autoArchiveDuration: 1440, reason: 'Start Peter conversation' });
  }

  private async shouldRespond(message: Message): Promise<boolean> {
    if (message.mentions.has(message.client.user!)) return true;
    const id = message.reference?.messageId;
    if (!id) return false;
    try {
      const referenced = message.channel.messages.cache.get(id) || await message.channel.messages.fetch(id);
      if (referenced.author.id === message.client.user?.id) return true;
      const mapped = await this.redis.get(`peter:reply:${id}`);
      return !!mapped;
    } catch (error) { this.log.debug('Unable to resolve referenced message:', error); return false; }
  }

  private queueFollowUp(threadId: string, message: Message): void {
    let items = this.pending.get(threadId);
    if (!items) { items = []; this.pending.set(threadId, items); }
    items.push({ message, started: items[0]?.started ?? this.clock() });
    const first = items[0];
    if (first.timer) clearTimeout(first.timer);
    const delay = Math.max(0, Math.min(this.QUIET_WINDOW_MS, first.started + this.MAX_BATCH_MS - this.clock()));
    first.timer = setTimeout(() => { first.timer = undefined; void this.drain(threadId); }, delay);
    if (!this.active.has(threadId) && items.length === 1 && delay === 0) void this.drain(threadId);
  }

  private async drain(threadId: string): Promise<void> {
    if (this.active.has(threadId)) return;
    const items = this.pending.get(threadId);
    if (!items?.length) return;
    this.active.add(threadId);
    this.pending.delete(threadId);
    const channel = items[0].message.channel as ThreadChannel;
    try { await this.generateForMessages(threadId, items.map(item => item.message), channel); }
    catch (error) {
      this.log.error('Follow-up batch failed:', error);
      try { await (channel.parent as TextChannel | null)?.send({ content: "I couldn't finish that thread response. Please check my message permissions.", allowedMentions: { parse: [] } }); }
      catch (noticeError) { this.log.error('Unable to send parent-channel failure notice:', noticeError); }
    }
    finally {
      this.active.delete(threadId);
      this.schedulePending(threadId);
    }
  }

  private schedulePending(threadId: string): void {
    const first = this.pending.get(threadId)?.[0];
    if (!first || first.timer) return;
    const delay = Math.max(0, Math.min(this.QUIET_WINDOW_MS, first.started + this.MAX_BATCH_MS - this.clock()));
    first.timer = setTimeout(() => { first.timer = undefined; void this.drain(threadId); }, delay);
  }

  private async waitForEdit(lastEdit: number): Promise<void> {
    const remaining = this.STREAM_EDIT_INTERVAL - (this.clock() - lastEdit);
    if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
  }

  private async generateForMessages(threadId: string, messages: Message[], channel: any): Promise<void> {
    const data = await Promise.all(messages.map(message => this.buildPrompt(message)));
    const prompt = data.map(({ message, text }) => `[${message.author.tag} (${message.author.id})]: ${text || '[image]'}`).join('\n');
    const images = data.flatMap(item => item.images);
    const history = await this.readHistory(threadId);
    let answer = '';
    let delivery = Promise.resolve();
    const sent: Message[] = [];
    let segment = '';
    let visible = '';
    let current: Message | undefined;
    let lastEdit = 0;
    let typing: NodeJS.Timeout | undefined;
    try {
      if (channel.isTextBased()) {
        await channel.sendTyping();
        typing = setInterval(() => { void channel.sendTyping().catch((error: unknown) => this.log.warn('Typing indicator failed:', error)); }, 9000);
      }
      await this.aiService.generateStreamingResponse({ prompt, images, history }, chunk => {
        answer += chunk;
        delivery = delivery.then(async () => {
          for (const point of chunk) {
            if (segment.length === 2000) {
              if (current && visible !== segment) {
                await this.waitForEdit(lastEdit);
                await current.edit({ content: segment, allowedMentions: { parse: [] } });
                lastEdit = this.clock();
              }
              current = undefined;
              segment = '';
              visible = '';
            }
            segment += point;
            const now = this.clock();
            if (!current) {
              const created = await channel.send({ content: segment, allowedMentions: { parse: [] } }) as Message;
              current = created;
              sent.push(created);
              visible = segment;
              lastEdit = now;
            } else if (now - lastEdit >= this.STREAM_EDIT_INTERVAL) {
              await current.edit({ content: segment, allowedMentions: { parse: [] } });
              visible = segment;
              lastEdit = now;
            }
          }
        });
      });
      await delivery;
      if (!answer) answer = "Heh. Yeah, I got nothin'.";
      if (!sent.length) {
        for (const chunk of splitDiscordResponse(answer)) sent.push(await channel.send({ content: chunk, allowedMentions: { parse: [] } }));
      }
      else if (visible !== segment && current) {
        await this.waitForEdit(lastEdit);
        await current.edit({ content: segment, allowedMentions: { parse: [] } });
      }
      const updated = [...history, { role: 'user', parts: [{ text: prompt }] }, { role: 'model', parts: [{ text: answer }] }] as Content[];
      await this.redis.set(`peter:history:${threadId}`, JSON.stringify(updated), { EX: this.CHAT_HISTORY_EXPIRES_IN });
      await Promise.all(sent.map(msg => this.redis.set(`peter:reply:${msg.id}`, threadId, { EX: this.CHAT_HISTORY_EXPIRES_IN })));
    } catch (error) {
      this.log.error('Error generating thread response:', error);
      const text = error instanceof ModelOverloadedError
        ? "Whoa, hold your horses! My brain's a little fried from all you jabronis askin' questions. Try again in a minute, heheh."
        : 'Hehehe, sorry folks, I had a bit of a malfunction there!';
      try {
        const errorMessage = await channel.send({ content: text, allowedMentions: { parse: [] } });
        await this.redis.set(`peter:reply:${errorMessage.id}`, threadId, { EX: this.CHAT_HISTORY_EXPIRES_IN });
      }
      catch (sendError) { this.log.error('Unable to send thread error response:', sendError); throw sendError; }
    } finally { if (typing) clearInterval(typing); }
  }

  private async buildPrompt(message: Message): Promise<{ message: Message; text: string; images: string[] }> {
    let referencedImages: string[] = [];
    if (message.reference?.messageId) {
      try {
        const referenced = message.channel.messages.cache.get(message.reference.messageId) || await message.channel.messages.fetch(message.reference.messageId);
        referencedImages = this.getImagesFromMessage(referenced);
      } catch (error) { this.log.warn('Could not fetch referenced message:', error); }
    }
    return { message, text: this.cleanPrompt(message, message.content), images: [...referencedImages, ...this.getImagesFromMessage(message)] };
  }

  private async readHistory(threadId: string): Promise<Content[]> {
    try {
      const key = `peter:history:${threadId}`;
      const value = await this.redis.get(key);
      if (value) await this.redis.expire(key, this.CHAT_HISTORY_EXPIRES_IN);
      return value ? JSON.parse(value) as Content[] : [];
    }
    catch (error) { this.log.error('Unable to read thread history:', error); return []; }
  }

  private async notifyParent(message: Message): Promise<void> {
    try { await (message.channel as TextChannel).send({ content: "I couldn't start that conversation thread. Please check my thread and message permissions.", allowedMentions: { parse: [] } }); }
    catch (error) { this.log.error('Unable to send thread failure notice:', error); }
  }

  private getImagesFromMessage(message: Message): string[] {
    return [...message.attachments.filter(this.isImageAttachment).map(att => att.url), ...this.extractImageUrls(message.content)];
  }
  private isImageAttachment(attachment: Attachment): boolean { return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(attachment.contentType || ''); }
  private extractImageUrls(content: string): string[] { return content.match(/(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp))/gi) || []; }
  private cleanPrompt(message: Message, prompt: string): string {
    return prompt.replace(/<@!?\d+>/g, '').replace(new RegExp(`@${message.client.user?.username || ''}`, 'g'), '').trim();
  }
}
