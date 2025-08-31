import winston from 'winston';
import LokiTransport from 'winston-loki';

// Create winston logger with console and optional Loki transport
const transports: winston.transport[] = [
  // Console transport for local development
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  })
];

// Only add Loki transport if LOKI_URL is configured
if (process.env.LOKI_URL) {
  transports.push(
    new LokiTransport({
      host: process.env.LOKI_URL,
      labels: { 
        app: 'discord-peter'
      },
      json: true,
      format: winston.format.json(),
      replaceTimestamp: true,
      onConnectionError: (err) => {
        console.error('Loki connection error:', err);
      }
    })
  );
  console.log(`Logger: Loki transport enabled for ${process.env.LOKI_URL}`);
} else {
  console.log('Logger: Loki transport disabled (LOKI_URL not set)');
}

const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports
});

export const logger = {
  info: (message: string, ...args: any[]) => {
    winstonLogger.info(message, ...args);
  },
  error: (message: string, ...args: any[]) => {
    winstonLogger.error(message, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    winstonLogger.debug(message, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    winstonLogger.warn(message, ...args);
  }
};