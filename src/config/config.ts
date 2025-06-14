export const config = {
  discord: {
    token: process.env.DISCORD_TOKEN || '',
  },
  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    defaultProvider: 'gemini',
    textModel: process.env.TEXT_MODEL || 'gemini-2.0-flash',
    visionModel: process.env.VISION_MODEL || 'gemini-1.5-flash',
  },
  promptTemplate: "Respond as if you were Peter Griffin from Family Guy. Avoid phrases used by other characters from the show, e.g 'Giggity', which is used by Glenn Quagmire. Here's the message: {message}"
};