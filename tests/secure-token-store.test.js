const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createSecureTokenStore } = require('../src/config/secure-token-store');

test('tokens são persistidos cifrados, sanitizados e removidos', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ambulatorio-token-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'tokens.bin');
  const safeStorage = {
    isEncryptionAvailable: () => true,
    getSelectedStorageBackend: () => 'kwallet',
    encryptString: (value) => Buffer.from(`encrypted:${value}`),
    decryptString: (value) => value.toString().replace(/^encrypted:/, '')
  };
  const store = createSecureTokenStore({ safeStorage, filePath });

  await store.setTokens({
    access_token: 'access',
    refresh_token: 'refresh',
    expiry_date: 123,
    forbidden: 'não persistir'
  });
  const disk = await fs.readFile(filePath, 'utf8');
  assert.doesNotMatch(disk, /^{"access_token"/);
  assert.deepEqual(await store.getTokens(), {
    access_token: 'access',
    refresh_token: 'refresh',
    expiry_date: 123
  });
  await store.deleteTokens();
  assert.equal(await store.hasTokens(), false);
});

test('armazenamento recusa backend basic_text', async () => {
  const store = createSecureTokenStore({
    filePath: '/tmp/nao-usado',
    safeStorage: {
      isEncryptionAvailable: () => true,
      getSelectedStorageBackend: () => 'basic_text'
    }
  });
  await assert.rejects(() => store.getTokens(), { code: 'TOKEN_STORAGE_INSECURE' });
});
