const { AppError } = require('./errors');

const ZERO_VALUES = new Set(['', '-', '0']);

function parseDoseValue(value) {
  const normalized = String(value ?? '').trim().replace(',', '.').toUpperCase();

  if (ZERO_VALUES.has(normalized)) return 0;

  const decimal = normalized.match(/^(\d+(?:\.\d+)?)\s*(?:CP|ML|GTS|GOTAS|PUFF)?$/);
  if (decimal) {
    return Number(decimal[1]);
  }

  const fraction = normalized.match(
    /^(\d+)\s*\/\s*(\d+)\s*(?:CP|ML|GTS|GOTAS|PUFF)?$/
  );
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator === 0) {
      throw new AppError(`A dose "${value}" possui denominador zero.`, 'INVALID_DOSE');
    }
    return Number(fraction[1]) / denominator;
  }

  throw new AppError(
    `A dose "${value}" não pode ser convertida em quantidade. Use número, fração, unidade curta, 0, vazio ou "-".`,
    'INVALID_DOSE',
    { value }
  );
}

function calculateDailyDose(schedules) {
  return schedules.reduce((total, value) => total + parseDoseValue(value), 0);
}

function calculateMonthlyQuantity(schedules) {
  return calculateDailyDose(schedules) * 30;
}

function formatQuantity(value) {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(2))).replace('.', ',');
}

function defaultMonthlyQuantity({ route, type, schedules }) {
  if (route === 'INJETAVEL IM') return '1 CX';
  if (route === 'ORAL' && type === 'CP') {
    if (!schedules.some((value) => String(value ?? '').trim())) return '';
    return `${formatQuantity(calculateMonthlyQuantity(schedules))} CP`;
  }
  if (route === 'ORAL' && type === 'ML') return '5 FR';
  if (route === 'ORAL' && type === 'GOTAS') return '2 FR';
  return '1 CX';
}

function formatDailyInstruction(medication) {
  if (medication.route === 'INJETAVEL IM') {
    if (medication.ampoules == null && !medication.period) return '';
    const amount =
      medication.ampoules == null
        ? ''
        : `${formatQuantity(medication.ampoules)} ${medication.type}`;
    return `${amount} ${medication.period}`.trim();
  }
  if (!medication.schedules.some((value) => String(value ?? '').trim())) return '';
  return `${formatQuantity(calculateDailyDose(medication.schedules))} ${medication.type}`.trim();
}

module.exports = {
  parseDoseValue,
  calculateDailyDose,
  calculateMonthlyQuantity,
  formatQuantity,
  defaultMonthlyQuantity,
  formatDailyInstruction
};
