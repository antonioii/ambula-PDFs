const fs = require('node:fs/promises');
const { dialog } = require('electron');

async function saveBatch(ownerWindow, batch) {
  const result = await dialog.showSaveDialog(ownerWindow, {
    title: 'Salvar lote PDF',
    defaultPath: batch.filename,
    filters: [{ name: 'Documento PDF', extensions: ['pdf'] }],
    properties: ['createDirectory', 'showOverwriteConfirmation']
  });

  if (result.canceled || !result.filePath) {
    return { status: 'canceled' };
  }

  await fs.writeFile(result.filePath, batch.bytes, { flag: 'w' });
  return { status: 'saved', filename: batch.filename };
}

module.exports = { saveBatch };
