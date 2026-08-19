const API_URL = 'https://script.google.com/macros/s/AKfycbzU-yUZeX0-VeipHpW2htlmBdVDYr3rtsRwHvCb7Bck0qJ83Y4vvkkmAt2Dr3JeLsT4/exec';
const PWA_API_TOKEN = '';

const state = {
  kind: 'despesa',
  view: 'launch',
  balanceVisible: localStorage.getItem('balanceVisible') !== 'false',
  categories: { despesa: [], receita: [] },
  history: { despesa: [], receita: [] },
  selected: null,
  pinResolver: null,
  pinPromise: null
};

const el = {};

document.addEventListener('DOMContentLoaded', start);

function start() {
  bindElements();
  bindEvents();
  setToday();
  fillFallbackCategories();
  fillCategorySelect();
  renderBalance({ display: 'Carregando...', month: '' });
  updateFuelFields();
  refreshStartupData();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

function bindElements() {
  [
    'balanceLabel', 'balanceValue', 'toggleBalance', 'form', 'amount', 'category',
    'newCategory', 'customCategoryNote', 'description', 'date', 'fuelFields',
    'fuelLiters', 'fuelUnitPrice', 'submit', 'despesasList', 'receitasList',
    'despesasEditor', 'receitasEditor', 'refreshDespesas', 'refreshReceitas',
    'refreshGraph', 'graphContent', 'categoryModal', 'cancelCategory', 'useCategory',
    'openCategoryModal', 'receiptModal', 'receiptText', 'cancelReceipt', 'useReceipt',
    'openReceiptImport', 'deleteModal', 'cancelDelete', 'confirmDelete',
    'statusModal', 'statusDialog', 'statusIcon', 'statusTitle', 'statusText',
    'statusClose', 'pinModal', 'apiPin', 'savePin', 'skipPin'
  ].forEach(id => {
    el[id] = document.getElementById(id);
  });
  el.kindButtons = document.querySelectorAll('.kind');
  el.tabButtons = document.querySelectorAll('.tab-button');
}

function bindEvents() {
  el.kindButtons.forEach(button => {
    button.addEventListener('click', () => setKind(button.dataset.kind));
  });

  el.tabButtons.forEach(button => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });

  el.form.addEventListener('submit', submitLaunch);
  el.toggleBalance.addEventListener('click', toggleBalance);
  el.category.addEventListener('change', updateFuelFields);
  el.openCategoryModal.addEventListener('click', () => openModal(el.categoryModal, el.newCategory));
  el.cancelCategory.addEventListener('click', () => closeModal(el.categoryModal));
  el.useCategory.addEventListener('click', useNewCategory);
  el.openReceiptImport.addEventListener('click', () => openModal(el.receiptModal, el.receiptText));
  el.cancelReceipt.addEventListener('click', () => closeModal(el.receiptModal));
  el.useReceipt.addEventListener('click', importReceiptText);
  el.refreshDespesas.addEventListener('click', () => loadHistory('despesa'));
  el.refreshReceitas.addEventListener('click', () => loadHistory('receita'));
  el.refreshGraph.addEventListener('click', loadGraph);
  el.cancelDelete.addEventListener('click', () => closeModal(el.deleteModal));
  el.confirmDelete.addEventListener('click', deleteSelectedEntry);
  el.statusClose.addEventListener('click', () => closeModal(el.statusModal));
  el.savePin.addEventListener('click', saveApiPinFromModal);
  el.skipPin.addEventListener('click', skipApiPin);
  el.apiPin.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      saveApiPinFromModal();
    }
  });
}

