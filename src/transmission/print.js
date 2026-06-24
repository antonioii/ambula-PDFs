const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { BrowserWindow, app } = require('electron');

async function safeUnlink(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function printBatch(batch) {
  const tempPath = path.join(
    app.getPath('temp'),
    `ambulatorio-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp.pdf`
  );
  await fs.writeFile(tempPath, batch.bytes, { flag: 'wx' });

  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  return new Promise(async (resolve, reject) => {
    let settled = false;
    const finish = async (result, error) => {
      if (settled) return;
      settled = true;
      if (!printWindow.isDestroyed()) printWindow.destroy();
      try {
        await safeUnlink(tempPath);
      } catch {
        // Arquivo temporário será eliminado pelo sistema operacional.
      }
      if (error) reject(error);
      else resolve(result);
    };

    printWindow.on('closed', () => {
      if (!settled) finish({ status: 'canceled' });
    });

    try {
      await printWindow.loadURL(pathToFileURL(tempPath).href);
      printWindow.webContents.print(
        { silent: false, printBackground: true },
        (success, failureReason) => {
          if (!success && failureReason && failureReason !== 'Print job canceled') {
            finish(undefined, new Error(`Falha ao abrir impressão: ${failureReason}`));
            return;
          }
          finish({ status: success ? 'printed' : 'canceled' });
        }
      );
    } catch (error) {
      finish(undefined, error);
    }
  });
}

module.exports = { printBatch, safeUnlink };
