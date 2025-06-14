<p align="center">
  <img src="assets/banner.png" alt="Discord Peter Bot Banner" width="100%">
</p>

# <img src="https://discord.com/assets/847541504914fd33810e70a0ea73177e.ico" height="25"> Discord Peter
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

1. Create your Discord Bot:
   - Visit the [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a "New Application"
   - Go to the "Bot" section and create a bot
   - Save your bot token (you'll need it for the DISCORD_TOKEN env variable)
   - Enable "Message Content Intent" in the Bot section
   - For detailed instructions, see [Discord's Bot Creation Guide](https://discord.com/developers/docs/getting-started)
2. Invite the bot to your server:
   - In your application's OAuth2 section
   - Select `bot` scope
   - Select required permissions:
     - Read Messages/View Channels
     - Send Messages
     - Read Message History
   - Generate the invite URL and open it
   - Select your server and authorize

3. Start chatting:
   - Mention your bot in any channel
   - Send text messages, images, or both
   - Reply to any message while mentioning the bot to maintain conversation context
   - The bot will respond as Peter Griffin, including describing any images you share

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

[MIT License](LICENSE)