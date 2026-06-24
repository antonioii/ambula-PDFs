const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { fitFontSize, drawAtTop } = require('./text');
const { formatDate } = require('./evolution');

const ORDINALS = [
  'primeira',
  'segunda',
  'terceira',
  'quarta',
  'quinta',
  'sexta',
  'setima',
  'oitava',
  'nona',
  'decima'
];
const SCHEDULE_NAMES = ['cafe', 'almoço', 'lanche', 'jantar', 'dormir'];

function drawFitted(page, font, text, start, end, preferred = 9) {
  const value = String(text ?? '').toUpperCase();
  const size = fitFontSize(value, font, end.x - start.x, preferred, 6);
  drawAtTop(page, value, {
    x: start.x,
    topY: start.y,
    size,
    font,
    color: rgb(0, 0, 0)
  });
}

function drawCenteredSchedule(page, font, text, point) {
  const value = String(text || '').toUpperCase();
  if (!value) return;
  const size = fitFontSize(value, font, 52, 8, 5);
  const width = font.widthOfTextAtSize(value, size);
  drawAtTop(page, value, {
    x: point.x - width / 2,
    topY: point.y,
    size,
    font,
    color: rgb(0, 0, 0)
  });
}

async function createMedicationTablePdf(templateBytes, coordinates, data) {
  const pdf = await PDFDocument.load(templateBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.getPage(0);
  const points = coordinates.points;
  const patientName = data.patient.name.toUpperCase();
  const date = formatDate(data.patient.appointmentDate);

  if (patientName) {
    drawFitted(
      page,
      font,
      patientName,
      points.primeira_letra_nome_da_pessoa,
      points.ultima_letra_nome_da_pessoa,
      9
    );
    drawFitted(page, font, patientName, points.nome_copia_inicio, points.nome_copia_final, 9);
  }
  if (date) {
    drawFitted(page, font, date, points.primeiro_digito_data, points.ultimo_digito_data, 9);
    drawFitted(page, font, date, points.data_copia_inicio, points.data_copia_final, 9);
  }

  data.medications.forEach((medication, index) => {
    const ordinal = ORDINALS[index];
    const primaryStart = points[`${ordinal}_linha_primeira_letra_remedio`];
    const primaryEnd = points[`${ordinal}_linha_ultima_letra_remedio`];
    const copyStart = points[`linha${index + 1}_copia_inicio`];
    const copyEnd = points[`linha${index + 1}_copia_final`];

    drawFitted(page, font, medication.name, primaryStart, primaryEnd, 8);
    drawFitted(page, font, medication.name, copyStart, copyEnd, 8);

    medication.schedules.forEach((value, scheduleIndex) => {
      const primary = points[`linha${index + 1}_posologia_${SCHEDULE_NAMES[scheduleIndex]}`];
      const copy = points[
        `linha${index + 1}_posologia_${SCHEDULE_NAMES[scheduleIndex]}_copia`
      ];
      drawCenteredSchedule(page, font, value, primary);
      drawCenteredSchedule(page, font, value, { ...copy, x: copy.x + 10 });
    });
  });

  return pdf.save();
}

module.exports = { createMedicationTablePdf };
