const fs = require('node:fs/promises');
const path = require('node:path');
const { AppError } = require('../domain/errors');

const ALLOWED_TOKEN_FIELDS = [
  'access_token',
  'refresh_token',
  'expiry_date',
  'scope',
  'token_type'
];

function sanitizeTokens(tokens = {}) {
  return Object.fromEntries(
    ALLOWED_TOKEN_FIELDS.filter((field) => tokens[field] != null).map((field) => [
      field,
      tokens[field]
    ])
  );
}

function createSecureTokenStore({ safeStorage, filePath }) {
  function assertSecureStorage() {
    if (!safeStorage?.isEncryptionAvailable?.()) {
      throw new AppError(
        'O armazenamento seguro de credenciais não está disponível neste sistema.',
        'TOKEN_STORAGE_UNAVAILABLE'
      );
    }
    if (
      typeof safeStorage.getSelectedStorageBackend === 'function' &&
      safeStorage.getSelectedStorageBackend() === 'basic_text'
    ) {
      throw new AppError(
        'O sistema não disponibilizou um cofre seguro para os tokens do Gmail.',
        'TOKEN_STORAGE_INSECURE'
      );
    }
  }

  async function getTokens() {
    try {
      assertSecureStorage();
      const encrypted = await fs.readFile(filePath);
      return JSON.parse(safeStorage.decryptString(encrypted));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      if (error instanceof SyntaxError) {
        throw new AppError('Os tokens OAuth locais estão inválidos.', 'OAUTH_TOKENS_INVALID');
      }
      throw error;
    }
  }

  async function setTokens(tokens) {
    assertSecureStorage();
    const sanitized = sanitizeTokens(tokens);
    if (!sanitized.access_token && !sanitized.refresh_token) {
      throw new AppError('O Google não retornou tokens OAuth válidos.', 'OAUTH_TOKENS_INVALID');
    }
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(
      filePath,
      safeStorage.encryptString(JSON.stringify(sanitized)),
      { mode: 0o600 }
    );
  }

  async function deleteTokens() {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  async function hasTokens() {
    return Boolean(await getTokens());
  }

  return { getTokens, setTokens, deleteTokens, hasTokens };
}

module.exports = { createSecureTokenStore, sanitizeTokens };
