const $ = (selector) => document.querySelector(selector);

const ROUTES = ['ORAL', 'INJETAVEL IM', 'INALATORIO', 'TOPICO', 'OFTALMICO'];
const TYPES = ['CP', 'AMP', 'GOTAS', 'ML', 'PUFF', 'CREME'];
const PERIODS = ['MENSAL', '15/15 DIAS', '28/28 DIAS', '21/21 DIAS'];
const SCHEDULES = ['breakfast', 'lunch', 'snack', 'dinner', 'bedtime'];
const UI_ZOOM_MIN = 0.8;
const UI_ZOOM_MAX = 1.3;
const UI_ZOOM_STEP = 0.1;
let activeInjectionRow = null;
let currentEmailAuthStatus = null;
let currentUiZoom = 1;
let emailConnectInProgress = false;

function applyUiZoom(value) {
  currentUiZoom = Math.min(UI_ZOOM_MAX, Math.max(UI_ZOOM_MIN, Number(value.toFixed(1))));
  document.body.style.zoom = String(currentUiZoom);
}

function handleZoomShortcut(event) {
  if (!event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.key === '+' || event.key === '=' || event.code === 'NumpadAdd') {
    event.preventDefault();
    applyUiZoom(currentUiZoom + UI_ZOOM_STEP);
    return;
  }
  if (event.key === '-' || event.code === 'NumpadSubtract') {
    event.preventDefault();
    applyUiZoom(currentUiZoom - UI_ZOOM_STEP);
  }
}

function options(values, selected) {
  return values
    .map((value) => {
      const label = value.includes('/') ? value.replace('DIAS', 'dias') : value;
      return `<option value="${value}"${value === selected ? ' selected' : ''}>${label}</option>`;
    })
    .join('');
}

function numericDose(value) {
  const normalized = String(value || '').trim().replace(',', '.').toUpperCase();
  if (!normalized || normalized === '-' || normalized === '0') return 0;
  const decimal = normalized.match(/^(\d+(?:\.\d+)?)\s*(?:CP|ML|GTS|GOTAS|PUFF)?$/);
  if (decimal) return Number(decimal[1]);
  const fraction = normalized.match(
    /^(\d+)\s*\/\s*(\d+)\s*(?:CP|ML|GTS|GOTAS|PUFF)?$/
  );
  if (fraction && Number(fraction[2]) !== 0) return Number(fraction[1]) / Number(fraction[2]);
  return null;
}

function formatNumber(value) {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(2))).replace('.', ',');
}

function scheduleValues(row) {
  return SCHEDULES.map((field) => row.querySelector(`[data-field="${field}"]`)?.value || '');
}

function calculatedMonthlyQuantity(row) {
  const route = row.querySelector('[data-field="route"]').value;
  const type = row.querySelector('[data-field="type"]').value;
  if (route === 'INJETAVEL IM') return '1 CX';
  if (route === 'ORAL' && type === 'ML') return '5 FR';
  if (route === 'ORAL' && type === 'GOTAS') return '2 FR';
  if (route === 'ORAL' && type === 'CP') {
    const values = scheduleValues(row).map(numericDose);
    if (values.some((value) => value === null)) return row.querySelector('[data-field="monthlyQuantity"]').value;
    if (scheduleValues(row).every((value) => !String(value).trim())) return '';
    return `${formatNumber(values.reduce((total, value) => total + value, 0) * 30)} CP`;
  }
  return '1 CX';
}

function updateMonthlyQuantity(row, force = false) {
  const input = row.querySelector('[data-field="monthlyQuantity"]');
  if (force || row.dataset.monthlyAuto === 'true') {
    input.value = calculatedMonthlyQuantity(row);
    row.dataset.monthlyAuto = 'true';
  }
}

function renderNormalSchedules(row, values = row._normalSchedules || Array(5).fill('')) {
  row.querySelectorAll('[data-schedule-slot]').forEach((slot, index) => {
    slot.innerHTML = `<input data-field="${SCHEDULES[index]}" maxlength="20" value="${values[index] || ''}" aria-label="${SCHEDULES[index]}" />`;
    slot.querySelector('input').addEventListener('input', () => updateMonthlyQuantity(row));
  });
}

function renderInjectionSchedules(row, period) {
  row.querySelectorAll('[data-schedule-slot]').forEach((slot, index) => {
    slot.innerHTML = `<select data-field="${SCHEDULES[index]}" aria-label="${SCHEDULES[index]}">${options(PERIODS, period)}</select>`;
    slot.querySelector('select').addEventListener('change', (event) => {
      row.dataset.period = event.target.value;
      row.querySelectorAll('[data-schedule-slot] select').forEach((select) => {
        select.value = event.target.value;
      });
    });
  });
}

