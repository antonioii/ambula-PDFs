const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMimeMessage, createEmailService } = require('../src/transmission/email');

function decodeBase64Url(value) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

test('MIME inclui PDF em base64url com assunto genérico', () => {
  const raw = buildMimeMessage({
    to: 'destino@example.com',
    subject: 'Lote ambulatorial',
    body: 'Mensagem genérica.',
    attachmentBytes: Buffer.from('PDF FICTICIO'),
    attachmentName: 'LOTE_2026-06-23_AB.pdf'
  });
  const decoded = decodeBase64Url(raw);
  assert.match(decoded, /Subject: Lote ambulatorial/);
  assert.match(decoded, /Content-Type: application\/pdf/);
  assert.match(decoded, new RegExp(Buffer.from('PDF FICTICIO').toString('base64')));
  assert.doesNotMatch(decoded, /Paciente Exemplo|medicação|diagnóstico/i);
});

test('serviço envia lote pelo cliente Gmail mockado', async () => {
  let request;
  const service = createEmailService({
    settingsStore: { getSettings: async () => ({ destination: 'destino@example.com' }) },
    gmailClient: {
      getClient: async () => ({
        users: {
          messages: {
            send: async (value) => {
              request = value;
              return { data: { id: 'message-id' } };
            }
          }
        }
      })
    }
  });

  const result = await service.sendBatch({
    bytes: Buffer.from('pdf'),
    filename: 'LOTE.pdf'
  });
  assert.equal(result.status, 'emailed');
  assert.equal(result.messageId, 'message-id');
  assert.equal(request.userId, 'me');
  assert.ok(request.requestBody.raw);
});

test('serviço não envia sem destinatário e teste não inclui anexo clínico', async () => {
  let calls = 0;
  const missingDestination = createEmailService({
    settingsStore: { getSettings: async () => ({ destination: '' }) },
    gmailClient: { getClient: async () => ({}) }
  });
  await assert.rejects(
    () => missingDestination.sendBatch({ bytes: Buffer.from('pdf'), filename: 'LOTE.pdf' }),
    { code: 'EMAIL_DESTINATION_NOT_CONFIGURED' }
  );

  const service = createEmailService({
    settingsStore: { getSettings: async () => ({ destination: 'destino@example.com' }) },
    gmailClient: {
      getClient: async () => ({
        users: {
          messages: {
            send: async ({ requestBody }) => {
              calls += 1;
              const decoded = decodeBase64Url(requestBody.raw);
              assert.match(decoded, /Subject: Teste de envio/);
              assert.doesNotMatch(decoded, /application\/pdf/);
              return { data: { id: 'test-id' } };
            }
          }
        }
      })
    }
  });
  await service.sendTest();
  assert.equal(calls, 1);
});
