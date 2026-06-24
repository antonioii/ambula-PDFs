function validPayload() {
  return {
    patient: {
      name: 'Paciente Fictício',
      appointmentDate: '2026-06-23',
      recordNumber: 'SMA-001'
    },
    evolution: {
      interview: 'Comparece para acompanhamento.',
      hpp: '',
      hfam: ''
    },
    medications: [
      {
        name: 'Medicamento 20 mg',
        route: 'oral',
        type: 'CP',
        breakfast: '1',
        lunch: '',
        snack: '-',
        dinner: '0',
        bedtime: ''
      }
    ],
    months: 1
  };
}

module.exports = { validPayload };
