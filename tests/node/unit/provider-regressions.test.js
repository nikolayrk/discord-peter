describe('provider regressions', () => {
  afterEach(() => jest.restoreAllMocks());

  test('Gemini rejects an image download that returns HTTP 404', async () => {
    process.env.GEMINI_API_KEY = 'offline-test-key';
    jest.resetModules();
    const { GeminiProvider } = require('../../../dist/ai/providers/gemini');
    const provider = new GeminiProvider();
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('missing', { status: 404, statusText: 'Not Found' }));
    await expect(provider.processImage('http://fixture.invalid/missing.png')).rejects.toThrow('404 Not Found');
  });

  test('OpenAI history converts user and model turns to user and assistant roles', () => {
    process.env.OPENAI_API_KEY = 'offline-test-key';
    process.env.OPENAI_BASE_URL = 'http://fixture.invalid/v1';
    jest.resetModules();
    const { OpenAIProvider } = require('../../../dist/ai/providers/openai');
    const provider = new OpenAIProvider();
    const messages = provider.buildMessages('current', [], [
      { role: 'user', parts: [{ text: 'earlier question' }] },
      { role: 'model', parts: [{ text: 'earlier answer' }] }
    ]);
    expect(messages.slice(1).map(message => message.role)).toEqual(['user', 'assistant', 'user']);
    expect(messages[1].content).toBe('earlier question');
    expect(messages[2].content).toBe('earlier answer');
  });
});