async function api(action, payload = {}) {
  const pin = await getApiPin();
  return new Promise((resolve, reject) => {
    const callback = '__finApi_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    const requestPayload = Object.assign({}, payload, {
      pin
    });
    const params = new URLSearchParams({
      api: action,
      callback,
      payload: JSON.stringify(requestPayload)
    });

    if (PWA_API_TOKEN) {
      params.set('token', PWA_API_TOKEN);
    }

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Tempo esgotado falando com a planilha.'));
    }, 30000);

    window[callback] = data => {
      cleanup();
      if (data && data.ok === false && /não autorizado|nao autorizado/i.test(data.message || '')) {
        forgetApiPin();
      }
      resolve(data || {});
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Não consegui acessar o Apps Script.'));
    };

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callback];
      script.remove();
    }

    script.src = API_URL + '?' + params.toString();
    document.head.appendChild(script);
  });
}

function getApiPin() {
  const pin = localStorage.getItem('financeApiPin') || '';
  if (pin) {
    return Promise.resolve(pin);
  }

  if (state.pinPromise) {
    return state.pinPromise;
  }

  state.pinPromise = new Promise(resolve => {
    state.pinResolver = resolve;
    el.apiPin.value = '';
    openModal(el.pinModal, el.apiPin);
  });
  return state.pinPromise;
}

function saveApiPinFromModal() {
  const pin = el.apiPin.value.trim();
  if (pin) {
    localStorage.setItem('financeApiPin', pin);
  }
  closeModal(el.pinModal);
  resolvePin(pin);
}

function skipApiPin() {
  closeModal(el.pinModal);
  resolvePin('');
}

function resolvePin(pin) {
  if (state.pinResolver) {
    state.pinResolver(pin);
    state.pinResolver = null;
    state.pinPromise = null;
  }
}

function forgetApiPin() {
  localStorage.removeItem('financeApiPin');
}

function refreshStartupData() {
  api('categories').then(data => {
    if (data.ok && data.categories) {
      state.categories = data.categories;
      fillCategorySelect();
    }
  }).catch(() => {});

  refreshBalance();
}

function fillFallbackCategories() {
  state.categories = {
    despesa: [
      'ADMINISTRATIVO', 'HABITAÇÃO', 'ALIMENTAÇÃO', 'COMBUSTIVEL',
      'CARTÃO RAFAEL PADINHO', 'INTERNET', 'DESPESAS PESSOAIS', 'MERCADO',
      'IMPOSTO DO VEICULO', 'LAZER', 'LIMPEZA', 'MANUTENÇÃO', 'MULTA',
      'OUTRAS DESPESAS', 'PENSÃO YASMIM', 'PREVIDENCIA', 'PRO-LABORE', 'SEGURO'
    ],
    receita: ['APLICATIVOS', 'ALUGUEL SP', '99 POP', 'INDRIVE', 'RENDA 01', 'RENDA 02', 'RENDA 03', 'RENDA 04', 'RENDA 05']
  };
}

function setToday() {
  const now = new Date();
  el.date.value = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-');
}

function setKind(kind) {
  state.kind = kind === 'receita' ? 'receita' : 'despesa';
  el.kindButtons.forEach(button => button.classList.toggle('active', button.dataset.kind === state.kind));
  el.newCategory.value = '';
  el.customCategoryNote.textContent = '';
  fillCategorySelect();
  updateFuelFields();
}

function fillCategorySelect(selected = '') {
  const options = state.categories[state.kind] || [];
  el.category.innerHTML = '';
  options.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    if (normalize(value) === normalize(selected)) {
      option.selected = true;
    }
    el.category.appendChild(option);
  });
}

function setView(view) {
  state.view = view;
  document.querySelectorAll('.tab-view').forEach(section => {
    section.classList.toggle('active', section.id === view + 'View');
  });
  el.tabButtons.forEach(button => button.classList.toggle('active', button.dataset.view === view));

  if (view === 'despesas') {
    loadHistory('despesa');
  } else if (view === 'receitas') {
    loadHistory('receita');
  } else if (view === 'grafico') {
    loadGraph();
  }
}

function refreshBalance() {
  api('balance').then(data => {
    renderBalance(data.ok ? data : { display: 'Erro', month: '' });
  }).catch(() => renderBalance({ display: 'Erro', month: '' }));
}

