const { AppError } = require('./errors');
const { calculateDailyDose, defaultMonthlyQuantity } = require('./dose');

const SCHEDULE_KEYS = ['breakfast', 'lunch', 'snack', 'dinner', 'bedtime'];
const MAX_MEDICATIONS = 10;
const MAX_MONTHS = 24;
const ROUTES = ['ORAL', 'INJETAVEL IM', 'INALATORIO', 'TOPICO', 'OFTALMICO'];
const MEDICATION_TYPES = ['CP', 'AMP', 'GOTAS', 'ML', 'PUFF', 'CREME'];
const INJECTION_PERIODS = ['MENSAL', '15/15 DIAS', '28/28 DIAS', '21/21 DIAS'];
const EVOLUTION_FONT_SIZES = [8, 9, 10, 11, 12, 13, 14];

function cleanText(value, maxLength = 5000) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim().slice(0, maxLength);
}

function normalizeMedication(medication = {}, index) {
  const name = cleanText(medication.name, 120);
  const route = cleanText(medication.route || 'ORAL', 30).toUpperCase();
  const type = cleanText(medication.type || 'CP', 10).toUpperCase();
  const schedules = SCHEDULE_KEYS.map((key) => cleanText(medication[key], 20).toUpperCase());
  const period = cleanText(medication.period || schedules[0], 20).toUpperCase();
  const ampoulesText = cleanText(medication.ampoules, 20);
  const ampoules = ampoulesText ? Number(ampoulesText.replace(',', '.')) : null;
  const monthlyQuantity = cleanText(medication.monthlyQuantity, 30).toUpperCase();
  return {
    index: index + 1,
    name,
    route,
    type,
    schedules,
    period,
    ampoules,
    monthlyQuantity
  };
}

function normalizePayload(payload = {}, { standalone = false } = {}) {
  const patient = {
    name: cleanText(payload.patient?.name, 160),
    birthDate: cleanText(payload.patient?.birthDate, 10),
    recordNumber: cleanText(payload.patient?.recordNumber, 50),
    appointmentDate: cleanText(payload.patient?.appointmentDate, 10)
  };

  if (patient.appointmentDate && !/^\d{4}-\d{2}-\d{2}$/.test(patient.appointmentDate)) {
    throw new AppError('Informe uma data de atendimento válida.', 'VALIDATION_ERROR');
  }

  const sourceMedications = Array.isArray(payload.medications) ? payload.medications : [];
  if (sourceMedications.length > MAX_MEDICATIONS) {
    throw new AppError('O limite é de 10 medicações.', 'TOO_MANY_MEDICATIONS');
  }
  const medications = sourceMedications
    .map(normalizeMedication)
    .filter(
      (medication) =>
        medication.name ||
        medication.schedules.some(Boolean) ||
        medication.route !== 'ORAL' ||
        medication.type !== 'CP' ||
        medication.monthlyQuantity ||
        medication.ampoules != null ||
        (medication.route === 'INJETAVEL IM' && medication.period)
    );

  for (const medication of medications) {
    if (!ROUTES.includes(medication.route)) {
      throw new AppError(`Selecione uma via válida na medicação ${medication.index}.`, 'VALIDATION_ERROR');
    }
    if (!MEDICATION_TYPES.includes(medication.type)) {
      throw new AppError(`Selecione um tipo válido na medicação ${medication.index}.`, 'VALIDATION_ERROR');
    }
    if (medication.route === 'INJETAVEL IM') {
      if (
        medication.ampoules != null &&
        (!Number.isInteger(medication.ampoules) || medication.ampoules <= 0)
      ) {
        throw new AppError(
          `Informe uma quantidade inteira de ampolas na medicação ${medication.index}.`,
          'VALIDATION_ERROR'
        );
      }
      if (medication.period && !INJECTION_PERIODS.includes(medication.period)) {
        throw new AppError(
          `Selecione o período do injetável na medicação ${medication.index}.`,
          'VALIDATION_ERROR'
        );
      }
      medication.schedules = medication.period
        ? Array(5).fill(medication.period)
        : Array(5).fill('');
    } else {
      try {
        calculateDailyDose(medication.schedules);
      } catch (error) {
        if (error instanceof AppError) {
          throw new AppError(
            `Corrija a medicação ${medication.index} (${medication.name}): ${error.message}`,
            error.code,
            { medicationIndex: medication.index }
          );
        }
        throw error;
      }
    }

    if (!medication.monthlyQuantity) {
      medication.monthlyQuantity = defaultMonthlyQuantity(medication);
    }
  }

  const monthsText = cleanText(payload.months, 3);
  const months = monthsText ? Number(monthsText) : 5;
  if (!Number.isInteger(months) || months < 1 || months > MAX_MONTHS) {
    throw new AppError(`Meses/cópias deve ser um número entre 1 e ${MAX_MONTHS}.`, 'VALIDATION_ERROR');
  }

  const evolutionFontSizeText = cleanText(payload.evolution?.fontSize, 10);
  const evolutionFontSize = evolutionFontSizeText ? Number(evolutionFontSizeText) : 10;
  const evolution = {
    interview: cleanText(payload.evolution?.interview),
    hpp: cleanText(payload.evolution?.hpp),
    hfam: cleanText(payload.evolution?.hfam),
    summary: cleanText(payload.evolution?.summary),
    impression: cleanText(payload.evolution?.impression),
    conduct: cleanText(payload.evolution?.conduct),
    fontSize: evolutionFontSize
  };

  if (!Number.isInteger(evolution.fontSize) || !EVOLUTION_FONT_SIZES.includes(evolution.fontSize)) {
    throw new AppError('Selecione um tamanho de fonte da evolução entre 8 e 14.', 'VALIDATION_ERROR');
  }

  return { patient, evolution, medications, months, standalone };
}

module.exports = {
  SCHEDULE_KEYS,
  MAX_MEDICATIONS,
  MAX_MONTHS,
  ROUTES,
  MEDICATION_TYPES,
  INJECTION_PERIODS,
  EVOLUTION_FONT_SIZES,
  normalizePayload
};
