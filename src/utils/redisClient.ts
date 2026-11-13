import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';
import { config } from '../config/config';

class RedisService {
  private client: RedisClientType;
  private connection?: Promise<void>;
  constructor(url = config.redisUrl) {
    this.client = createClient({ url });
    this.client.on('error', err => logger.error('Redis Client Error', err));
  }
  async connect(): Promise<void> {
    if (this.client.isOpen) return;
    this.connection ||= this.client.connect().then(() => undefined).finally(() => { this.connection = undefined; });
    await this.connection;
  }
  async close(): Promise<void> { if (this.client.isOpen) await this.client.quit(); }
  getClient(): RedisClientType { return this.client; }
}

export const redisService = new RedisService();
export const redisClient = redisService.getClient();
