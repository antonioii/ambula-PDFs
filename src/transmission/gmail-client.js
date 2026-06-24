const { google } = require('googleapis');
const { AppError } = require('../domain/errors');

function createGmailClient({
  oauthClientConfig,
  tokenStore,
  googleApi = google
}) {
  async function createAuthorizedClient() {
    const [{ clientId, clientSecret }, tokens] = await Promise.all([
      oauthClientConfig.load(),
      tokenStore.getTokens()
    ]);
    if (!tokens) {
      throw new AppError(
        'Gmail não conectado. Abra a engrenagem e conecte uma conta Google.',
        'GMAIL_NOT_CONNECTED'
      );
    }

    const auth = new googleApi.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials(tokens);
    auth.on('tokens', async (updated) => {
      await tokenStore.setTokens({ ...tokens, ...updated });
    });
    return auth;
  }

  async function getClient() {
    const auth = await createAuthorizedClient();
    return googleApi.gmail({ version: 'v1', auth });
  }

  return { createAuthorizedClient, getClient };
}

module.exports = { createGmailClient };
