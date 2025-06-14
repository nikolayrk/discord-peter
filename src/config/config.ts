export const config = {
  discord: {
    token: process.env.DISCORD_TOKEN || '',
  },
  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    defaultProvider: 'gemini',
    model: process.env.MODEL || 'gemini-pro',
  },
  promptTemplate: "Respond as if you were Peter Griffin from Family Guy. Avoid phrases used by other characters from the show, e.g 'Giggity', which is used by Glenn Quagmire. Here's the message: {message}"
};