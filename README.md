<p align="center">
  <img src="assets/banner.png" alt="Discord Peter Bot Banner" width="100%">
</p>

# Discord Peter
Nyehehehe, holy crap! It's me, Peter Griffin, but as a Discord bot! Using some fancy AI thing from Google (way smarter than me after that time I hit my head at the Clam), I'll chat with ya, look at your pictures, and keep the conversation going just like the real deal!

## Features

- Starts new conversations when you mention (`@`) the bot
- Maintains long-term conversational context when you reply to its messages
- Uses Redis to store and retrieve chat histories
- Understands and describes images shared in new messages and replies
- Uses Google's Gemini AI for natural language generation
- Has a 1% chance of responding to any message, even without a mention
- Natural typing simulation for responses
- Containerized for easy deployment with Docker
- Includes a Helm chart for easy and configurable deployment to Kubernetes

## Prerequisites

- Node.js (v18 or higher)
- npm
- Discord Bot Token
- Google Gemini API Key
- Redis (for local development)
- Docker (optional)
- Kubernetes cluster (optional)
- Helm (optional)

## Environment Variables

Create a `.env` file in the root directory:

```env
DISCORD_TOKEN=your_discord_bot_token
GEMINI_API_KEY=your_gemini_api_key
REDIS_URL=redis://localhost:6379
DEFAULT_PROVIDER=gemini
TEXT_MODEL=your_text_model_name
VISION_MODEL=your_vision_model_name
```

Default values if not specified:
- `TEXT_MODEL`: "gemini-2.0-flash"
- `VISION_MODEL`: "gemini-1.5-flash"
- `REDIS_URL`: The bot will use `redis://redis:6379` when running inside Docker Compose.

## Bot Usage

1. Create your Discord Bot:
   - Visit the [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a "New Application"
   - Go to the "Bot" section and create a bot
   - Save your bot token (for the `DISCORD_TOKEN` variable)
   - Enable "Message Content Intent" under the Bot section
2. Invite the bot to your server:
   - In your application's OAuth2 section, go to URL Generator
   - Select the `bot` scope
   - Select required permissions:
     - Read Messages/View Channels
     - Send Messages
     - Read Message History
   - Generate the invite URL, open it, and authorize it for your server
3. Start chatting:
   - **Start a new conversation**: Mention your bot in any channel (e.g., `@PeterGriffinBot What's up?`).
   - **Continue a conversation**: Simply reply to any of the bot's messages. The bot will use the history from that specific conversation to provide a contextual response.
## Installation

```bash
# Install dependencies
npm install

# Build the TypeScript code
npm run build

# Start the bot (ensure Redis is running locally)
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

This will start the bot application and a Redis container for storing chat history.

```bash
# Build the Docker image
docker compose build

# Run the containers in the background
docker compose up -d
```

## Helm Deployment

The Helm chart includes the application and Redis as a sub-chart, making it a complete deployment solution for Kubernetes.
### Installation

1.  Add the Helm repository:
    ```bash
    helm repo add discord-peter https://nikolayrk.github.io/discord-peter/
    helm repo update

2.  Deploy the chart:
    ```bash
    helm install discord-peter discord-peter/discord-peter \
      --namespace discord-peter \
      --create-namespace \
      --set secrets.discordToken=$DISCORD_TOKEN \
      --set secrets.geminiApiKey=$GEMINI_API_KEY
    ```
    *Replace `$DISCORD_TOKEN` and `$GEMINI_API_KEY` with your actual secrets.*

### Configuration

You can override the default values by using the `--set` flag or by providing a custom `values.yaml` file.

**Application Parameters:**

| Parameter                | Description                                          | Default                                        |
| ------------------------ | ---------------------------------------------------- | ---------------------------------------------- |
| `replicaCount`           | Number of pod replicas                               | `1`                                            |
| `image.repository`       | Docker image repository                              | `ghcr.io/nikolayrk/discord-peter`              |
| `image.tag`              | Docker image tag                                     | `latest`                                       |
| `config.textModel`       | Gemini model for text generation                     | `"gemini-2.0-flash"`                           |
| `config.visionModel`     | Gemini model for vision tasks                        | `"gemini-1.5-flash"`                           |
| `config.redisUrl`        | The connection URL for Redis                         | `redis://{{ .Release.Name }}-redis-master:6379`|
| `secrets.discordToken`    | Discord bot token                                    | `""`                                           |
| `secrets.geminiApiKey`    | Google Gemini API key                                | `""`                                           |
| `resources`              | Pod CPU/memory requests and limits                   | (sensible defaults)                            |


**Redis Sub-chart Configuration:**

The chart includes the Bitnami Redis sub-chart. You can enable persistence and configure it to use a pre-existing `StorageClass` (e.g., for an NFS volume).

Example of enabling persistence:
```bash
helm install discord-peter discord-peter/discord-peter \
  --namespace discord-peter \
  --create-namespace \
  --set secrets.discordToken=$DISCORD_TOKEN \
  --set secrets.geminiApiKey=$GEMINI_API_KEY \
  --set redis.master.persistence.enabled=true \
  --set redis.master.persistence.storageClass=your-storage-class \
  --set redis.master.persistence.size=1Gi
```
*Replace `your-storage-class` with the name of your `StorageClass`.*

| Redis Parameter                          | Description                               | Default     |
| ---------------------------------------- | ----------------------------------------- | ----------- |
| `redis.enabled`                          | Enables or disables the Redis sub-chart   | `true`      |
| `redis.master.persistence.enabled`       | Enables Redis persistence using a PVC     | `true`      |
| `redis.master.persistence.storageClass`  | The `StorageClass` to use for the volume  | `""`        |
| `redis.master.persistence.size`          | The size of the persistent volume         | `1Gi`       |

For a full list of Redis configuration options, refer to the [Bitnami Redis chart documentation](https://github.com/bitnami/charts/tree/main/bitnami/redis).

### Uninstallation

To uninstall the `discord-peter` deployment:

```bash
helm uninstall discord-peter --namespace discord-peter
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

[MIT License](LICENSE)