function renderBalance(data) {
  const month = data.month ? ' de ' + data.month : ' do mês';
  el.balanceLabel.textContent = 'Saldo acumulado' + month;
  el.balanceValue.textContent = state.balanceVisible ? (data.display || 'R$ 0,00') : '••••••';
  el.toggleBalance.textContent = state.balanceVisible ? '👁️' : '🙈';
}

function toggleBalance() {
  state.balanceVisible = !state.balanceVisible;
  localStorage.setItem('balanceVisible', String(state.balanceVisible));
  refreshBalance();
}

function submitLaunch(event) {
  event.preventDefault();
  const category = (el.newCategory.value || el.category.value || '').trim();
  const form = {
    kind: state.kind,
    amount: el.amount.value,
    category,
    description: el.description.value,
    date: el.date.value,
    fuelLiters: el.fuelLiters.value,
    fuelUnitPrice: el.fuelUnitPrice.value
  };

  el.submit.disabled = true;
  api('launch', form).then(response => {
    show(cleanMessage(response.message, response.ok ? 'Lançado com sucesso.' : 'Não lancei.'), Boolean(response.ok));
    if (response.ok) {
      el.amount.value = '';
      el.description.value = '';
      el.newCategory.value = '';
      el.receiptText.value = '';
      el.fuelLiters.value = '';
      el.fuelUnitPrice.value = '';
      el.customCategoryNote.textContent = '';
      refreshBalance();
    }
  }).catch(error => {
    show(error.message || String(error), false);
  }).finally(() => {
    el.submit.disabled = false;
  });
}

function useNewCategory() {
  const value = el.newCategory.value.trim();
  if (!value) {
    closeModal(el.categoryModal);
    return;
  }

  el.customCategoryNote.textContent = 'Usando nova categoria: ' + value.toUpperCase();
  updateFuelFields();
  closeModal(el.categoryModal);
}

function importReceiptText() {
  const text = el.receiptText.value.trim();
  if (!text) {
    closeModal(el.receiptModal);
    return;
  }

  const parsed = parseReceipt(text);
  if (parsed.amount) el.amount.value = parsed.amount;
  if (parsed.description) el.description.value = parsed.description;
  if (parsed.liters) el.fuelLiters.value = parsed.liters;
  if (parsed.unitPrice) el.fuelUnitPrice.value = parsed.unitPrice;
  if (parsed.category) {
    setKind('despesa');
    fillCategorySelect(parsed.category);
  }
  updateFuelFields();
  closeModal(el.receiptModal);
}

function parseReceipt(text) {
  const normalized = normalize(text);
  const moneyMatches = text.match(/(?:R\$\s*)?\d{1,6}(?:[.,]\d{2})/g) || [];
  const literMatch = text.match(/(\d{1,4}(?:[.,]\d{1,3})?)\s*(?:L|LT|LITRO|LITROS)\b/i);
  const unitMatch = text.match(/(?:R\$\/?L|PRE[ÇC]O|UNIT[AÁ]RIO)[^\d]*(\d{1,2}(?:[.,]\d{2,3})?)/i);
  const isFuel = /COMBUST|GASOL|ETANOL|DIESEL|POSTO|ABAST/.test(normalized);

  return {
    amount: moneyMatches.length ? moneyMatches[moneyMatches.length - 1].replace(/[^\d,.-]/g, '') : '',
    category: isFuel ? 'COMBUSTIVEL' : '',
    description: isFuel ? 'Abastecimento' : firstUsefulLine(text),
    liters: literMatch ? literMatch[1] : '',
    unitPrice: unitMatch ? unitMatch[1] : ''
  };
}

function firstUsefulLine(text) {
  return (text.split(/\n+/).map(line => line.trim()).find(line => line.length > 3) || '').slice(0, 60);
}

function updateFuelFields() {
  const isFuel = state.kind === 'despesa' && normalize(el.newCategory.value || el.category.value).includes('COMBUSTIVEL');
  el.fuelFields.classList.toggle('visible', isFuel);
}