function setRoute(row, route, { openPopup = false } = {}) {
  const previousRoute = row.dataset.route || 'ORAL';
  if (previousRoute !== 'INJETAVEL IM') row._normalSchedules = scheduleValues(row);
  row.dataset.route = route;

  if (route === 'INJETAVEL IM') {
    row.querySelector('[data-field="type"]').value = 'AMP';
    const period = row.dataset.period || 'MENSAL';
    renderInjectionSchedules(row, period);
    updateMonthlyQuantity(row, true);
    if (openPopup) {
      activeInjectionRow = row;
      $('#injection-ampoules').value = row.dataset.ampoules || '1';
      $('#injection-period').value = period;
      $('#injection-dialog').showModal();
    }
  } else {
    if (previousRoute === 'INJETAVEL IM') renderNormalSchedules(row);
    updateMonthlyQuantity(row, true);
  }
}

function bindRow(row) {
  row.querySelector('[data-field="route"]').addEventListener('change', (event) => {
    setRoute(row, event.target.value, { openPopup: event.target.value === 'INJETAVEL IM' });
  });
  row.querySelector('[data-field="type"]').addEventListener('change', () => updateMonthlyQuantity(row, true));
  row.querySelector('[data-field="monthlyQuantity"]').addEventListener('input', () => {
    row.dataset.monthlyAuto = 'false';
  });
  renderNormalSchedules(row);
  updateMonthlyQuantity(row, true);
}

function createMedicationRows(container, prefix) {
  const rows = [];
  for (let index = 0; index < 10; index += 1) {
    const row = document.createElement('div');
    row.className = 'medication-row medication-grid';
    row.innerHTML = `
      <span>${index + 1}</span>
      <input class="medication-name" data-field="name" maxlength="120" aria-label="Medicação ${index + 1}" />
      <select data-field="route" aria-label="Via da medicação ${index + 1}">${options(ROUTES, 'ORAL')}</select>
      <select data-field="type" aria-label="Tipo da medicação ${index + 1}">${options(TYPES, 'CP')}</select>
      ${SCHEDULES.map(() => '<span data-schedule-slot></span>').join('')}
      <input class="monthly-quantity" data-field="monthlyQuantity" maxlength="30" aria-label="Quantidade por mês da medicação ${index + 1}" />
    `;
    row.dataset.group = prefix;
    row.dataset.route = 'ORAL';
    row.dataset.monthlyAuto = 'true';
    container.appendChild(row);
    bindRow(row);
    rows.push(row);
  }
  return rows;
}

const mainRows = createMedicationRows($('#medication-rows'), 'main');
const standaloneRows = createMedicationRows($('#standalone-medication-rows'), 'standalone');

function readRows(rows) {
  return rows.map((row) => ({
    ...Object.fromEntries(
      [...row.querySelectorAll('[data-field]')].map((control) => [control.dataset.field, control.value])
    ),
    ampoules: row.dataset.ampoules || '',
    period: row.dataset.period || ''
  }));
}

function applyRowData(row, data) {
  row.querySelector('[data-field="name"]').value = data.name || '';
  row.querySelector('[data-field="route"]').value = data.route || 'ORAL';
  row.querySelector('[data-field="type"]').value = data.type || 'CP';
  row.dataset.ampoules = data.ampoules || '';
  row.dataset.period = data.period || data.breakfast || '';
  row.dataset.monthlyAuto = 'false';
  row._normalSchedules = SCHEDULES.map((field) => data[field] || '');
  setRoute(row, data.route || 'ORAL');
  row.querySelector('[data-field="type"]').value =
    data.type || (data.route === 'INJETAVEL IM' ? 'AMP' : 'CP');
  if ((data.route || 'ORAL') !== 'INJETAVEL IM') renderNormalSchedules(row, row._normalSchedules);
  row.querySelector('[data-field="monthlyQuantity"]').value =
    data.monthlyQuantity || calculatedMonthlyQuantity(row);
}

function copyRows(source, target) {
  readRows(source).forEach((data, index) => applyRowData(target[index], data));
}

function patientPayload() {
  return {
    name: $('#patient-name').value,
    birthDate: $('#birth-date').value,
    recordNumber: $('#record-number').value,
    appointmentDate: $('#appointment-date').value
  };
}

function mainPayload() {
  return {
    patient: patientPayload(),
    evolution: {
      interview: $('#interview').value,
      hpp: $('#hpp').value,
      hfam: $('#hfam').value,
      summary: $('#summary').value,
      impression: $('#impression').value,
      conduct: $('#conduct').value,
      fontSize: $('#evolution-font-size').value
    },
    medications: readRows(mainRows),
    months: $('#months').value
  };
}

