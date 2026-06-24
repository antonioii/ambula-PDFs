const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createOAuthClientConfig } = require('../src/config/oauth-client');

async function temporaryFile(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ambulatorio-oauth-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return path.join(directory, 'oauth-client.local.json');
}

test('OAuth informa arquivo ausente sem expor credenciais', async (t) => {
  const config = createOAuthClientConfig({ filePath: await temporaryFile(t) });
  await assert.rejects(() => config.load(), { code: 'OAUTH_CLIENT_NOT_CONFIGURED' });
  const status = await config.getStatus();
  assert.equal(status.configured, false);
  assert.equal('clientId' in status, false);
});

test('OAuth rejeita JSON inválido e campos ausentes', async (t) => {
  const filePath = await temporaryFile(t);
  const config = createOAuthClientConfig({ filePath });
  await fs.writeFile(filePath, '{');
  await assert.rejects(() => config.load(), { code: 'OAUTH_CLIENT_INVALID' });
  await fs.writeFile(filePath, JSON.stringify({ client_id: 'id' }));
  await assert.rejects(() => config.load(), { code: 'OAUTH_CLIENT_NOT_CONFIGURED' });
});

test('OAuth carrega credenciais válidas somente no processo chamador', async (t) => {
  const filePath = await temporaryFile(t);
  await fs.writeFile(
    filePath,
    JSON.stringify({ client_id: 'client-id', client_secret: 'client-secret' })
  );
  const config = createOAuthClientConfig({ filePath });
  assert.deepEqual(await config.load(), {
    clientId: 'client-id',
    clientSecret: 'client-secret'
  });
  assert.deepEqual(await config.getStatus(), { configured: true });
});

test('OAuth aceita o formato instalado exportado pelo Google Cloud', async (t) => {
  const filePath = await temporaryFile(t);
  await fs.writeFile(
    filePath,
    JSON.stringify({
      installed: { client_id: 'desktop-id', client_secret: 'desktop-secret' }
    })
  );
  const config = createOAuthClientConfig({ filePath });
  assert.deepEqual(await config.load(), {
    clientId: 'desktop-id',
    clientSecret: 'desktop-secret'
  });
});