function loadHistory(kind) {
  const list = kind === 'receita' ? el.receitasList : el.despesasList;
  const editor = kind === 'receita' ? el.receitasEditor : el.despesasEditor;
  editor.classList.remove('visible');
  editor.innerHTML = '';
  list.innerHTML = '<div class="empty">Carregando...</div>';

  api('recent', { kind, limit: 30 }).then(response => {
    state.history[kind] = response.entries || [];
    renderHistory(kind);
  }).catch(error => {
    list.innerHTML = '<div class="empty">' + escapeHtml(error.message || String(error)) + '</div>';
  });
}

function renderHistory(kind) {
  const list = kind === 'receita' ? el.receitasList : el.despesasList;
  const entries = state.history[kind] || [];

  if (!entries.length) {
    list.innerHTML = '<div class="empty">Nenhum lançamento encontrado.</div>';
    return;
  }

  list.innerHTML = entries.map((entry, index) => `
    <button class="entry-card ${kind === 'receita' ? 'income' : 'expense'}" type="button" data-kind="${kind}" data-index="${index}">
      <div>
        <div class="entry-main">
          <div>${escapeHtml(entry.description || '(sem descrição)')}</div>
          <div class="entry-amount ${kind === 'receita' ? 'income' : 'expense'}">${escapeHtml(entry.amountDisplay || '')}</div>
        </div>
        <div class="entry-meta">${escapeHtml(entry.dateDisplay || entry.date || '')} · ${escapeHtml(entry.category || '')}</div>
      </div>
      <div class="entry-edit-icon">✏️</div>
    </button>
  `).join('');

  list.querySelectorAll('.entry-card').forEach(card => {
    card.addEventListener('click', () => selectHistoryItem(card.dataset.kind, Number(card.dataset.index)));
  });
}

function selectHistoryItem(kind, index) {
  const entry = state.history[kind][index];
  if (!entry) return;
  state.selected = entry;
  const editor = kind === 'receita' ? el.receitasEditor : el.despesasEditor;
  editor.classList.add('visible');
  editor.innerHTML = `
    <label>Editar lançamento</label>
    <input id="editAmount" inputmode="decimal" value="${escapeHtml(String(entry.amount || ''))}">
    <input id="editDescription" value="${escapeHtml(entry.description || '')}">
    <select id="editCategory"></select>
    <input id="editDate" type="date" value="${escapeHtml(entry.date || '')}">
    <div class="editor-actions">
      <button id="saveEdit" class="submit" type="button">Salvar</button>
      <button id="deleteEdit" class="submit danger" type="button">Excluir</button>
      <button id="cancelEdit" class="submit secondary" type="button">Voltar</button>
    </div>
  `;
  fillEditCategory(entry);
  document.getElementById('saveEdit').addEventListener('click', saveSelectedEntry);
  document.getElementById('deleteEdit').addEventListener('click', () => openModal(el.deleteModal));
  document.getElementById('cancelEdit').addEventListener('click', closeEditors);
  editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function fillEditCategory(entry) {
  const select = document.getElementById('editCategory');
  const options = state.categories[entry.kind] || [];
  select.innerHTML = '';
  options.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    option.selected = normalize(value) === normalize(entry.category);
    select.appendChild(option);
  });
}

function saveSelectedEntry() {
  const entry = state.selected;
  if (!entry) return;

  api('update', {
    kind: entry.kind,
    row: entry.row,
    amount: document.getElementById('editAmount').value,
    description: document.getElementById('editDescription').value,
    category: document.getElementById('editCategory').value,
    date: document.getElementById('editDate').value
  }).then(response => {
    show(cleanMessage(response.message, response.ok ? 'Tudo certo.' : 'Não salvei.'), Boolean(response.ok));
    if (response.ok) {
      closeEditors();
      loadHistory(entry.kind);
      refreshBalance();
    }
  }).catch(error => show(error.message || String(error), false));
}

