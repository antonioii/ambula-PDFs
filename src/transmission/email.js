const { AppError } = require('../domain/errors');

function base64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildMimeMessage({
  to,
  subject,
  body,
  attachmentBytes,
  attachmentName = 'lote.pdf'
}) {
  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0'
  ];

  if (!attachmentBytes) {
    return base64Url(
      [...headers, 'Content-Type: text/plain; charset="UTF-8"', '', body].join('\r\n')
    );
  }

  const boundary = `ambulatorio-${Date.now().toString(16)}`;
  const message = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${attachmentName}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${attachmentName}"`,
    '',
    Buffer.from(attachmentBytes).toString('base64'),
    `--${boundary}--`,
    ''
  ].join('\r\n');
  return base64Url(message);
}

function createEmailService({ settingsStore, gmailClient }) {
  async function sendMessage({ subject, body, attachmentBytes, attachmentName }) {
    const { destination } = await settingsStore.getSettings();
    if (!destination) {
      throw new AppError(
        'Configure o e-mail de destino na engrenagem antes de enviar.',
        'EMAIL_DESTINATION_NOT_CONFIGURED'
      );
    }

    const gmail = await gmailClient.getClient();
    const raw = buildMimeMessage({
      to: destination,
      subject,
      body,
      attachmentBytes,
      attachmentName
    });
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw }
    });
    return response.data?.id || null;
  }

  async function sendBatch(batch) {
    const messageId = await sendMessage({
      subject: 'Lote ambulatorial',
      body: 'Segue em anexo o lote ambulatorial gerado pelo aplicativo local.',
      attachmentBytes: batch.bytes,
      attachmentName: batch.filename
    });
    return { status: 'emailed', messageId };
  }

  async function sendTest() {
    const messageId = await sendMessage({
      subject: 'Teste de envio',
      body: 'Este é um teste de envio do Gerador Ambulatorial. Nenhum dado clínico foi incluído.'
    });
    return { status: 'test-emailed', messageId };
  }

  return { sendBatch, sendTest };
}

module.exports = { base64Url, buildMimeMessage, createEmailService };
