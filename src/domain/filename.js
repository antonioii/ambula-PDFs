function initialsFromName(name) {
  return String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'SEM-ID';
}

function sanitizeIdentifier(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .toUpperCase();
}

function createBatchFilename({ appointmentDate, recordNumber, patientName, standalone = false }) {
  const identifier = sanitizeIdentifier(recordNumber) || sanitizeIdentifier(initialsFromName(patientName));
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)
    ? appointmentDate
    : new Date().toISOString().slice(0, 10);
  const prefix = standalone ? 'PRESCRICAO_AVULSA' : 'LOTE';
  return `${prefix}_${safeDate}_${identifier}.pdf`;
}

module.exports = { initialsFromName, sanitizeIdentifier, createBatchFilename };