function deleteSelectedEntry() {
  const entry = state.selected;
  if (!entry) return;
  closeModal(el.deleteModal);

  api('delete', { kind: entry.kind, row: entry.row }).then(response => {
    show(cleanMessage(response.message, response.ok ? 'Lançamento removido.' : 'Não removi.'), Boolean(response.ok));
    if (response.ok) {
      closeEditors();
      loadHistory(entry.kind);
      refreshBalance();
    }
  }).catch(error => show(error.message || String(error), false));
}

function closeEditors() {
  state.selected = null;
  [el.despesasEditor, el.receitasEditor].forEach(editor => {
    editor.classList.remove('visible');
    editor.innerHTML = '';
  });
}

function loadGraph() {
  el.graphContent.innerHTML = '<div class="empty">Carregando gráfico...</div>';
  api('chart').then(data => renderGraph(data)).catch(error => {
    el.graphContent.innerHTML = '<div class="empty">' + escapeHtml(error.message || String(error)) + '</div>';
  });
}

function renderGraph(data) {
  const expenses = data.expenseCategories || [];
  if (!data.ok) {
    el.graphContent.innerHTML = '<div class="empty">Não consegui carregar o gráfico.</div>';
    return;
  }

  el.graphContent.innerHTML = `
    <div class="entry-meta">Resumo de ${escapeHtml(data.month || '')}/${escapeHtml(String(data.year || ''))}</div>
    <div class="chart-summary">
      <div class="chart-metric income"><div class="chart-metric-label">Receitas</div><div class="chart-metric-value">${escapeHtml(data.incomeDisplay || 'R$ 0,00')}</div></div>
      <div class="chart-metric expense"><div class="chart-metric-label">Despesas</div><div class="chart-metric-value">${escapeHtml(data.expenseDisplay || 'R$ 0,00')}</div></div>
      <div class="chart-metric"><div class="chart-metric-label">Saldo</div><div class="chart-metric-value">${escapeHtml(data.balanceDisplay || 'R$ 0,00')}</div></div>
    </div>
    ${expenses.length ? `
      <div class="chart-layout">
        <div class="chart-donut" style="background:${buildConicGradient(expenses)}"></div>
        <div class="chart-list">${expenses.map(renderChartRow).join('')}</div>
      </div>
    ` : '<div class="empty">Sem despesas lançadas neste mês.</div>'}
  `;
}

function buildConicGradient(items) {
  let cursor = 0;
  const parts = items.map((item, index) => {
    const percent = Math.max(0, Number(item.percent || 0) * 100);
    const next = index === items.length - 1 ? 100 : cursor + percent;
    const part = `${item.color || '#d93025'} ${cursor.toFixed(2)}% ${next.toFixed(2)}%`;
    cursor = next;
    return part;
  });
  return `conic-gradient(${parts.join(', ')})`;
}

function renderChartRow(item) {
  return `
    <div class="chart-row">
      <span class="chart-dot" style="background:${escapeHtml(item.color || '#d93025')}"></span>
      <span>${escapeHtml(item.category || 'Sem categoria')} · ${escapeHtml(item.percentDisplay || '0%')}</span>
      <span>${escapeHtml(item.display || 'R$ 0,00')}</span>
    </div>
  `;
}

function openModal(modal, focusTarget) {
  modal.hidden = false;
  setTimeout(() => focusTarget && focusTarget.focus(), 50);
}

function closeModal(modal) {
  modal.hidden = true;
}

function show(text, ok) {
  el.statusIcon.textContent = ok ? '✅' : '⚠️';
  el.statusTitle.textContent = ok ? 'Tudo certo' : 'Atenção';
  el.statusText.textContent = text;
  openModal(el.statusModal, el.statusClose);
}

function cleanMessage(message, fallback) {
  return String(message || fallback || '')
    .replace(/\s+em\s+[A-ZÇÃÕÉÍÓÚ ]+!\d+\.?/gi, '.')
    .replace(/\s+[A-ZÇÃÕÉÍÓÚ ]+!\d+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
