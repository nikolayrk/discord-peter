const { splitDiscordResponse } = require('../../../dist/discord/responseChunks');

describe('Discord response chunks', () => {
  test.each([1999, 2000, 2001])('preserves a %i-character response', length => {
    const value = 'a'.repeat(length);
    const chunks = splitDiscordResponse(value);
    expect(chunks.join('')).toBe(value);
    expect(chunks.every(chunk => chunk.length <= 2000)).toBe(true);
  });

  test('does not split a surrogate pair at a message boundary', () => {
    const value = 'a'.repeat(1999) + '🙂';
    const chunks = splitDiscordResponse(value);
    expect(chunks).toEqual(['a'.repeat(1999), '🙂']);
    expect(chunks.join('')).toBe(value);
  });
});
