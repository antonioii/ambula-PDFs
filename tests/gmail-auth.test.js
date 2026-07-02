const test = require('node:test');
const assert = require('node:assert/strict');
const { createGmailAuth } = require('../src/transmission/gmail-auth');

test('OAuth localhost valida state, salva tokens e retorna status sanitizado', async () => {
  let storedTokens = null;
  class OAuth2 {
    constructor(_clientId, _clientSecret, redirectUri) {
      this.redirectUri = redirectUri;
    }

    generateAuthUrl({ state }) {
      const url = new URL('https://auth.test/authorize');
      url.searchParams.set('state', state);
      url.searchParams.set('redirect_uri', this.redirectUri);
      return url.toString();
    }

    async getToken(code) {
      assert.equal(code, 'authorization-code');
      return { tokens: { access_token: 'access', refresh_token: 'refresh' } };
    }
  }

  const tokenStore = {
    hasTokens: async () => Boolean(storedTokens),
    setTokens: async (tokens) => {
      storedTokens = tokens;
    },
    deleteTokens: async () => {
      storedTokens = null;
    }
  };
  const auth = createGmailAuth({
    oauthClientConfig: {
      load: async () => ({ clientId: 'id', clientSecret: 'secret' }),
      getStatus: async () => ({ configured: true })
    },
    tokenStore,
    googleApi: { auth: { OAuth2 } },
    openExternal: async (authorizationUrl) => {
      const url = new URL(authorizationUrl);
      const redirect = new URL(url.searchParams.get('redirect_uri'));
      redirect.searchParams.set('state', url.searchParams.get('state'));
      redirect.searchParams.set('code', 'authorization-code');
      const response = await fetch(redirect);
      assert.equal(response.status, 200);
    },
    timeoutMs: 3000
  });

  const status = await auth.connect();
  assert.deepEqual(status, {
    connected: true,
    credentials: { configured: true },
    storageError: null
  });
  assert.equal(JSON.stringify(status).includes('access'), false);
  assert.equal(JSON.stringify(status).includes('secret'), false);

  const disconnected = await auth.disconnect();
  assert.equal(disconnected.connected, false);
  assert.equal(storedTokens, null);
});

test('OAuth pendente pode ser cancelado sem aguardar timeout', async () => {
  class OAuth2 {
    constructor(_clientId, _clientSecret, redirectUri) {
      this.redirectUri = redirectUri;
    }

    generateAuthUrl({ state }) {
      const url = new URL('https://auth.test/authorize');
      url.searchParams.set('state', state);
      url.searchParams.set('redirect_uri', this.redirectUri);
      return url.toString();
    }
  }

  let markOpened;
  const opened = new Promise((resolve) => {
    markOpened = resolve;
  });
  const auth = createGmailAuth({
    oauthClientConfig: {
      load: async () => ({ clientId: 'id', clientSecret: 'secret' }),
      getStatus: async () => ({ configured: true })
    },
    tokenStore: {
      hasTokens: async () => false,
      setTokens: async () => {},
      deleteTokens: async () => {}
    },
    googleApi: { auth: { OAuth2 } },
    openExternal: async () => {
      markOpened();
    },
    timeoutMs: 3000
  });

  const pending = auth.connect();
  await opened;
  assert.deepEqual(auth.cancelConnect(), { canceled: true });
  await assert.rejects(pending, /cancelada/i);
  assert.deepEqual(auth.cancelConnect(), { canceled: false });
});
