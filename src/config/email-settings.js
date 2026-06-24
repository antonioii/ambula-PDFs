const fs = require('node:fs/promises');
const path = require('node:path');
const { AppError } = require('../domain/errors');

function normalizeDestination(value) {
  const destination = String(value || '').trim().toLowerCase();
  if (destination && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) {
    throw new AppError('Informe um e-mail de destino válido.', 'INVALID_EMAIL_DESTINATION');
  }
  return destination;
}

function createEmailSettingsStore({ filePath }) {
  async function getSettings() {
    try {
      const value = JSON.parse(await fs.readFile(filePath, 'utf8'));
      return { destination: normalizeDestination(value.destination) };
    } catch (error) {
      if (error.code === 'ENOENT') return { destination: '' };
      if (error instanceof SyntaxError) {
        throw new AppError(
          'As configurações locais de e-mail estão inválidas.',
          'EMAIL_SETTINGS_INVALID'
        );
      }
      throw error;
    }
  }

  async function saveSettings(settings = {}) {
    const normalized = { destination: normalizeDestination(settings.destination) };
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.tmp`;
    await fs.writeFile(temporaryPath, JSON.stringify(normalized, null, 2), {
      encoding: 'utf8',
      mode: 0o600
    });
    await fs.rename(temporaryPath, filePath);
    return normalized;
  }

  return { getSettings, saveSettings };
}

module.exports = { createEmailSettingsStore, normalizeDestination };
