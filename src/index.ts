import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { config } from './config/config';
import { MessageHandler } from './discord/messageHandler';
import { logger, closeLogger } from './utils/logger';
import { redisService } from './utils/redisClient';

export interface ApplicationOptions {
  client?: Client;
  handler?: MessageHandler;
  connectRedis?: () => Promise<void>;
  closeRedis?: () => Promise<void>;
  token?: string;
}

export function createApplication(options: ApplicationOptions = {}) {
  const client = options.client || new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
  const handler = options.handler || new MessageHandler();
  const onReady = () => logger.info(`Logged in as ${client.user?.tag}`);
  const onMessage = async (message: Parameters<MessageHandler['handleMessage']>[0]) => handler.handleMessage(message);
  let started = false;
  let stopped = false;
  return {
    client,
    async start() {
      if (started) return;
      await (options.connectRedis || (() => redisService.connect()))();
      client.on('ready', onReady);
      client.on('messageCreate', onMessage);
      await client.login(options.token ?? config.discord.token);
      started = true;
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      handler.close();
      client.off('ready', onReady);
      client.off('messageCreate', onMessage);
      client.destroy();
      started = false;
      await (options.closeRedis || (() => redisService.close()))();
      await closeLogger();
    }
  };
}

if (require.main === module) {
  const app = createApplication();
  app.start().catch(async error => {
    logger.error('Application startup failed:', error);
    await app.stop();
    process.exitCode = 1;
  });
  const shutdown = () => { void app.stop().catch(error => logger.error('Shutdown failed:', error)); };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
