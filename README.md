<p align="center">
  <img src="assets/banner.png" alt="Discord Peter Bot Banner" width="100%">
</p>

# Discord Peter Bot

Nyehehehe, holy crap! It's me, Peter Griffin, but as a Discord bot! Using some fancy AI thing from Google (way smarter than me after that time I hit my head at the Clam), I'll chat with ya, look at your pictures, and keep the conversation going just like the real deal!

## Features

- Responds to mentions with Peter Griffin-style responses
- Uses Google's Gemini AI for natural language generation
- Understands and describes images shared in chat
- Supports conversation context through message replies
- Natural typing simulation with adaptive delays
- Handles multi-paragraph responses
- Containerized for easy deployment

## Prerequisites

- Node.js (v18 or higher)
- npm
- Discord Bot Token
- Google Gemini API Key
- Docker (optional)

## Environment Variables

Create a `.env` file in the root directory:

```env
DISCORD_TOKEN=your_discord_bot_token
GEMINI_API_KEY=your_gemini_api_key
TEXT_MODEL=your_text_model_name
VISION_MODEL=your_vision_model_name
```

Default values if not specified:
- TEXT_MODEL: "gemini-2.0-flash"
- VISION_MODEL: "gemini-1.5-flash"

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

## Docker Deployment

```bash
# Build the Docker image
docker compose build

# Run the container
docker compose up -d
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