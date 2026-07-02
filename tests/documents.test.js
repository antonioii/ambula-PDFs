const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { PDFDocument } = require('pdf-lib');
const { generateBatch } = require('../src/documents/batch');
const { createEvolutionPdf } = require('../src/documents/evolution');
const { evolutionFields } = require('../src/documents/evolution');
const { createMedicationTablePdf } = require('../src/documents/medication-table');
const { createPrescriptionPdf } = require('../src/documents/prescription');
const { normalizePayload } = require('../src/domain/validation');
const { validPayload } = require('./fixtures');

const projectRoot = path.resolve(__dirname, '..');

async function fixtureFiles() {
  const templateDir = path.join(projectRoot, 'templates');
  const coordinateDir = path.join(templateDir, 'coordinates');
  return {
    evolutionTemplate: await fs.readFile(path.join(templateDir, 'ficha_evolucao.pdf')),
    tableTemplate: await fs.readFile(path.join(templateDir, 'tabela_organizar_remedios.pdf')),
    prescriptionTemplate: await fs.readFile(path.join(templateDir, 'remedio.pdf')),
    evolutionCoordinates: JSON.parse(
      await fs.readFile(path.join(coordinateDir, 'ficha_evolucao.json'), 'utf8')
    ),
    tableCoordinates: JSON.parse(
      await fs.readFile(path.join(coordinateDir, 'tabela_organizar_remedios.json'), 'utf8')
    ),
    prescriptionCoordinates: JSON.parse(
      await fs.readFile(path.join(templateDir, 'remedio.json'), 'utf8')
    )
  };
}

test('carimba os três templates sem sobrescrever os arquivos de origem', async () => {
  const files = await fixtureFiles();
  const data = normalizePayload(validPayload());

  const evolution = await createEvolutionPdf(
    files.evolutionTemplate,
    files.evolutionCoordinates,
    data
  );
  const table = await createMedicationTablePdf(files.tableTemplate, files.tableCoordinates, data);
  const prescription = await createPrescriptionPdf(
    files.prescriptionTemplate,
    files.prescriptionCoordinates,
    data,
    data.medications[0]
  );

  assert.notDeepEqual(Buffer.from(evolution), files.evolutionTemplate);
  assert.notDeepEqual(Buffer.from(table), files.tableTemplate);
  assert.notDeepEqual(Buffer.from(prescription), files.prescriptionTemplate);
  assert.equal((await PDFDocument.load(evolution)).getPageCount(), 1);
  assert.equal((await PDFDocument.load(table)).getPageCount(), 1);
  assert.equal((await PDFDocument.load(prescription)).getPageCount(), 1);
});

test('evolução usa hashtags e omite campos vazios', () => {
  const fields = evolutionFields(normalizePayload(validPayload()));
  assert.deepEqual(
    fields.map(([label]) => label),
    ['#Id', '#Entrevista/HDA']
  );
});

test('gera evolução com tamanho de fonte configurado sem alterar os demais documentos', async () => {
  const files = await fixtureFiles();
  const payload = validPayload();
  payload.evolution.fontSize = '14';
  const data = normalizePayload(payload);

  const evolution = await createEvolutionPdf(
    files.evolutionTemplate,
    files.evolutionCoordinates,
    data
  );
  const table = await createMedicationTablePdf(files.tableTemplate, files.tableCoordinates, data);
  const prescription = await createPrescriptionPdf(
    files.prescriptionTemplate,
    files.prescriptionCoordinates,
    data,
    data.medications[0]
  );

  assert.equal(data.evolution.fontSize, 14);
  assert.equal((await PDFDocument.load(evolution)).getPageCount(), 1);
  assert.equal((await PDFDocument.load(table)).getPageCount(), 1);
  assert.equal((await PDFDocument.load(prescription)).getPageCount(), 1);
});

