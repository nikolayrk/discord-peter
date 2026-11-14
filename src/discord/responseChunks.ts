export function splitDiscordResponse(response: string, limit = 2000): string[] {
  const chunks: string[] = [];
  let remaining = response;
  while (remaining.length > limit) {
    let end = limit;
    // Do not split a UTF-16 surrogate pair.
    if (/[\uD800-\uDBFF]/.test(remaining[end - 1]) && /[\uDC00-\uDFFF]/.test(remaining[end])) end--;
    const window = remaining.slice(0, end);
    const minimum = Math.floor(end * 0.7);
    const breaks = [window.lastIndexOf('\n\n'), window.lastIndexOf('\n')];
    const sentence = [...window.matchAll(/[.!?]["'’”)]*\s+/g)].pop();
    if (sentence && sentence.index !== undefined) breaks.push(sentence.index + sentence[0].length);
    breaks.push(window.lastIndexOf(' ') + 1);
    const natural = breaks.find(position => position >= minimum);
    if (natural) end = natural;
    chunks.push(remaining.slice(0, end));
    remaining = remaining.slice(end);
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
