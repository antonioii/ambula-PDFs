const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createEmailSettingsStore, normalizeDestination } = require('../src/config/email-settings');

test('configuração de e-mail normaliza e persiste somente o destino', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ambulatorio-settings-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'email-settings.json');
  const store = createEmailSettingsStore({ filePath });

  assert.deepEqual(await store.getSettings(), { destination: '' });
  await store.saveSettings({ destination: ' DESTINO@EXEMPLO.COM ' });
  assert.deepEqual(await store.getSettings(), { destination: 'destino@exemplo.com' });
  assert.deepEqual(JSON.parse(await fs.readFile(filePath, 'utf8')), {
    destination: 'destino@exemplo.com'
  });
});

test('configuração rejeita e-mail inválido', () => {
  assert.throws(() => normalizeDestination('email-invalido'), /e-mail de destino válido/);
});
