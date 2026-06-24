const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { formatDailyInstruction } = require('../domain/dose');
const { fitFontSize, drawAtTop } = require('./text');

function drawBetween(page, font, text, start, end, preferred = 9) {
  const value = String(text ?? '').toUpperCase();
  if (!value) return;
  const size = fitFontSize(value, font, end.x - start.x, preferred, 6);
  drawAtTop(page, value, {
    x: start.x,
    topY: start.y - 5,
    size,
    font,
    color: rgb(0, 0, 0)
  });
}

async function createPrescriptionPdf(templateBytes, coordinates, data, medication) {
  const pdf = await PDFDocument.load(templateBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.getPage(0);
  const p = coordinates.points;
  const daily = formatDailyInstruction(medication);
  const monthly = medication.monthlyQuantity;

  if (medication.route === 'INJETAVEL IM') {
    for (const start of [
      p.letra_inicial_quantidade_diaria,
      p.letra_inicial_quantidade_diaria_copia
    ]) {
      page.drawRectangle({
        x: start.x,
        y: page.getHeight() - start.y - 13,
        width: 185,
        height: 18,
        color: rgb(1, 1, 1)
      });
    }
  }

  drawBetween(page, font, data.patient.name, p.primeira_letra_nome_paciente, p.ultima_letra_nome_paciente);
  drawBetween(
    page,
    font,
    data.patient.name,
    p.primeira_letra_nome_paciente_copia,
    p.ultima_letra_nome_paciente_copia
  );
  drawBetween(page, font, medication.name, p.primeira_letra_remedio, p.ultima_letra_remedio, 9);
  drawBetween(
    page,
    font,
    medication.name,
    p.primeira_letra_remedio_copia,
    p.ultima_letra_remedio_copia,
    9
  );
  drawBetween(page, font, medication.route, p.letra_inicial_tipo_de_uso, p.letra_final_tipo_de_uso, 8);
  drawBetween(
    page,
    font,
    medication.route,
    p.letra_inicial_tipo_de_uso_copia,
    p.letra_final_tipo_de_uso_copia,
    8
  );
  drawBetween(
    page,
    font,
    daily,
    p.letra_inicial_quantidade_diaria,
    medication.route === 'INJETAVEL IM'
      ? { x: p.letra_inicial_quantidade_diaria.x + 175, y: p.letra_final_quantidade_diaria.y }
      : p.letra_final_quantidade_diaria,
    9
  );
  drawBetween(
    page,
    font,
    daily,
    p.letra_inicial_quantidade_diaria_copia,
    medication.route === 'INJETAVEL IM'
      ? {
          x: p.letra_inicial_quantidade_diaria_copia.x + 175,
          y: p.letra_final_quantidade_diaria_copia.y
        }
      : p.letra_final_quantidade_diaria_copia,
    9
  );
  drawBetween(
    page,
    font,
    monthly,
    p.letra_inicial_quantidade_de_medicacao,
    p.letra_final_quantidade_de_medicacao,
    9
  );
  drawBetween(
    page,
    font,
    monthly,
    p.letra_inicial_quantidade_de_medicacao_copia,
    p.letra_final_quantidade_de_medicacao_copia,
    9
  );

  return pdf.save();
}

module.exports = { createPrescriptionPdf };
