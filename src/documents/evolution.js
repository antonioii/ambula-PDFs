const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { AppError } = require('../domain/errors');
const { pdfSafeText, wrapText, drawAtTop } = require('./text');

function formatDate(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function evolutionFields(data) {
  const fields = [];
  if (data.patient.name) fields.push(['#Id', data.patient.name]);
  if (data.evolution.interview) fields.push(['#Entrevista/HDA', data.evolution.interview]);
  if (data.evolution.hpp) fields.push(['#HPP', data.evolution.hpp]);
  if (data.evolution.hfam) fields.push(['#HFAM', data.evolution.hfam]);
  if (data.evolution.summary) fields.push(['#Súmula', data.evolution.summary]);
  if (data.evolution.impression) fields.push(['#Impressão', data.evolution.impression]);
  if (data.evolution.conduct) fields.push(['#CD', data.evolution.conduct]);
  return fields;
}

async function createEvolutionPdf(templateBytes, coordinates, data) {
  const pdf = await PDFDocument.load(templateBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.getPage(0);
  const fontSize = 9;
  const maxWidth =
    coordinates.points.linha1_final.x - coordinates.points.linha1_inicio.x - 4;
  const lines = [];

  for (const [label, value] of evolutionFields(data)) {
    const boldLabel = `${label}:`;
    const labelWidth = boldFont.widthOfTextAtSize(`${boldLabel} `, fontSize);
    const firstLineWidth = maxWidth - labelWidth;
    const wrappedValue = wrapText(value, font, fontSize, firstLineWidth);

    lines.push({
      label: boldLabel,
      value: wrappedValue[0] || ''
    });

    if (wrappedValue.length > 1) {
      const remainingText = wrappedValue.slice(1).join(' ');
      lines.push(
        ...wrapText(remainingText, font, fontSize, maxWidth).map((line) => ({
          label: '',
          value: line
        }))
      );
    }
  }

  const availableLines = Object.keys(coordinates.points)
    .filter((key) => /^linha\d+_inicio$/.test(key))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

  if (lines.length > availableLines.length) {
    throw new AppError(
      `A evolução ocupa ${lines.length} linhas, mas o template comporta ${availableLines.length}. Resuma o texto antes de gerar.`,
      'EVOLUTION_OVERFLOW',
      { used: lines.length, available: availableLines.length }
    );
  }

  if (data.patient.appointmentDate) {
    drawAtTop(page, formatDate(data.patient.appointmentDate), {
      x: coordinates.points.primeiro_digito_data.x,
      topY: coordinates.points.primeiro_digito_data.y,
      size: 8,
      font,
      color: rgb(0, 0, 0)
    });
  }

  lines.forEach((line, index) => {
    const point = coordinates.points[availableLines[index]];
    const topY = point.y - fontSize - 1;
    drawAtTop(page, line.label, {
      x: point.x + 2,
      topY,
      size: fontSize,
      font: boldFont,
      color: rgb(0, 0, 0)
    });
    const labelWidth = line.label
      ? boldFont.widthOfTextAtSize(`${pdfSafeText(line.label)} `, fontSize)
      : 0;
    drawAtTop(page, line.value, {
      x: point.x + 2 + labelWidth,
      topY,
      size: fontSize,
      font,
      color: rgb(0, 0, 0)
    });
  });

  return pdf.save();
}

module.exports = { createEvolutionPdf, evolutionFields, formatDate };
