const { generateBatch } = require('../documents/batch');
const { AppError } = require('../domain/errors');

function createWorkflow(dependencies = {}) {
  const generate = dependencies.generate || generateBatch;
  const save = dependencies.save;
  const print = dependencies.print;
  const email = dependencies.email;

  return async function transmit({ payload, mode, standalone = false }, ownerWindow) {
    if (!['email', 'save', 'printer'].includes(mode)) {
      throw new AppError('Selecione uma forma de transmissão válida.', 'INVALID_TRANSMISSION');
    }

    const batch = await generate(payload, { standalone });

    if (mode === 'email') {
      if (!email) throw new AppError('Serviço de e-mail indisponível.', 'EMAIL_UNAVAILABLE');
      return { ...(await email(batch)), pageCount: batch.pageCount };
    }
    if (mode === 'save') {
      return { ...(await save(ownerWindow, batch)), pageCount: batch.pageCount };
    }
    return { ...(await print(batch)), pageCount: batch.pageCount };
  };
}

module.exports = { createWorkflow };
