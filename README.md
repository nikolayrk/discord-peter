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

## Helm Deployment

This project can be deployed using Helm, a package manager for Kubernetes. The Helm chart is conveniently hosted on the GitHub Actions-generated repository within this project.

### Prerequisites

- Kubernetes cluster
- Helm installed

### Installation

1.  Add the repository:

    ```bash
    helm repo add discord-peter https://nikolayrk.github.io/discord-peter/
    helm repo update

2.  Deploy the chart:

    ```bash
    helm install discord-peter discord-peter/discord-peter \
      --set discordToken=$DISCORD_TOKEN \
      --set geminiApiKey=$GEMINI_API_KEY
    ```

    *Replace `$DISCORD_TOKEN` and `$GEMINI_API_KEY` with your actual Discord bot token and Gemini API key.*

### Configuration

The following table lists the configurable parameters of the `discord-peter` chart and their default values.

| Parameter                | Description                                          | Default                                        |
| ------------------------ | ---------------------------------------------------- | ---------------------------------------------- |
| `replicaCount`           | Number of pod replicas                               | `1`                                            |
| `image.repository`       | Docker image repository                              | `ghcr.io/nikolayrk/discord-peter`              |
| `image.tag`              | Docker image tag                                     | `latest`                                       |
| `image.pullPolicy`       | Docker image pull policy                             | `IfNotPresent`                                 |
| `nameOverride`           | Override the chart's name                             | `""`                                           |
| `fullnameOverride`       | Override the chart's full name                       | `""`                                           |
| `resources.requests.cpu`   | CPU request for the pod                              | `100m`                                         |
| `resources.requests.memory`| Memory request for the pod                           | `128Mi`                                        |
| `resources.limits.cpu`     | CPU limit for the pod                                | `200m`                                         |
| `resources.limits.memory`  | Memory limit for the pod                            | `256Mi`                                        |
| `config.textModel`       | Gemini model for text generation                     | `"gemini-2.0-flash"`                           |
| `config.visionModel`     | Gemini model for vision tasks                        | `"gemini-1.5-flash"`                           |
| `config.defaultProvider` | Default provider for AI tasks                        | `"gemini"`                                     |
| `secrets.discordToken`    | Discord bot token                                    | `""`                                           |
| `secrets.geminiApiKey`    | Google Gemini API key                                | `""`                                           |

You can specify each parameter using the `--set key=value` argument to `helm install`. For example, to specify a different image tag:

```bash
helm install discord-peter discord-peter/discord-peter \
  --set image.tag=latest \
  --set discordToken=$DISCORD_TOKEN \
  --set geminiApiKey=$GEMINI_API_KEY
```

Alternatively, you can provide a YAML file containing the configuration parameters:

```bash
helm install discord-peter discord-peter/discord-peter -f values.yaml
```

### Uninstallation

To uninstall the `discord-peter` deployment:

```bash
helm uninstall discord-peter
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

[MIT License](LICENSE)