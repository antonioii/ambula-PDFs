const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createWorkflow } = require('../src/main/workflow');

test('Transmitir gera o lote antes de salvar', async () => {
  const calls = [];
  const workflow = createWorkflow({
    generate: async () => {
      calls.push('generate');
      return { bytes: Buffer.from('pdf'), filename: 'LOTE.pdf', pageCount: 4 };
    },
    save: async () => {
      calls.push('save');
      return { status: 'saved' };
    },
    print: async () => {
      calls.push('print');
      return { status: 'printed' };
    }
  });

  const result = await workflow({ payload: {}, mode: 'save' }, {});
  assert.deepEqual(calls, ['generate', 'save']);
  assert.equal(result.pageCount, 4);
});

test('e-mail é chamado somente após gerar o lote e pode ser mockado', async () => {
  const calls = [];
  const workflow = createWorkflow({
    generate: async () => {
      calls.push('generate');
      return { bytes: Buffer.from('pdf'), filename: 'LOTE.pdf', pageCount: 1 };
    },
    email: async () => {
      calls.push('email');
      return { status: 'emailed', messageId: 'mock-id' };
    }
  });

  const result = await workflow({ payload: {}, mode: 'email' }, {});
  assert.deepEqual(calls, ['generate', 'email']);
  assert.equal(result.status, 'emailed');
  assert.equal(result.pageCount, 1);
});

test('e-mail não é chamado quando a geração falha', async () => {
  let emailed = false;
  const workflow = createWorkflow({
    generate: async () => {
      throw new Error('falha de geração');
    },
    email: async () => {
      emailed = true;
    }
  });

  await assert.rejects(() => workflow({ payload: {}, mode: 'email' }, {}), /falha de geração/);
  assert.equal(emailed, false);
});

test('impressora é chamada somente após gerar e pode ser mockada', async () => {
  const calls = [];
  const workflow = createWorkflow({
    generate: async () => {
      calls.push('generate');
      return { bytes: Buffer.from('pdf'), filename: 'LOTE.pdf', pageCount: 2 };
    },
    print: async () => {
      calls.push('print');
      return { status: 'printed' };
    }
  });
  await workflow({ payload: {}, mode: 'printer' }, {});
  assert.deepEqual(calls, ['generate', 'print']);
});

test('UI mantém dez posições, cinco visíveis, scrollbar e opções obrigatórias', async () => {
  const root = path.resolve(__dirname, '..');
  const [html, css, js] = await Promise.all([
    fs.readFile(path.join(root, 'src/renderer/index.html'), 'utf8'),
    fs.readFile(path.join(root, 'src/renderer/styles.css'), 'utf8'),
    fs.readFile(path.join(root, 'src/renderer/app.js'), 'utf8')
  ]);

  assert.match(js, /index < 10/);
  assert.match(css, /\.medication-scroll[\s\S]*max-height: 230px[\s\S]*overflow-y: scroll/);
  assert.match(html, /Café[\s\S]*Almoço[\s\S]*Lanche[\s\S]*Jantar[\s\S]*Dormir/);
  assert.match(html, /Qtd\. p\.mês/);
  assert.match(js, /'ORAL', 'INJETAVEL IM', 'INALATORIO', 'TOPICO', 'OFTALMICO'/);
  assert.match(js, /'CP', 'AMP', 'GOTAS', 'ML', 'PUFF', 'CREME'/);
  assert.match(js, /'MENSAL', '15\/15 DIAS', '28\/28 DIAS', '21\/21 DIAS'/);
  assert.match(html, /id="injection-dialog"/);
  assert.match(html, /id="injection-ampoules"[^>]*min="1"[^>]*step="1"/);
  assert.match(js, /ampoules != null && \(!Number\.isInteger\(ampoules\)/);
  assert.match(js, /renderInjectionSchedules[\s\S]*data-schedule-slot/);
  assert.match(html, /Enviar por email/);
  assert.match(html, /Salvar no PC/);
  assert.match(html, /Impressora da rede/);
  assert.match(html, /id="months"[^>]*value="5"/);
  assert.match(html, /id="standalone-months"[^>]*value="5"/);
  assert.match(html, /id="new-appointment-dialog"/);
  assert.match(html, /id="new-appointment-confirm"/);
  assert.match(js, /\$\('#new-appointment-dialog'\)\.showModal\(\)/);
  assert.match(js, /function resetAppointment\(\)/);
  assert.doesNotMatch(js, /window\.confirm/);
  assert.match(html, /id="evolution-font-size"[\s\S]*value="8"[\s\S]*value="10" selected[\s\S]*value="14"/);
  assert.match(js, /fontSize: \$\('#evolution-font-size'\)\.value/);
  assert.match(js, /\$\('#evolution-font-size'\)\.value = '10'/);
  assert.match(js, /row\.dataset\.period = data\.period \|\| data\.breakfast \|\| ''/);
  assert.match(js, /window\.addEventListener\('keydown', handleZoomShortcut\)/);
  assert.match(js, /document\.body\.style\.zoom/);
  assert.match(html, /id="email-destination"[^>]*type="email"/);
  assert.match(html, /id="email-connect"/);
  assert.match(html, /id="email-disconnect"/);
  assert.match(html, /id="email-save"/);
  assert.match(html, /id="email-test"/);
  assert.match(html, /id="email-cancel-connect"/);
  assert.match(js, /window\.ambulatorio\.email\.getAuthStatus/);
  assert.match(js, /window\.ambulatorio\.email\.sendTest/);
  assert.match(js, /window\.ambulatorio\.email\.cancelConnect/);
  assert.match(js, /emailConnectInProgress/);
  assert.match(js, /\$\('#months'\)\.value = '5'/);
  assert.doesNotMatch(html, /<input[^>]*\srequired(?:\s|\/?>)/);
  assert.match(css, /\.actions\s*\{[\s\S]*position: fixed;[\s\S]*left: 20px;/);
  assert.match(css, /body\s*\{[\s\S]*overflow-x: hidden;/);
  assert.match(css, /\.workspace\s*\{[\s\S]*min-width: 0;/);
  assert.match(css, /\.medication-header\s*\{[\s\S]*min-width: 700px;/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.actions\s*\{[\s\S]*position: sticky;/);
  assert.doesNotMatch(html, /Adicionar medicação/i);

  const saveSource = await fs.readFile(path.join(root, 'src/transmission/save.js'), 'utf8');
  assert.match(saveSource, /showSaveDialog/);

  const preloadSource = await fs.readFile(path.join(root, 'src/preload/index.js'), 'utf8');
  assert.match(preloadSource, /email:get-settings/);
  assert.match(preloadSource, /email:connect/);
  assert.match(preloadSource, /email:cancel-connect/);
  assert.doesNotMatch(preloadSource, /token|client_secret/i);
});
