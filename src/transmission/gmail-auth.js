const http = require('node:http');
const crypto = require('node:crypto');
const { google } = require('googleapis');
const { AppError } = require('../domain/errors');

const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

function callbackPage(message) {
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Gmail</title><body style="font-family:system-ui;padding:40px"><h1>${message}</h1><p>Você pode fechar esta janela e voltar ao aplicativo.</p></body></html>`;
}

function createGmailAuth({
  oauthClientConfig,
  tokenStore,
  openExternal,
  googleApi = google,
  timeoutMs = 180000
}) {
  async function getAuthStatus() {
    const credentials = await oauthClientConfig.getStatus();
    let connected = false;
    let storageError = null;
    try {
      connected = await tokenStore.hasTokens();
    } catch (error) {
      storageError = { code: error.code || 'TOKEN_STORAGE_UNAVAILABLE', message: error.message };
    }
    return { connected, credentials, storageError };
  }

  async function disconnect() {
    await tokenStore.deleteTokens();
    return getAuthStatus();
  }

  async function connect() {
    const { clientId, clientSecret } = await oauthClientConfig.load();
    const state = crypto.randomBytes(24).toString('hex');

    return new Promise((resolve, reject) => {
      let timeout;
      let settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        server.close();
        if (error) reject(error);
        else resolve(value);
      };

      const server = http.createServer(async (request, response) => {
        try {
          const requestUrl = new URL(request.url, 'http://127.0.0.1');
          if (requestUrl.pathname !== '/oauth2callback') {
            response.writeHead(404).end();
            return;
          }
          if (requestUrl.searchParams.get('state') !== state) {
            throw new AppError('Resposta OAuth com estado inválido.', 'OAUTH_STATE_INVALID');
          }
          if (requestUrl.searchParams.get('error')) {
            throw new AppError('A autenticação Google foi cancelada.', 'OAUTH_CANCELED');
          }
          const code = requestUrl.searchParams.get('code');
          if (!code) throw new AppError('Código OAuth não recebido.', 'OAUTH_CODE_MISSING');

          const address = server.address();
          const redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`;
          const auth = new googleApi.auth.OAuth2(clientId, clientSecret, redirectUri);
          const { tokens } = await auth.getToken(code);
          await tokenStore.setTokens(tokens);
          response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          response.end(callbackPage('Autenticação concluída'));
          finish(null, getAuthStatus());
        } catch (error) {
          response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          response.end(callbackPage('Não foi possível concluir a autenticação'));
          finish(error);
        }
      });

      server.once('error', (error) => finish(error));
      server.listen(0, '127.0.0.1', async () => {
        try {
          const address = server.address();
          const redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`;
          const auth = new googleApi.auth.OAuth2(clientId, clientSecret, redirectUri);
          const authorizationUrl = auth.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: [GMAIL_SEND_SCOPE],
            state
          });
          await openExternal(authorizationUrl);
        } catch (error) {
          finish(error);
        }
      });

      timeout = setTimeout(
        () =>
          finish(
            new AppError(
              'A autenticação Google expirou. Tente conectar novamente.',
              'OAUTH_TIMEOUT'
            )
          ),
        timeoutMs
      );
    });
  }

  return { connect, disconnect, getAuthStatus };
}

module.exports = { GMAIL_SEND_SCOPE, createGmailAuth };
