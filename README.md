# Discord Peter Bot

A Discord bot that responds as Peter Griffin from Family Guy using Google's Gemini AI. The bot processes messages, maintains conversation context, and responds with Peter Griffin's characteristic style and humor.

## Features

- Responds to mentions with Peter Griffin-style responses
- Uses Google's Gemini AI for natural language generation
- Supports conversation context through message replies
- Natural typing simulation with adaptive delays
- Handles multi-paragraph responses

## Prerequisites

- Node.js (v18 or higher)
- npm
- Discord Bot Token
- Google Gemini API Key

## Environment Variables

Create a `.env` file in the root directory:

```env
DISCORD_TOKEN=your_discord_bot_token
GEMINI_API_KEY=your_gemini_api_key
MODEL=gemini_model
```

## Installation

```bash
# Install dependencies
npm install

# Build the TypeScript code
npm run build

# Start the bot
npm start
```

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Run linting
npm run lint

# Run tests
npm run test
```

## Bot Usage

1. Invite the bot to your Discord server
2. Mention the bot (@Peter) in any channel
3. The bot will respond as Peter Griffin
4. Reply to any of the bot's messages while mentioning it to maintain conversation context

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

[MIT License](LICENSE)