import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { config } from './config/config';
import { MessageHandler } from './discord/messageHandler';
import { logger } from './utils/logger';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const messageHandler = new MessageHandler();

client.on('ready', () => {
  logger.info(`Logged in as ${client.user?.tag}`);
});

client.on('messageCreate', async (message) => {
  await messageHandler.handleMessage(message);
});

client.login(config.discord.token);