test('gera lote completo e duplica cada prescrição pelo número de meses', async () => {
  const payload = validPayload();
  payload.months = 3;
  payload.medications.push({
    name: 'Outro medicamento 10 mg',
    route: 'oral',
    breakfast: '1/2',
    bedtime: '1/2'
  });

  const result = await generateBatch(payload, { projectRoot });
  const pdf = await PDFDocument.load(result.bytes);
  assert.equal(result.pageCount, 8);
  assert.equal(pdf.getPageCount(), 8);
});

test('não gera prescrições para linhas vazias do formulário de medicações', async () => {
  const payload = validPayload();
  payload.months = 1;
  payload.medications = [
    {
      name: 'Medicamento 1',
      route: 'ORAL',
      type: 'CP',
      breakfast: '1',
      monthlyQuantity: '30 CP'
    },
    {
      name: 'Medicamento 2',
      route: 'ORAL',
      type: 'CP',
      dinner: '1',
      monthlyQuantity: '30 CP'
    },
    {
      name: 'Medicamento 3',
      route: 'ORAL',
      type: 'CP',
      bedtime: '1',
      monthlyQuantity: '30 CP'
    },
    ...Array.from({ length: 7 }, () => ({ route: 'ORAL', type: 'CP', period: 'MENSAL' }))
  ];

  const result = await generateBatch(payload, { projectRoot });
  assert.equal(result.pageCount, 5);
  assert.equal((await PDFDocument.load(result.bytes)).getPageCount(), 5);
});

test('prescrição avulsa omite evolução', async () => {
  const payload = validPayload();
  payload.evolution = {};
  payload.months = 2;
  const result = await generateBatch(payload, { projectRoot, standalone: true });
  const pdf = await PDFDocument.load(result.bytes);
  assert.equal(pdf.getPageCount(), 3);
  assert.match(result.filename, /^PRESCRICAO_AVULSA_/);
});

test('gera lote completo com todos os campos vazios', async () => {
  const result = await generateBatch(
    { patient: {}, evolution: {}, medications: [], months: '' },
    { projectRoot }
  );
  const pdf = await PDFDocument.load(result.bytes);
  assert.equal(pdf.getPageCount(), 2);
  assert.match(result.filename, /^LOTE_\d{4}-\d{2}-\d{2}_SEM-ID\.pdf$/);
});

test('gera prescrição avulsa vazia somente com a tabela organizadora', async () => {
  const result = await generateBatch(
    { patient: {}, evolution: {}, medications: [], months: '' },
    { projectRoot, standalone: true }
  );
  assert.equal((await PDFDocument.load(result.bytes)).getPageCount(), 1);
});

test('gera receita com medicação parcialmente preenchida', async () => {
  const result = await generateBatch(
    {
      patient: {},
      evolution: {},
      medications: [{ breakfast: '1' }],
      months: 1
    },
    { projectRoot, standalone: true }
  );
  assert.equal((await PDFDocument.load(result.bytes)).getPageCount(), 2);
});

test('gera prescrição injetável com período sincronizado e quantidade informada', async () => {
  const payload = validPayload();
  payload.medications = [
    {
      name: 'Haldol decanoato 50 mg/ml',
      route: 'INJETAVEL IM',
      type: 'AMP',
      ampoules: '2',
      period: '15/15 DIAS',
      monthlyQuantity: '1 CX'
    }
  ];
  const normalized = normalizePayload(payload);
  assert.deepEqual(normalized.medications[0].schedules, Array(5).fill('15/15 DIAS'));

  const result = await generateBatch(payload, { projectRoot });
  assert.equal((await PDFDocument.load(result.bytes)).getPageCount(), 3);
});

test('rejeita evolução maior que as linhas físicas do template', async () => {
  const payload = validPayload();
  payload.evolution.interview = 'Texto de acompanhamento '.repeat(220);
  await assert.rejects(() => generateBatch(payload, { projectRoot }), /template comporta 32/i);
});
