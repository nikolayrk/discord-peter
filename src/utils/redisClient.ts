import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';
import { config } from '../config/config';

class RedisService {
  private client: RedisClientType;
  private static instance: RedisService;

  private constructor() {
    this.client = createClient({
      url: config.redisUrl
    });

    this.client.on('error', (err) => logger.error('Redis Client Error', err));
    this.client.connect().catch(err => logger.error('Failed to connect to Redis', err));
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  public getClient(): RedisClientType {
    return this.client;
  }
}

export const redisClient = RedisService.getInstance().getClient();