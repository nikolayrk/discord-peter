import winston from 'winston';
import LokiTransport from 'winston-loki';

// Create winston logger with console and optional Loki transport
const transports: winston.transport[] = [
  // Console transport for local development
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf((info) => {
        const { level, message } = info;
        const additionalData = (info as any).additionalData;
        const args = additionalData && Array.isArray(additionalData) ? ` ${additionalData.map((arg: any) => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ')}` : '';
        return `${level}: ${message}${args}`;
      })
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
    if (args.length > 0) {
      winstonLogger.info(message, { additionalData: args });
    } else {
      winstonLogger.info(message);
    }
  },
  error: (message: string, ...args: any[]) => {
    if (args.length > 0) {
      winstonLogger.error(message, { additionalData: args });
    } else {
      winstonLogger.error(message);
    }
  },
  debug: (message: string, ...args: any[]) => {
    if (args.length > 0) {
      winstonLogger.debug(message, { additionalData: args });
    } else {
      winstonLogger.debug(message);
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (args.length > 0) {
      winstonLogger.warn(message, { additionalData: args });
    } else {
      winstonLogger.warn(message);
    }
  }
};