function standalonePayload() {
  return {
    patient: patientPayload(),
    evolution: {},
    medications: readRows(standaloneRows),
    months: $('#standalone-months').value
  };
}

function selectedMode() {
  return document.querySelector('input[name="output-mode"]:checked').value;
}

function setStatus(message, kind = '') {
  const status = $('#status');
  status.textContent = message;
  status.className = `status ${kind}`.trim();
  if ($('#standalone-dialog').open) {
    const standaloneStatus = $('#standalone-status');
    standaloneStatus.textContent = message;
    standaloneStatus.className = `status ${kind}`.trim();
  }
}

async function executeTransmission(payload, standalone) {
  const button = standalone ? $('#standalone-transmit') : $('#transmit-button');
  button.disabled = true;
  setStatus('Validando dados e gerando o PDF atualizado...');

  try {
    const response = await window.ambulatorio.transmit({
      payload,
      mode: selectedMode(),
      standalone
    });

    if (!response.ok) {
      setStatus(response.error.message, 'error');
      return;
    }

    const { status, pageCount } = response.result;
    if (status === 'canceled') {
      setStatus('Operação cancelada. Nenhum arquivo foi alterado.');
      return;
    }
    const action =
      status === 'saved'
        ? 'salvo'
        : status === 'emailed'
          ? 'enviado por e-mail'
          : 'enviado ao diálogo de impressão';
    setStatus(`PDF ${action} com ${pageCount} página(s).`, 'success');
    if (standalone) $('#standalone-dialog').close();
  } catch {
    setStatus('Falha inesperada na comunicação com o aplicativo.', 'error');
  } finally {
    button.disabled = false;
  }
}

function cancelInjectionConfiguration() {
  if (activeInjectionRow) {
    activeInjectionRow.querySelector('[data-field="route"]').value = 'ORAL';
    setRoute(activeInjectionRow, 'ORAL');
  }
  activeInjectionRow = null;
  $('#injection-dialog').close();
}

$('#injection-confirm').addEventListener('click', () => {
  const ampoulesText = $('#injection-ampoules').value.trim();
  const ampoules = ampoulesText ? Number(ampoulesText) : null;
  if (ampoules != null && (!Number.isInteger(ampoules) || ampoules <= 0)) {
    $('#injection-ampoules').focus();
    return;
  }
  const period = $('#injection-period').value;
  activeInjectionRow.dataset.ampoules = ampoules == null ? '' : String(ampoules);
  activeInjectionRow.dataset.period = period;
  renderInjectionSchedules(activeInjectionRow, period);
  activeInjectionRow = null;
  $('#injection-dialog').close();
});

$('#injection-cancel').addEventListener('click', cancelInjectionConfiguration);
$('#injection-close').addEventListener('click', cancelInjectionConfiguration);
$('#transmit-button').addEventListener('click', () => executeTransmission(mainPayload(), false));

$('#standalone-button').addEventListener('click', () => {
  copyRows(mainRows, standaloneRows);
  $('#standalone-months').value = $('#months').value;
  $('#standalone-status').textContent =
    'A forma de saída selecionada na tela principal será utilizada.';
  $('#standalone-status').className = 'status';
  $('#standalone-dialog').showModal();
});

$('#standalone-transmit').addEventListener('click', () =>
  executeTransmission(standalonePayload(), true)
);

function setEmailStatus(message, kind = '') {
  const status = $('#email-status');
  status.textContent = message;
  status.className = `status ${kind}`.trim();
}

function setEmailBusy(busy, { cancellable = false } = {}) {
  ['#email-connect', '#email-disconnect', '#email-save', '#email-test'].forEach((selector) => {
    $(selector).disabled = busy;
  });
  $('#email-cancel-connect').hidden = !cancellable;
  $('#email-cancel-connect').disabled = !cancellable;
  if (!busy && currentEmailAuthStatus) renderEmailAuthStatus(currentEmailAuthStatus);
}

function renderEmailAuthStatus(status) {
  currentEmailAuthStatus = status;
  const configured = status.credentials?.configured;
  $('#email-credentials-title').textContent = configured
    ? 'Credenciais OAuth configuradas'
    : 'Credenciais OAuth não configuradas';
  $('#email-credentials-copy').textContent = configured
    ? 'O arquivo local foi validado. Os valores permanecem restritos ao processo principal.'
    : status.credentials?.error?.message || 'Não foi possível validar oauth-client.local.json.';
  $('#email-credentials-notice').classList.toggle('error', !configured);
  $('#email-auth-status').textContent = status.connected ? 'Gmail conectado' : 'Não conectado';
  $('#email-storage-status').textContent = status.storageError
    ? 'Indisponível'
    : 'Cofre disponível';
  $('#email-connect').disabled = !configured || Boolean(status.storageError);
  $('#email-disconnect').disabled = !status.connected;
  $('#email-test').disabled = !status.connected;
}

