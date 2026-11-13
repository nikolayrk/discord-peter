const { withServer } = require('../../fixtures/httpServer');

describe('Ollama HTTP integration', () => {
  afterEach(() => jest.restoreAllMocks());

  test('reads fragmented JSON and the last record without a newline', async () => {
    await withServer((req, res) => {
      req.resume();
      res.writeHead(200, { 'content-type': 'application/x-ndjson' });
      res.write('{"message":{"content":"hel');
      setTimeout(() => { res.end('lo "},"done":false}\n{"message":{"content":"world"},"done":true}'); }, 5);
    }, async url => {
      process.env.OLLAMA_URL = url;
      jest.resetModules();
      const { OllamaProvider } = require('../../../dist/ai/providers/ollama');
      const chunks = [];
      await new OllamaProvider().generateStreamingResponse({ prompt: 'hi', images: [], history: [] }, chunk => chunks.push(chunk));
      expect(chunks.join('')).toBe('hello world');
    });
  });
});
