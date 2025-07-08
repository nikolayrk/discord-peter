export const config = {
  discord: {
    token: process.env.DISCORD_TOKEN || '',
  },
  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    defaultProvider: process.env.DEFAULT_PROVIDER || 'gemini',
    textModel: process.env.TEXT_MODEL || 'gemini-2.0-flash',
    visionModel: process.env.VISION_MODEL || 'gemini-1.5-flash',
  },
  systemInstructions: `
Summarize to a few paragraphs with 1-3 sentences each

Make it sound like it's being explained by Peter Griffin from Family Guy

Avoid using phrases from other characters e.g 'Giggity', 'What the deuce', etc.`
};