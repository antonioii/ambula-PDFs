const fs = require('node:fs/promises');
const path = require('node:path');
const { PDFDocument } = require('pdf-lib');
const { normalizePayload } = require('../domain/validation');
const { createBatchFilename } = require('../domain/filename');
const { createEvolutionPdf } = require('./evolution');
const { createMedicationTablePdf } = require('./medication-table');
const { createPrescriptionPdf } = require('./prescription');

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function appendPdf(target, sourceBytes) {
  const source = await PDFDocument.load(sourceBytes);
  const pages = await target.copyPages(source, source.getPageIndices());
  pages.forEach((page) => target.addPage(page));
}

async function generateBatch(payload, options = {}) {
  const standalone = Boolean(options.standalone);
  const data = normalizePayload(payload, { standalone });
  const projectRoot = options.projectRoot || path.resolve(__dirname, '../..');
  const templates = path.join(projectRoot, 'templates');
  const coordinatesDir = path.join(templates, 'coordinates');

  const [
    evolutionTemplate,
    tableTemplate,
    prescriptionTemplate,
    evolutionCoordinates,
    tableCoordinates,
    prescriptionCoordinates
  ] = await Promise.all([
    fs.readFile(path.join(templates, 'ficha_evolucao.pdf')),
    fs.readFile(path.join(templates, 'tabela_organizar_remedios.pdf')),
    fs.readFile(path.join(templates, 'remedio.pdf')),
    readJson(path.join(coordinatesDir, 'ficha_evolucao.json')),
    readJson(path.join(coordinatesDir, 'tabela_organizar_remedios.json')),
    readJson(path.join(templates, 'remedio.json'))
  ]);

  const batch = await PDFDocument.create();

  if (!standalone) {
    const evolution = await createEvolutionPdf(evolutionTemplate, evolutionCoordinates, data);
    await appendPdf(batch, evolution);
  }

  const table = await createMedicationTablePdf(tableTemplate, tableCoordinates, data);
  await appendPdf(batch, table);

  for (const medication of data.medications) {
    for (let month = 0; month < data.months; month += 1) {
      const prescription = await createPrescriptionPdf(
        prescriptionTemplate,
        prescriptionCoordinates,
        data,
        medication
      );
      await appendPdf(batch, prescription);
    }
  }

  const bytes = await batch.save();
  return {
    bytes: Buffer.from(bytes),
    filename: createBatchFilename({
      appointmentDate: data.patient.appointmentDate,
      recordNumber: data.patient.recordNumber,
      patientName: data.patient.name,
      standalone
    }),
    pageCount: batch.getPageCount()
  };
}

module.exports = { generateBatch, appendPdf };
