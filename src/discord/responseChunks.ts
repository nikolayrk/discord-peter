export function splitDiscordResponse(response: string, limit = 2000): string[] {
  const chunks: string[] = [];
  let chunk = '';
  for (const character of response) {
    if (chunk.length + character.length > limit) {
      chunks.push(chunk);
      chunk = '';
    }
    chunk += character;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}
