const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseDoseValue,
  calculateDailyDose,
  calculateMonthlyQuantity,
  defaultMonthlyQuantity,
  formatDailyInstruction
} = require('../src/domain/dose');
const { normalizePayload } = require('../src/domain/validation');
const { createBatchFilename } = require('../src/domain/filename');
const { validPayload } = require('./fixtures');

test('converte números, frações e valores equivalentes a zero', () => {
  assert.equal(parseDoseValue('1/2'), 0.5);
  assert.equal(parseDoseValue('1,5'), 1.5);
  assert.equal(parseDoseValue('-'), 0);
  assert.equal(parseDoseValue(''), 0);
  assert.equal(parseDoseValue('0'), 0);
  assert.equal(parseDoseValue('5ml'), 5);
  assert.equal(parseDoseValue('10 gts'), 10);
});

test('aplica defaults de quantidade mensal por via e tipo', () => {
  assert.equal(
    defaultMonthlyQuantity({ route: 'ORAL', type: 'CP', schedules: ['1', '', '', '', ''] }),
    '30 CP'
  );
  assert.equal(defaultMonthlyQuantity({ route: 'ORAL', type: 'ML', schedules: [] }), '5 FR');
  assert.equal(defaultMonthlyQuantity({ route: 'ORAL', type: 'GOTAS', schedules: [] }), '2 FR');
  assert.equal(defaultMonthlyQuantity({ route: 'INJETAVEL IM', type: 'AMP', schedules: [] }), '1 CX');
  assert.equal(defaultMonthlyQuantity({ route: 'TOPICO', type: 'CREME', schedules: [] }), '1 CX');
});

test('normaliza via, tipo e instrução de injetável', () => {
  const payload = validPayload();
  payload.medications = [
    {
      name: 'Medicamento injetável',
      route: 'injetavel im',
      type: 'amp',
      ampoules: '2',
      period: '15/15 dias'
    }
  ];
  const medication = normalizePayload(payload).medications[0];
  assert.equal(medication.route, 'INJETAVEL IM');
  assert.equal(medication.type, 'AMP');
  assert.equal(medication.monthlyQuantity, '1 CX');
  assert.deepEqual(medication.schedules, Array(5).fill('15/15 DIAS'));
  assert.equal(formatDailyInstruction(medication), '2 AMP 15/15 DIAS');
});

test('rejeita quantidade fracionada de ampolas', () => {
  const payload = validPayload();
  payload.medications = [
    {
      name: 'Medicamento injetável',
      route: 'INJETAVEL IM',
      type: 'AMP',
      ampoules: '1.5',
      period: 'MENSAL'
    }
  ];
  assert.throws(() => normalizePayload(payload), /quantidade inteira de ampolas/i);
});

test('aceita identificação, evolução, meses e medicações vazios', () => {
  const normalized = normalizePayload({
    patient: {},
    evolution: {},
    medications: [],
    months: ''
  });
  assert.deepEqual(normalized.patient, {
    name: '',
    birthDate: '',
    recordNumber: '',
    appointmentDate: ''
  });
  assert.deepEqual(normalized.medications, []);
  assert.equal(normalized.months, 5);
  assert.equal(normalized.evolution.fontSize, 10);
});

test('ignora linhas orais vazias mesmo quando carregam período da UI', () => {
  const normalized = normalizePayload({
    patient: {},
    evolution: {},
    medications: [
      { name: 'Medicamento 1', route: 'ORAL', type: 'CP', breakfast: '1' },
      { route: 'ORAL', type: 'CP', period: 'MENSAL' },
      { route: 'ORAL', type: 'CP', period: 'MENSAL' }
    ],
    months: 1
  });

  assert.equal(normalized.medications.length, 1);
  assert.equal(normalized.medications[0].name, 'Medicamento 1');
});

test('normaliza tamanho da fonte da evolução entre 8 e 14', () => {
  const payload = validPayload();
  payload.evolution.fontSize = '14';
  assert.equal(normalizePayload(payload).evolution.fontSize, 14);

  payload.evolution.fontSize = '7';
  assert.throws(() => normalizePayload(payload), /fonte da evolução entre 8 e 14/i);

  payload.evolution.fontSize = '10.5';
  assert.throws(() => normalizePayload(payload), /fonte da evolução entre 8 e 14/i);
});

test('aceita medicação parcialmente preenchida e omite campos ausentes', () => {
  const normalized = normalizePayload({
    patient: {},
    evolution: {},
    medications: [{ breakfast: '1' }],
    months: 1
  });
  assert.equal(normalized.medications.length, 1);
  assert.equal(normalized.medications[0].name, '');
  assert.equal(normalized.medications[0].monthlyQuantity, '30 CP');
});

test('formata dose diária conforme tipo sem confundir meses com quantidade', () => {
  const payload = validPayload();
  payload.medications[0].type = 'GOTAS';
  payload.medications[0].breakfast = '5';
  payload.medications[0].bedtime = '10 gts';
  payload.medications[0].monthlyQuantity = '2 FR';
  const medication = normalizePayload(payload).medications[0];
  assert.equal(formatDailyInstruction(medication), '15 GOTAS');
  assert.equal(medication.monthlyQuantity, '2 FR');
});

test('calcula comprimidos por dia e quantidade mensal sem multiplicar pelos meses', () => {
  const schedules = ['1', '1/2', '-', '', '1'];
  assert.equal(calculateDailyDose(schedules), 2.5);
  assert.equal(calculateMonthlyQuantity(schedules), 75);

  const payload = validPayload();
  payload.months = 5;
  const normalized = normalizePayload(payload);
  assert.equal(normalized.months, 5);
  assert.equal(calculateMonthlyQuantity(normalized.medications[0].schedules), 30);
});

test('rejeita texto de horário que não pode gerar quantidade', () => {
  assert.throws(() => parseDoseValue('SOS'), /não pode ser convertida/);
  const payload = validPayload();
  payload.medications[0].snack = 'SOS';
  assert.throws(() => normalizePayload(payload), /medicação 1.*SOS/i);
});

test('limita medicações a dez', () => {
  const payload = validPayload();
  payload.medications = Array.from({ length: 11 }, (_, index) => ({
    name: `Medicamento ${index + 1}`,
    breakfast: '1'
  }));
  assert.throws(() => normalizePayload(payload), /limite é de 10/i);
});

test('cria nome sem expor o nome completo do paciente', () => {
  const filename = createBatchFilename({
    appointmentDate: '2026-06-23',
    patientName: 'Paciente Fictício de Teste',
    recordNumber: ''
  });
  assert.equal(filename, 'LOTE_2026-06-23_PFDT.pdf');
  assert.doesNotMatch(filename, /PACIENTE|FICTICIO|TESTE/);
});

test('cria nome seguro mesmo sem identificação ou data informadas', () => {
  const filename = createBatchFilename({
    appointmentDate: '',
    patientName: '',
    recordNumber: ''
  });
  assert.match(filename, /^LOTE_\d{4}-\d{2}-\d{2}_SEM-ID\.pdf$/);
});