async function loadEmailConfiguration() {
  setEmailBusy(true);
  setEmailStatus('Carregando configurações...');
  try {
    const [settingsResponse, authResponse] = await Promise.all([
      window.ambulatorio.email.getSettings(),
      window.ambulatorio.email.getAuthStatus()
    ]);
    if (!settingsResponse.ok) throw new Error(settingsResponse.error.message);
    if (!authResponse.ok) throw new Error(authResponse.error.message);
    $('#email-destination').value = settingsResponse.result.destination || '';
    renderEmailAuthStatus(authResponse.result);
    setEmailStatus('Configurações carregadas.');
  } catch (error) {
    setEmailStatus(error.message || 'Falha ao carregar configurações de e-mail.', 'error');
  } finally {
    setEmailBusy(false);
  }
}

$('#email-settings').addEventListener('click', async (event) => {
  event.preventDefault();
  $('#email-dialog').showModal();
  await loadEmailConfiguration();
});

async function runEmailAction(action, pendingMessage, successMessage, options = {}) {
  setEmailBusy(true, { cancellable: Boolean(options.cancellable) });
  setEmailStatus(pendingMessage);
  if (options.cancellable) emailConnectInProgress = true;
  try {
    const response = await action();
    if (!response.ok) {
      setEmailStatus(response.error.message, 'error');
      return null;
    }
    if (response.result?.credentials) renderEmailAuthStatus(response.result);
    setEmailStatus(successMessage, 'success');
    return response.result;
  } catch {
    setEmailStatus('Falha inesperada na comunicação com o aplicativo.', 'error');
    return null;
  } finally {
    if (options.cancellable) emailConnectInProgress = false;
    setEmailBusy(false);
  }
}

$('#email-save').addEventListener('click', () =>
  runEmailAction(
    () =>
      window.ambulatorio.email.saveSettings({
        destination: $('#email-destination').value
      }),
    'Salvando configurações...',
    'E-mail de destino salvo.'
  )
);

$('#email-connect').addEventListener('click', () =>
  runEmailAction(
    () => window.ambulatorio.email.connect(),
    'Conclua a autorização no navegador ou cancele a conexão.',
    'Gmail conectado com sucesso.',
    { cancellable: true }
  )
);

$('#email-cancel-connect').addEventListener('click', async () => {
  $('#email-cancel-connect').disabled = true;
  setEmailStatus('Cancelando conexão com o Google...');
  await window.ambulatorio.email.cancelConnect();
});

$('#email-disconnect').addEventListener('click', () =>
  runEmailAction(
    () => window.ambulatorio.email.disconnect(),
    'Removendo autorização local...',
    'Conta Gmail desconectada e tokens removidos.'
  )
);

$('#email-test').addEventListener('click', () =>
  runEmailAction(
    () => window.ambulatorio.email.sendTest(),
    'Enviando mensagem de teste...',
    'Mensagem de teste enviada sem dados clínicos.'
  )
);

async function closeEmailDialog() {
  if (emailConnectInProgress) await window.ambulatorio.email.cancelConnect();
  $('#email-dialog').close();
}

$('#email-close').addEventListener('click', closeEmailDialog);
$('#email-close-footer').addEventListener('click', closeEmailDialog);

$('#interview').addEventListener('input', (event) => {
  $('#interview-counter').textContent = `${event.target.value.length} / 3500 caracteres`;
});

function resetAppointment() {
  $('#main-form').reset();
  mainRows.forEach((row) => applyRowData(row, {}));
  $('#months').value = '5';
  $('#evolution-font-size').value = '10';
  $('#appointment-date').value = new Date().toISOString().slice(0, 10);
  $('#interview-counter').textContent = '0 / 3500 caracteres';
  setStatus('Novo atendimento iniciado.');
}

function closeNewAppointmentDialog() {
  $('#new-appointment-dialog').close();
}

$('#new-appointment').addEventListener('click', () => {
  $('#new-appointment-dialog').showModal();
});

$('#new-appointment-confirm').addEventListener('click', () => {
  resetAppointment();
  closeNewAppointmentDialog();
});

$('#new-appointment-cancel').addEventListener('click', closeNewAppointmentDialog);
$('#new-appointment-close').addEventListener('click', closeNewAppointmentDialog);

window.addEventListener('keydown', handleZoomShortcut);

$('#appointment-date').value = new Date().toISOString().slice(0, 10);
