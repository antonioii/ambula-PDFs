const fs = require('node:fs/promises');
const path = require('node:path');
const { AppError } = require('../domain/errors');

const NOT_CONFIGURED_MESSAGE =
  'Credenciais OAuth não configuradas. Crie oauth-client.local.json na raiz do projeto com client_id e client_secret do Google Cloud.';

function validateOAuthClient(value) {
  const credentials = value?.installed || value?.web || value;
  if (
    !credentials ||
    typeof credentials.client_id !== 'string' ||
    !credentials.client_id.trim() ||
    typeof credentials.client_secret !== 'string' ||
    !credentials.client_secret.trim()
  ) {
    throw new AppError(NOT_CONFIGURED_MESSAGE, 'OAUTH_CLIENT_NOT_CONFIGURED');
  }

  return {
    clientId: credentials.client_id.trim(),
    clientSecret: credentials.client_secret.trim()
  };
}

function createOAuthClientConfig(options = {}) {
  const filePath =
    options.filePath || path.join(options.projectRoot || process.cwd(), 'oauth-client.local.json');

  async function load() {
    let contents;
    try {
      contents = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new AppError(NOT_CONFIGURED_MESSAGE, 'OAUTH_CLIENT_NOT_CONFIGURED');
      }
      throw error;
    }

    try {
      return validateOAuthClient(JSON.parse(contents));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new AppError(
          'O arquivo oauth-client.local.json contém JSON inválido.',
          'OAUTH_CLIENT_INVALID'
        );
      }
      throw error;
    }
  }

  async function getStatus() {
    try {
      await load();
      return { configured: true };
    } catch (error) {
      return {
        configured: false,
        error: {
          code: error.code || 'OAUTH_CLIENT_INVALID',
          message: error.message
        }
      };
    }
  }

  return { load, getStatus, filePath };
}

module.exports = {
  NOT_CONFIGURED_MESSAGE,
  createOAuthClientConfig,
  validateOAuthClient
};
