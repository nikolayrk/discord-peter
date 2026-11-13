const { Readable } = require('node:stream');

describe('Ollama stream parsing', () => {
  afterEach(() => jest.restoreAllMocks());

  test('processes a final unterminated NDJSON record', async () => {
    process.env.OLLAMA_URL = 'http://ollama.invalid';
    jest.resetModules();
    const { OllamaProvider } = require('../../../dist/ai/providers/ollama');
    const provider = new OllamaProvider();
    const encoder = new TextEncoder();
    const responseText = [
      JSON.stringify({ message: { content: 'one' }, done: false }) + '\n',
      JSON.stringify({ message: { content: 'two🙂' }, done: true }),
    ].join('');
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(Readable.toWeb(Readable.from([encoder.encode(responseText)]))));
    const chunks = [];
    await provider.generateStreamingResponse({ prompt: 'hi', images: [], history: [] }, chunk => chunks.push(chunk));
    expect(chunks.join('')).toBe('onetwo🙂');
  });
});
