const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const requireApp = createRequire('/app/package.json');
const { createClient } = requireApp('redis');
const { MessageHandler } = requireApp('./dist/discord/messageHandler');

async function main() {
  const redis = createClient({ url: process.env.REDIS_URL });
  redis.on('error', error => console.error('Redis integration error', error));
  await redis.connect();
  const calls = [];
  const provider = {
    async generateStreamingResponse(params, onChunk) {
      calls.push(params);
      const answer = calls.length === 1 ? 'A'.repeat(2001) : 'follow-up received';
      onChunk(answer.slice(0, 900));
      onChunk(answer.slice(900));
    }
  };
  const handler = new MessageHandler({ provider, redis });
  const bot = { id: 'integration-bot', username: 'Peter' };
  const generated = [];
  let thread;
  const makeChannel = (id, inThread) => ({
    id,
    isThread: () => inThread,
    isTextBased: () => true,
    async sendTyping() {},
    async send(payload) {
      const msg = { id: randomUUID(), content: payload.content, ...payload, async edit(update) { Object.assign(this, update); } };
      generated.push(msg);
      return msg;
    },
    messages: { cache: new Map(), async fetch() { throw new Error('not found'); } },
    threads: { async create() { return thread; } }
  });
  const parent = makeChannel('parent', false);
  thread = makeChannel(randomUUID(), true);
  const guild = { id: 'offline-guild' };
  const makeMessage = ({ content, userId, tag, channel, mention = false }) => ({
    id: randomUUID(), content, author: { id: userId, tag, bot: false }, client: { user: bot },
    channel, channelId: channel.id, guild, reference: null, hasThread: false,
    mentions: { has: () => mention }, attachments: { filter: () => ({ map: () => [] }) },
    async startThread() { return thread; }
  });

  try {
    const initial = makeMessage({ content: '<@integration-bot> start offline chat', userId: 'user-1', tag: 'Ada#1', channel: parent, mention: true });
    await handler.handleMessage(initial);
    if (generated.length !== 2 || generated.some(message => message.content.length > 2000)) throw new Error('Initial streamed response was not split into valid Discord messages');
    const membership = await redis.sMembers('peter:threads');
    if (!membership.includes(thread.id)) throw new Error('Thread participation was not saved');
    const firstHistory = JSON.parse(await redis.get(`peter:history:${thread.id}`));
    if (firstHistory.length !== 2 || firstHistory[1].parts[0].text.length !== 2001) throw new Error('Full initial turn was not saved');
    for (const message of generated) if (await redis.get(`peter:reply:${message.id}`) !== thread.id) throw new Error('A generated message is missing its thread mapping');

    await handler.handleMessage(makeMessage({ content: 'continue with context', userId: 'user-2', tag: 'Grace#2', channel: thread }));
    await new Promise(resolve => setTimeout(resolve, 2300));
    if (calls.length !== 2) throw new Error(`Expected initial request and one follow-up, got ${calls.length}`);
    if (!calls[1].prompt.includes('Grace#2 (user-2)')) throw new Error('Collective prompt did not identify its author');
    if (calls[1].history.length < 2) throw new Error('Follow-up did not receive the prior conversation history');
    console.log('CHART_HARNESS_SUCCESS');
    await new Promise(resolve => setInterval(resolve, 60000));
  } finally {
    handler.close();
    await redis.quit();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
