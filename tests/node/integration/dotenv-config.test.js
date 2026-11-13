const { mkdtemp, writeFile, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('dotenv loads before configuration and preserves existing values', async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'peter-env-'));
  try {
    await writeFile(path.join(cwd, '.env'), 'TEXT_MODEL=from-file\nDEFAULT_PROVIDER=ollama\n');
    const modulePath = path.resolve(__dirname, '../../../dist/config/config.js');
    const script = `const { config } = require(${JSON.stringify(modulePath)}); process.stdout.write(JSON.stringify(config.ai));`;
    const result = spawnSync(process.execPath, ['-r', 'dotenv/config', '-e', script], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, TEXT_MODEL: 'from-env', DEFAULT_PROVIDER: 'openai' }
    });
    expect(result.status).toBe(0);
    const ai = JSON.parse(result.stdout);
    expect(ai.textModel).toBe('from-env');
    expect(ai.defaultProvider).toBe('openai');
  } finally { await rm(cwd, { recursive: true, force: true }); }
});
