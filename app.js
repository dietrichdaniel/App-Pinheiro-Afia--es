/**
 * app.js - Lógica Principal da Aplicação (PWA Pinheiro Afiações)
 */

import {
  useFirebase,
  initDB,
  addRecord,
  getAllRecords,
  getRecordById,
  updateRecord,
  deleteRecord,
  getConfig,
  setConfig
} from './db.js';

// --- ESTADO GLOBAL DA APLICAÇÃO ---
let activeTab = 'dashboard';
let discountConfig = { qtd1: 5, pct1: 5, qtd2: 10, pct2: 10 };
let currentPecas = [];
let currentAdicionais = [];

// --- EVENTOS INICIAIS ---
window.addEventListener('DOMContentLoaded', async () => {
  try {
    // Inicializa Banco de Dados
    await initDB();
    console.log('Banco de dados inicializado com sucesso no app.js');

    // Carrega Configurações

    discountConfig.qtd1 = Number(await getConfig('discount_qtd1')) || 5;
    discountConfig.pct1 = Number(await getConfig('discount_pct1')) || 5;
    discountConfig.qtd2 = Number(await getConfig('discount_qtd2')) || 10;
    discountConfig.pct2 = Number(await getConfig('discount_pct2')) || 10;

    const inputQtd1 = document.getElementById('descQtd1');
    const inputPct1 = document.getElementById('descPct1');
    const inputQtd2 = document.getElementById('descQtd2');
    const inputPct2 = document.getElementById('descPct2');

    if (inputQtd1) inputQtd1.value = discountConfig.qtd1;
    if (inputPct1) inputPct1.value = discountConfig.pct1;
    if (inputQtd2) inputQtd2.value = discountConfig.qtd2;
    if (inputPct2) inputPct2.value = discountConfig.pct2;

    // Inicializa Eventos da Interface
    setupNavigation();
    setupInputAutoSelect();
    setupServiceWorker();
    setupDynamicRows();
    setupFormSubmissions();
    setupConnectionMonitoring();
    setupMaintenanceEvents();
    setupPricingEvents();
    setupModalConcluir();
    setupModalConcluirPedido();
    setupModalDetalhes();
    setupModalDetalhesPedido();
    setupModalLotes();

    // Renderiza dados iniciais
    await reloadAllViews();
    await updateAllSelectors();

    // (Sincronização com Firebase é gerenciada automaticamente pelo SDK)
  } catch (err) {
    showToast('Erro ao iniciar a aplicação: ' + err.message, 'error');
  }
});

// --- REGISTRO E ATUALIZAÇÃO DO SERVICE WORKER (PWA) ---
function setupServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then((registration) => {
          console.log('PWA Service Worker registrado com sucesso: ', registration.scope);

          // Função para mostrar notificação de atualização
          function showUpdateToast() {
            const container = document.getElementById('toastContainer');
            if (!container) return;

            // Evita duplicar o toast de atualização se já estiver na tela
            if (document.getElementById('updateToastNotify')) return;

            const toast = document.createElement('div');
            toast.id = 'updateToastNotify';
            toast.className = 'toast warning';
            toast.style.cursor = 'pointer';
            toast.style.borderLeftWidth = '6px';
            
            toast.innerHTML = `
              <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 4px;">
                <span style="font-weight: bold; font-size: 0.9rem; color: #f59e0b;">Atualização Disponível!</span>
                <span style="font-size: 0.8rem; color: var(--text-main);">Clique aqui para carregar a nova versão.</span>
              </div>
              <button class="toast-close" style="font-size: 1.2rem; padding: 4px;">&times;</button>
            `;

            // Se clicar na notificação, força a atualização
            toast.addEventListener('click', (e) => {
              if (e.target.classList.contains('toast-close')) {
                toast.remove();
                return;
              }
              if (registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
              }
              toast.remove();
            });

            container.appendChild(toast);
          }

          // Se já houver um Service Worker em fila (waiting) pronto para ativar
          if (registration.waiting) {
            showUpdateToast();
          }

          // Monitora novos Service Workers que forem baixados/instalados
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                // Só avisa quando o estado for 'installed' e se já existir uma versão ativa controlando a página
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  showUpdateToast();
                }
              });
            }
          });
        })
        .catch((err) => {
          console.error('Falha ao registrar o Service Worker: ', err);
        });

      // Recarrega a página assim que o novo Service Worker pular a espera e se tornar o controlador ativo
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    });
  }
}

// --- AUTO-SELEÇÃO DE INPUTS AO FOCAR (MELHORA A RESPONSIVIDADE) ---
function setupInputAutoSelect() {
  let selectAllPending = false;

  document.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
      e.target.select();
      selectAllPending = true;
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (selectAllPending && e.target.tagName === 'INPUT' && e.target.type === 'number') {
      e.target.select();
      selectAllPending = false;
    }
  });

  document.addEventListener('touchend', (e) => {
    if (selectAllPending && e.target.tagName === 'INPUT' && e.target.type === 'number') {
      e.target.select();
      selectAllPending = false;
    }
  });

  document.addEventListener('blur', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'number') {
      selectAllPending = false;
    }
  }, true);
}

// --- ROTEAMENTO E NAVEGAÇÃO DE ABAS ---
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item, .mobile-nav-item');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      switchTab(tab);
    });
  });
}

function switchTab(tabId) {
  if (!tabId) return;
  activeTab = tabId;

  // Atualiza classe active na navegação desktop e mobile
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(item => {
    if (item.getAttribute('data-tab') === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Mostra/Oculta painéis
  document.querySelectorAll('.tab-panel').forEach(panel => {
    if (panel.id === tabId) {
      panel.classList.add('active');
    } else {
      panel.classList.remove('active');
    }
  });

  // Recarrega dados da aba específica
  reloadAllViews();
}

// --- MONITORAÇÃO DE CONEXÃO ---
function setupConnectionMonitoring() {
  const dot = document.getElementById('connectionDot');
  const text = document.getElementById('connectionText');

  async function updateStatus() {
    if (navigator.onLine) {
      dot.className = 'status-dot online';
      text.textContent = 'Conectado (Online)';
      // (O Firebase reconecta automaticamente ao voltar a ficar online)
    } else {
      dot.className = 'status-dot offline';
      text.textContent = 'Modo Offline';
      showToast('Você está offline. As alterações serão salvas localmente.', 'warning');
    }
    await reloadAllViews();
  }

  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);

  // Executa status inicial
  updateStatus();
}

// --- SISTEMA DE NOTIFICAÇÃO (TOAST) ---
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  // Icone dinâmico
  let icon = '';
  if (type === 'success') icon = '✓';
  else if (type === 'error') icon = '✗';
  else if (type === 'warning') icon = '⚠';
  else icon = 'ℹ';

  toast.innerHTML = `
    <span style="font-weight: bold; margin-right: 8px;">${icon}</span>
    <span style="flex-grow: 1; font-size: 0.85rem;">${message}</span>
    <button class="toast-close">&times;</button>
  `;

  container.appendChild(toast);

  // Evento para fechar ao clicar no "X"
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.remove();
  });

  // Remove automaticamente após 4 segundos
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 4000);
}

// --- CONFIGURAÇÃO DE INPUTS DINÂMICOS (LINHAS ADICIONAIS) ---
function setupDynamicRows() {
  // Itens do Serviço
  const btnAddServItem = document.getElementById('btnAddServItem');
  const containerServItens = document.getElementById('servItensContainer');

  if (btnAddServItem && containerServItens) {
    btnAddServItem.addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'dynamic-item-row';
      row.style.flexWrap = 'wrap';
      row.style.marginBottom = '8px';
      row.innerHTML = `
        <div style="display: flex; gap: 8px; width: 100%; align-items: center;">
          <select class="form-control item-select" style="flex: 1;" required>
            <option value="">Selecione a peça...</option>
            <option value="custom">Outro (Digitar)...</option>
          </select>
          <input type="number" class="form-control item-qty" placeholder="Qtd" min="1" value="1" style="width: 70px;" required>
          <input type="number" class="form-control item-price" placeholder="Preço" step="0.01" min="0" style="width: 90px;" required>
          <button type="button" class="btn-icon-only danger btnRemoveRow">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
        <input type="text" class="form-control item-name-custom" placeholder="Nome da peça personalizada" style="display: none; margin-top: 8px; width: 100%;" />
      `;
      containerServItens.appendChild(row);
      updateRemoveButtons(containerServItens);
      if (containerServAdicionais) updateRemoveButtons(containerServAdicionais);
      updateAllSelectors();
    });
  }

  // Adicionais do Serviço
  const btnAddAdicionalRow = document.getElementById('btnAddAdicionalRow');
  const containerServAdicionais = document.getElementById('servAdicionaisContainer');

  if (btnAddAdicionalRow && containerServAdicionais) {
    btnAddAdicionalRow.addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'dynamic-item-row adicional-row';
      row.style.flexWrap = 'wrap';
      row.style.marginBottom = '8px';
      row.innerHTML = `
        <div style="display: flex; gap: 8px; width: 100%; align-items: center;">
          <select class="form-control adicional-select" style="flex: 1;" required>
            <option value="">Selecione o adicional...</option>
            <option value="custom">Outro (Digitar)...</option>
          </select>
          <input type="number" class="form-control adicional-qty" placeholder="Qtd" min="1" value="1" style="width: 70px;" required>
          <input type="number" class="form-control adicional-price" placeholder="Preço" step="0.01" min="0" style="width: 90px;" required>
          <button type="button" class="btn-icon-only danger btnRemoveRow">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
        <input type="text" class="form-control adicional-name-custom" placeholder="Nome do adicional personalizado" style="display: none; margin-top: 8px; width: 100%;" />
      `;
      containerServAdicionais.appendChild(row);
      updateRemoveButtons(containerServAdicionais);
      if (containerServItens) updateRemoveButtons(containerServItens);
      updateAllSelectors();
    });
  }

  // Inicializa os botões no estado inicial do formulário
  if (containerServItens) updateRemoveButtons(containerServItens);
  if (containerServAdicionais) updateRemoveButtons(containerServAdicionais);

  // Matérias-Primas da Receita
  const btnAddMateriaPrima = document.getElementById('btnAddMateriaPrima');
  const containerMateriaPrima = document.getElementById('recMateriaPrimaContainer');

  if (btnAddMateriaPrima && containerMateriaPrima) {
    btnAddMateriaPrima.addEventListener('click', async () => {
      const estoqueItens = await getAllRecords('estoque');
      const estoqueAgrupado = obterEstoqueAgrupado(estoqueItens);
      let options = '<option value="">Selecione insumo...</option>';
      estoqueAgrupado.forEach(item => {
        options += `<option value="${escapeHTML(item.item)}" data-valor="${item.valor}">${escapeHTML(item.item)} (Disp: ${item.quantidade})</option>`;
      });

      const row = document.createElement('div');
      row.className = 'dynamic-item-row mp-row';
      row.innerHTML = `
        <select class="form-control mp-select" required>
          ${options}
        </select>
        <input type="number" class="form-control mp-qty" placeholder="Qtd" min="1" step="1" style="width: 80px;" required>
        <button type="button" class="btn-icon-only danger btnRemoveRow">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      `;
      containerMateriaPrima.appendChild(row);
      updateRemoveButtons(containerMateriaPrima);
      setupCustoCalculoEvents();
    });
  }

  // Itens do Pedido/Venda
  const btnAddPedItem = document.getElementById('btnAddPedItem');
  const containerPedItens = document.getElementById('pedItensContainer');

  if (btnAddPedItem && containerPedItens) {
    btnAddPedItem.addEventListener('click', async () => {
      const optionsHtml = await updateSalesSelectors();
      const row = document.createElement('div');
      row.className = 'dynamic-item-row';
      row.style.flexWrap = 'wrap';
      row.style.marginBottom = '8px';
      row.innerHTML = `
        <div style="display: flex; gap: 8px; width: 100%; align-items: center;">
          <select class="form-control ped-item-select" style="flex: 1;" required>
            ${optionsHtml}
          </select>
          <input type="number" class="form-control ped-item-qty" placeholder="Qtd" min="1" value="1" style="width: 70px;" required>
          <input type="number" class="form-control ped-item-price" placeholder="Preço" step="0.01" min="0" style="width: 90px;" required>
          <button type="button" class="btn-icon-only danger btnRemoveRow">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;
      containerPedItens.appendChild(row);
      updateRemoveButtons(containerPedItens);
    });
  }

  // Inicializa os botões no estado inicial do formulário de pedidos
  if (containerPedItens) updateRemoveButtons(containerPedItens);

  // Lógica geral de remoção
  document.addEventListener('click', (e) => {
    if (e.target.closest('.btnRemoveRow')) {
      const btn = e.target.closest('.btnRemoveRow');
      const row = btn.closest('.dynamic-item-row');
      if (row) {
        const container = row.parentNode;
        row.remove();

        const servItensContainer = document.getElementById('servItensContainer');
        const servAdicionaisContainer = document.getElementById('servAdicionaisContainer');
        if (servItensContainer) updateRemoveButtons(servItensContainer);
        if (servAdicionaisContainer) updateRemoveButtons(servAdicionaisContainer);

        if (container && container.id !== 'servItensContainer' && container.id !== 'servAdicionaisContainer') {
          updateRemoveButtons(container);
        }

        recalculaCustoReceita();
        recalculaValorServico();
      }
    }
  });

  // Delegação para controlar visibilidade de inputs personalizados de peças/adicionais nos serviços e preencher preços
  document.addEventListener('change', (e) => {
    if (e.target.classList.contains('item-select')) {
      const row = e.target.closest('.dynamic-item-row');
      const customInput = row.querySelector('.item-name-custom');
      const priceInput = row.querySelector('.item-price');
      if (e.target.value === 'custom') {
        customInput.style.display = 'block';
        customInput.setAttribute('required', 'required');
        if (priceInput) priceInput.value = '';
      } else {
        customInput.style.display = 'none';
        customInput.removeAttribute('required');
        const selectedOption = e.target.options[e.target.selectedIndex];
        const preco = selectedOption ? parseFloat(selectedOption.getAttribute('data-preco')) || 0 : 0;
        if (priceInput) {
          priceInput.value = selectedOption && e.target.value ? preco.toFixed(2) : '';
        }
      }
      recalculaValorServico();
    }

    if (e.target.classList.contains('adicional-select')) {
      const row = e.target.closest('.dynamic-item-row');
      const customInput = row.querySelector('.adicional-name-custom');
      const priceInput = row.querySelector('.adicional-price');
      if (e.target.value === 'custom') {
        customInput.style.display = 'block';
        customInput.setAttribute('required', 'required');
        if (priceInput) priceInput.value = '';
      } else {
        customInput.style.display = 'none';
        customInput.removeAttribute('required');
        const selectedOption = e.target.options[e.target.selectedIndex];
        const preco = selectedOption ? parseFloat(selectedOption.getAttribute('data-preco')) || 0 : 0;
        if (priceInput) {
          priceInput.value = selectedOption && e.target.value ? preco.toFixed(2) : '';
        }
      }
      recalculaValorServico();
    }

    if (e.target.classList.contains('ped-item-select')) {
      const row = e.target.closest('.dynamic-item-row');
      const selectedOption = e.target.options[e.target.selectedIndex];
      const type = selectedOption ? selectedOption.getAttribute('data-type') : '';
      const priceInput = row.querySelector('.ped-item-price');
      
      if (type === 'receita') {
        const itemName = e.target.value;
        getAllRecords('receitas').then(receitas => {
          const r = receitas.find(x => x.produtoFinal.toLowerCase() === itemName.toLowerCase());
          if (priceInput) {
            priceInput.value = (r && r.precoVenda !== undefined) ? r.precoVenda.toFixed(2) : '0.00';
          }
        });
      } else if (type === 'avulso') {
        const precoInsumo = parseFloat(selectedOption.getAttribute('data-preco')) || 0;
        if (priceInput) {
          priceInput.value = precoInsumo.toFixed(2);
        }
      } else {
        if (priceInput) priceInput.value = '';
      }
    }
  });

  // Delegação para recalcular valores em tempo real se mudarem quantidades ou preços
  document.addEventListener('input', (e) => {
    if (
      e.target.classList.contains('item-qty') ||
      e.target.classList.contains('adicional-qty') ||
      e.target.classList.contains('item-price') ||
      e.target.classList.contains('adicional-price')
    ) {
      recalculaValorServico();
    }
  });
}

function updateRemoveButtons(container) {
  const rows = container.querySelectorAll('.dynamic-item-row');
  
  if (container.id === 'servItensContainer') {
    const adContainer = document.getElementById('servAdicionaisContainer');
    const adRowsCount = adContainer ? adContainer.querySelectorAll('.dynamic-item-row').length : 0;
    
    rows.forEach((row) => {
      const btn = row.querySelector('.btnRemoveRow');
      if (btn) {
        // Permite remover se houver mais de uma peça OU se houver pelo menos um adicional cadastrado
        btn.style.display = (rows.length > 1 || adRowsCount > 0) ? 'inline-flex' : 'none';
      }
    });
  } else if (container.id === 'servAdicionaisContainer') {
    const itemContainer = document.getElementById('servItensContainer');
    const itemRowsCount = itemContainer ? itemContainer.querySelectorAll('.dynamic-item-row').length : 0;
    
    rows.forEach((row) => {
      const btn = row.querySelector('.btnRemoveRow');
      if (btn) {
        // Permite remover se houver mais de um adicional OU se houver pelo menos uma peça cadastrada
        btn.style.display = (rows.length > 1 || itemRowsCount > 0) ? 'inline-flex' : 'none';
      }
    });
  } else {
    // Outros containers (como pedidos ou matérias-primas da receita)
    rows.forEach((row) => {
      const btn = row.querySelector('.btnRemoveRow');
      if (btn) {
        btn.style.display = rows.length === 1 ? 'none' : 'inline-flex';
      }
    });
  }
}

// Vincula eventos de cálculo de custo na composição da receita
function setupCustoCalculoEvents() {
  document.querySelectorAll('.mp-select, .mp-qty').forEach(element => {
    element.removeEventListener('change', recalculaCustoReceita);
    element.removeEventListener('input', recalculaCustoReceita);
    element.addEventListener('change', recalculaCustoReceita);
    element.addEventListener('input', recalculaCustoReceita);
  });

  const maoObra = document.getElementById('recMaoObra');
  if (maoObra) {
    maoObra.removeEventListener('input', recalculaCustoReceita);
    maoObra.addEventListener('input', recalculaCustoReceita);
  }
}

// Calcula dinamicamente o custo de fabricação na tela de receitas
function recalculaCustoReceita() {
  let custoInsumos = 0;
  const rows = document.querySelectorAll('.mp-row');

  rows.forEach(row => {
    const select = row.querySelector('.mp-select');
    const qtyInput = row.querySelector('.mp-qty');

    if (select && qtyInput) {
      const selectedOption = select.options[select.selectedIndex];
      const valUnit = selectedOption ? parseFloat(selectedOption.getAttribute('data-valor')) : 0;
      const qty = parseInt(qtyInput.value, 10) || 0;
      custoInsumos += valUnit * qty;
    }
  });

  const maoObraVal = parseFloat(document.getElementById('recMaoObra').value) || 0;
  const custoTotal = custoInsumos + maoObraVal;

  const box = document.getElementById('custoTotalCalculado');
  if (box) {
    box.innerHTML = `Custo de Fabricação Estimado: <strong>${formatMoney(custoTotal)}</strong> (Insumos: ${formatMoney(custoInsumos)} + Mão de Obra: ${formatMoney(maoObraVal)})`;
  }
}

// --- PROCESSAMENTO DE FORMULÁRIOS ---
function setupFormSubmissions() {

  // 1. FORMULÁRIO DE SERVIÇOS
  const formServico = document.getElementById('formServico');
  if (formServico) {
    formServico.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const nome = document.getElementById('servNome').value.trim() || 'Cliente Avulso';
        const telefone = document.getElementById('servTelefone') ? document.getElementById('servTelefone').value.trim() : '';
        const valor = parseFloat(document.getElementById('servValor').value) || 0;
        const frete = parseFloat(document.getElementById('servFrete').value) || 0;
        const meioPagamento = document.getElementById('servPagamento').value;
        const status = document.getElementById('servStatus').value || 'Finalizado';

        // Coleta itens dinâmicos
        const itens = [];
        const rows = document.querySelectorAll('#servItensContainer .dynamic-item-row');
        rows.forEach(row => {
          const select = row.querySelector('.item-select');
          const qtyText = row.querySelector('.item-qty').value;
          const priceInput = row.querySelector('.item-price');
          const priceVal = priceInput ? parseFloat(priceInput.value) || 0 : 0;
          let itemText = '';
          if (select) {
            if (select.value === 'custom') {
              itemText = row.querySelector('.item-name-custom').value.trim();
            } else {
              itemText = select.value;
            }
          }
          if (itemText) {
            itens.push(`${itemText} (x${qtyText} - R$ ${priceVal.toFixed(2)})`);
          }
        });

        // Coleta adicionais dinâmicos
        const adicionaisArr = [];
        const adicionalRows = document.querySelectorAll('#servAdicionaisContainer .dynamic-item-row');
        const todosAdicionais = await getAllRecords('adicionais');
        const estoqueInsumos = await getAllRecords('estoque');

        const deducoesEstoque = [];
        let estoqueInsuficiente = false;
        let insumoFaltante = '';

        for (const row of adicionalRows) {
          const select = row.querySelector('.adicional-select');
          const qtyText = row.querySelector('.adicional-qty').value;
          const qtyVal = parseFloat(qtyText) || 0;
          const priceInput = row.querySelector('.adicional-price');
          const priceVal = priceInput ? parseFloat(priceInput.value) || 0 : 0;
          let adicionalText = '';
          if (select) {
            if (select.value === 'custom') {
              adicionalText = row.querySelector('.adicional-name-custom').value.trim();
            } else {
              adicionalText = select.value;

              // Verifica se este adicional cadastrado consome insumos
              const ad = todosAdicionais.find(x => x.nome.toLowerCase() === adicionalText.toLowerCase());
              if (ad && ad.insumoAtrelado) {
                const totalDisponivel = estoqueInsumos
                  .filter(e => e.item.toLowerCase().trim() === ad.insumoAtrelado.toLowerCase().trim())
                  .reduce((sum, e) => sum + e.quantidade, 0);
                const totalConsumo = ad.qtdConsumida * qtyVal;

                if (totalDisponivel < totalConsumo) {
                  estoqueInsuficiente = true;
                  insumoFaltante = ad.insumoAtrelado;
                }

                deducoesEstoque.push({
                  insumoNome: ad.insumoAtrelado,
                  quantidade: totalConsumo
                });
              }
            }
          }
          if (adicionalText) {
            adicionaisArr.push(`${adicionalText} (x${qtyText} - R$ ${priceVal.toFixed(2)})`);
          }
        }

        if (itens.length === 0 && adicionaisArr.length === 0) {
          showToast('Adicione pelo menos uma peça ou um serviço adicional.', 'error');
          return;
        }

        // Executa a dedução dos insumos apenas se o serviço for finalizado agora.
        // Se for agendado, a dedução ocorrerá quando for concluído pelo mural.
        if (status !== 'Agendado') {
          if (estoqueInsuficiente) {
            const prosseguir = confirm(`Atenção: Não há estoque suficiente do insumo "${insumoFaltante}" atrelado aos adicionais selecionados.\nDeseja registrar o serviço mesmo assim (deixando o estoque do insumo negativo)?`);
            if (!prosseguir) return;
          }

          // Executa dedução dos insumos
          for (const ded of deducoesEstoque) {
            await consumirInsumoFIFO(ded.insumoNome, ded.quantidade);
          }
        }

        const adicionais = adicionaisArr.join(', ');

        const novoServico = {
          nome,
          telefone,
          itens,
          adicionais,
          valor,
          frete,
          meioPagamento,
          status,
          data: new Date().toISOString(),
          synced: 0
        };

        await addRecord('servicos', novoServico);
        showToast('Serviço registrado localmente!');
        formServico.reset();

        // Limpa adicionais dinâmicos
        const adicionaisContainer = document.getElementById('servAdicionaisContainer');
        if (adicionaisContainer) {
          adicionaisContainer.innerHTML = '';
        }

        // Limpa label de valor sugerido
        const labelSugerido = document.getElementById('servValorSugerido');
        if (labelSugerido) {
          labelSugerido.textContent = '';
        }

        // Mantém apenas uma linha em branco nos itens
        const container = document.getElementById('servItensContainer');
        container.innerHTML = `
          <div class="dynamic-item-row" style="flex-wrap: wrap; margin-bottom: 8px;">
            <div style="display: flex; gap: 8px; width: 100%; align-items: center;">
              <select class="form-control item-select" style="flex: 1;" required>
                <option value="">Selecione a peça...</option>
                <option value="custom">Outro (Digitar)...</option>
              </select>
              <input type="number" class="form-control item-qty" placeholder="Qtd" min="1" value="1" style="width: 70px;" required>
              <input type="number" class="form-control item-price" placeholder="Preço" step="0.01" min="0" style="width: 90px;" required>
              <button type="button" class="btn-icon-only danger btnRemoveRow" style="display:none;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
            <input type="text" class="form-control item-name-custom" placeholder="Nome da peça personalizada" style="display: none; margin-top: 8px; width: 100%;" />
          </div>
        `;

        await updateAllSelectors();
        await reloadAllViews();
      } catch (err) {
        showToast('Erro ao salvar serviço: ' + err.message, 'error');
      }
    });
  }

  // 2. FORMULÁRIO DE ESTOQUE
  const formEstoque = document.getElementById('formEstoque');
  if (formEstoque) {
    formEstoque.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const idVal = document.getElementById('estoqueId').value;
        const item = document.getElementById('estItem').value.trim();
        const quantidade = parseFloat(document.getElementById('estQtd').value) || 0;
        const valor = parseFloat(document.getElementById('estValor').value) || 0;

        const estoqueItens = await getAllRecords('estoque');

        // Verifica se é Edição
        if (idVal) {
          const id = Number(idVal);
          const registroExistente = await getRecordById('estoque', id);
          if (registroExistente) {
            registroExistente.item = item;
            registroExistente.quantidade = quantidade;
            registroExistente.valor = valor;
            registroExistente.synced = 0;
            await updateRecord('estoque', registroExistente);
            showToast('Item atualizado com sucesso!');
          }
        } else {
          // Novo lote (sempre cria um lote separado, conforme solicitação do usuário)
          const novoItem = {
            item,
            quantidade,
            valor,
            data: new Date().toISOString(),
            synced: 0
          };
          await addRecord('estoque', novoItem);
          showToast('Lote adicionado ao estoque local!');
        }

        // Restaura formulário
        formEstoque.reset();
        document.getElementById('estoqueId').value = '';
        document.getElementById('estoqueFormTitle').textContent = 'Nova Entrada';
        document.getElementById('btnEstoqueSubmit').textContent = 'Adicionar ao Estoque';
        document.getElementById('btnEstoqueCancel').style.display = 'none';

        await reloadAllViews();
      } catch (err) {
        showToast('Erro ao salvar item no estoque: ' + err.message, 'error');
      }
    });

    // Botão Cancelar Edição
    document.getElementById('btnEstoqueCancel').addEventListener('click', () => {
      formEstoque.reset();
      document.getElementById('estoqueId').value = '';
      document.getElementById('estoqueFormTitle').textContent = 'Nova Entrada';
      document.getElementById('btnEstoqueSubmit').textContent = 'Adicionar ao Estoque';
      document.getElementById('btnEstoqueCancel').style.display = 'none';
    });
  }

  // 3. FORMULÁRIO DE PEDIDOS (VENDAS)
  const formPedido = document.getElementById('formPedido');

  if (formPedido) {
    formPedido.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const frete = parseFloat(document.getElementById('pedFrete').value) || 0;
        const meioPagamento = document.getElementById('pedPagamento').value;

        const rows = document.querySelectorAll('#pedItensContainer .dynamic-item-row');
        const itemsToSell = [];

        for (const row of rows) {
          const select = row.querySelector('.ped-item-select');
          const selectedOption = select.options[select.selectedIndex];
          const itemNome = select.value;
          const type = selectedOption ? selectedOption.getAttribute('data-type') : '';
          const quantidade = parseFloat(row.querySelector('.ped-item-qty').value) || 0;
          const valor = parseFloat(row.querySelector('.ped-item-price').value) || 0;

          if (!itemNome) {
            showToast('Por favor, selecione todos os itens da venda.', 'error');
            return;
          }

          itemsToSell.push({ itemNome, type, quantidade, valor });
        }

        if (itemsToSell.length === 0) {
          showToast('Adicione pelo menos um item para registrar a venda.', 'error');
          return;
        }

        // Realiza o processamento e baixa de estoque para cada item
        for (const item of itemsToSell) {
          const { itemNome, type, quantidade, valor } = item;

          if (type === 'receita') {
            const receitas = await getAllRecords('receitas');
            const receita = receitas.find(r => r.produtoFinal.toLowerCase() === itemNome.toLowerCase());

            const estoqueFinalizado = await getAllRecords('estoque_produtos');
            const prodEstocado = estoqueFinalizado.find(p => p.produto.toLowerCase() === itemNome.toLowerCase());
            const qtdDisponivelProd = prodEstocado ? prodEstocado.quantidade : 0;

            if (qtdDisponivelProd >= quantidade) {
              // Caso 1: Estoque de produto finalizado é suficiente
              prodEstocado.quantidade -= quantidade;
              prodEstocado.synced = 0;
              await updateRecord('estoque_produtos', prodEstocado);
            } else {
              // Caso 2: Estoque insuficiente, precisamos produzir a diferença
              const diferenca = quantidade - qtdDisponivelProd;

              if (!receita) {
                const prosseguir = confirm(`Atenção: Estoque insuficiente de "${itemNome}" em estoque (${qtdDisponivelProd} un. disponíveis) e este produto não possui receita cadastrada. Deseja realizar a venda mesmo assim?`);
                if (!prosseguir) return;

                if (prodEstocado) {
                  prodEstocado.quantidade = 0;
                  prodEstocado.synced = 0;
                  await updateRecord('estoque_produtos', prodEstocado);
                }
              } else {
                const estoqueInsumos = await getAllRecords('estoque');
                let insumosInsuficientes = false;
                let insumoFaltante = '';

                for (const mp of receita.materiaPrima) {
                  const totalDisponivel = estoqueInsumos
                    .filter(e => e.item.toLowerCase().trim() === mp.item.toLowerCase().trim())
                    .reduce((sum, e) => sum + e.quantidade, 0);
                  const qtdNecessaria = mp.quantidade * diferenca;

                  if (totalDisponivel < qtdNecessaria) {
                    insumosInsuficientes = true;
                    insumoFaltante = mp.item;
                    break;
                  }
                }

                if (insumosInsuficientes) {
                  const prosseguir = confirm(`Atenção: Estoque insuficiente de produtos e insumos para completar esta venda!\nNão há insumo "${insumoFaltante}" suficiente no estoque para fabricar as ${diferenca} un. restantes.\nDeseja realizar a venda mesmo assim (deixando o estoque de insumos negativo)?`);
                  if (!prosseguir) return;
                }

                // Zera o estoque do produto finalizado
                if (prodEstocado) {
                  prodEstocado.quantidade = 0;
                  prodEstocado.synced = 0;
                  await updateRecord('estoque_produtos', prodEstocado);
                }

                // Desconta todos os insumos da receita via FIFO
                for (const mp of receita.materiaPrima) {
                  const qtdNecessaria = mp.quantidade * diferenca;
                  await consumirInsumoFIFO(mp.item, qtdNecessaria);
                }
              }
            }
          } else if (type === 'avulso') {
            // Lógica para item avulso: consome direto do estoque (insumos)
            const estoqueInsumos = await getAllRecords('estoque');
            const totalDisponivel = estoqueInsumos
              .filter(e => e.item.toLowerCase().trim() === itemNome.toLowerCase().trim())
              .reduce((sum, e) => sum + e.quantidade, 0);

            if (totalDisponivel < quantidade) {
              const prosseguir = confirm(`Atenção: Estoque de insumo insuficiente para o item avulso "${itemNome}"!\nDisponível: ${totalDisponivel} un. Solicitado: ${quantidade} un.\nDeseja realizar a venda mesmo assim (deixando o estoque negativo)?`);
              if (!prosseguir) return;
            }

            // Desconta o insumo diretamente via FIFO
            await consumirInsumoFIFO(itemNome, quantidade);
          }
        }

        // Salva os pedidos no banco local/remoto
        let first = true;
        for (const item of itemsToSell) {
          const { itemNome, quantidade, valor } = item;
          const novoPedido = {
            item: itemNome,
            quantidade,
            valor,
            frete: first ? frete : 0, // Apenas o primeiro item carrega o frete total
            meioPagamento,
            data: new Date().toISOString(),
            synced: 0
          };
          await addRecord('pedidos', novoPedido);
          first = false;
        }

        showToast('Venda registrada com sucesso!');
        formPedido.reset();

        // Limpa as linhas extras de itens vendidos e restaura apenas a primeira em branco
        const container = document.getElementById('pedItensContainer');
        const optionsHtml = await updateSalesSelectors();
        container.innerHTML = `
          <div class="dynamic-item-row" style="flex-wrap: wrap; margin-bottom: 8px;">
            <div style="display: flex; gap: 8px; width: 100%; align-items: center;">
              <select class="form-control ped-item-select" style="flex: 1;" required>
                ${optionsHtml}
              </select>
              <input type="number" class="form-control ped-item-qty" placeholder="Qtd" min="1" value="1" style="width: 70px;" required>
              <input type="number" class="form-control ped-item-price" placeholder="Preço" step="0.01" min="0" style="width: 90px;" required>
              <button type="button" class="btn-icon-only danger btnRemoveRow" style="display:none;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        `;

        await reloadAllViews();
      } catch (err) {
        showToast('Erro ao registrar venda: ' + err.message, 'error');
      }
    });
  }

  // 5. FORMULÁRIO DE PRODUÇÃO/FABRICAÇÃO (PRODUTOS FINALIZADOS)
  const formProducao = document.getElementById('formProducaoProduto');
  if (formProducao) {
    formProducao.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const produtoFinal = document.getElementById('prodRecipeSelect').value;
        const quantidade = parseFloat(document.getElementById('prodQtd').value) || 0;

        if (!produtoFinal) {
          showToast('Selecione um produto para fabricar.', 'error');
          return;
        }

        const receitas = await getAllRecords('receitas');
        const receita = receitas.find(r => r.produtoFinal === produtoFinal);
        if (!receita) {
          showToast('Receita não encontrada.', 'error');
          return;
        }

        // Verifica estoque de insumos antes de fabricar
        const estoqueInsumos = await getAllRecords('estoque');
        let insumosInsuficientes = false;
        let insumoFaltante = '';

        for (const mp of receita.materiaPrima) {
          const totalDisponivel = estoqueInsumos
            .filter(e => e.item.toLowerCase().trim() === mp.item.toLowerCase().trim())
            .reduce((sum, e) => sum + e.quantidade, 0);
          const qtdNecessaria = mp.quantidade * quantidade;

          if (totalDisponivel < qtdNecessaria) {
            insumosInsuficientes = true;
            insumoFaltante = mp.item;
            break;
          }
        }

        if (insumosInsuficientes) {
          const prosseguir = confirm(`Atenção: Não há estoque suficiente do insumo "${insumoFaltante}" para esta fabricação.\nDeseja fabricar mesmo assim e deixar o estoque do insumo negativo?`);
          if (!prosseguir) return;
        }

        // Consome os insumos do estoque via FIFO
        for (const mp of receita.materiaPrima) {
          const qtdNecessaria = mp.quantidade * quantidade;
          await consumirInsumoFIFO(mp.item, qtdNecessaria);
        }

        const precoVenda = receita.precoVenda || 0;

        // Adiciona ao estoque de produtos finalizados
        const estoqueProdutos = await getAllRecords('estoque_produtos');
        const prodEstocado = estoqueProdutos.find(p => p.produto.toLowerCase() === produtoFinal.toLowerCase());

        if (prodEstocado) {
          prodEstocado.quantidade += quantidade;
          prodEstocado.precoVenda = precoVenda;
          prodEstocado.synced = 0;
          await updateRecord('estoque_produtos', prodEstocado);
        } else {
          const novoProd = {
            produto: produtoFinal,
            quantidade: quantidade,
            precoVenda: precoVenda,
            synced: 0
          };
          await addRecord('estoque_produtos', novoProd);
        }

        showToast(`Produção registrada! ${quantidade} un. de "${produtoFinal}" adicionadas ao estoque.`);
        formProducao.reset();
        await reloadAllViews();
      } catch (err) {
        showToast('Erro ao fabricar produto: ' + err.message, 'error');
      }
    });
  }

  // 4. FORMULÁRIO DE RECEITAS
  const formReceita = document.getElementById('formReceita');
  if (formReceita) {
    formReceita.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const produtoFinal = document.getElementById('recProdFinal').value.trim();
        const maoDeObra = parseFloat(document.getElementById('recMaoObra').value) || 0;
        const precoVenda = parseFloat(document.getElementById('recPrecoVenda').value) || 0;

        // Coleta matérias-primas dinâmicas
        const materiaPrima = [];
        const rows = document.querySelectorAll('#recMateriaPrimaContainer .dynamic-item-row');
        rows.forEach(row => {
          const select = row.querySelector('.mp-select');
          const qty = parseInt(row.querySelector('.mp-qty').value, 10) || 0;
          if (select.value) {
            materiaPrima.push({
              item: select.value,
              quantidade: qty
            });
          }
        });

        if (materiaPrima.length === 0) {
          showToast('Adicione pelo menos uma matéria-prima na receita.', 'error');
          return;
        }

        const novaReceita = {
          produtoFinal,
          materiaPrima,
          maoDeObra,
          precoVenda,
          synced: 0
        };

        await addRecord('receitas', novaReceita);

        // Sincroniza o preço de venda no estoque de produtos finalizados se já existir
        const estoqueProdutos = await getAllRecords('estoque_produtos');
        const prodEstocado = estoqueProdutos.find(p => p.produto.toLowerCase() === produtoFinal.toLowerCase());
        if (prodEstocado) {
          prodEstocado.precoVenda = precoVenda;
          prodEstocado.synced = 0;
          await updateRecord('estoque_produtos', prodEstocado);
        }
        showToast('Receita cadastrada com sucesso!');
        formReceita.reset();

        // Limpa custos calculados e as linhas
        document.getElementById('custoTotalCalculado').innerHTML = `Custo de Fabricação Estimado: <strong>R$ 0,00</strong>`;
        const container = document.getElementById('recMateriaPrimaContainer');
        container.innerHTML = `
          <div class="dynamic-item-row mp-row">
            <select class="form-control mp-select" required>
              <option value="">Selecione insumo...</option>
            </select>
            <input type="number" class="form-control mp-qty" placeholder="Qtd" min="1" step="1" style="width: 80px;" required>
            <button type="button" class="btn-icon-only danger btnRemoveRow" style="display:none;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        `;

        await reloadAllViews();
      } catch (err) {
        showToast('Erro ao salvar receita: ' + err.message, 'error');
      }
    });
  }
}

// --- CARREGAMENTO E RENDERIZAÇÃO DE LISTAS E COMPONENTES ---
async function reloadAllViews() {
  // Carrega contadores do Dashboard
  await renderDashboard();

  // Mantém todos os seletores atualizados com o banco
  await updateAllSelectors();

  // Renderiza Views de abas baseadas no estado ativo
  if (activeTab === 'servicos') {
    await renderServicosView();
  } else if (activeTab === 'estoque') {
    await renderEstoqueView();
  } else if (activeTab === 'pedidos') {
    await renderPedidosView();
  } else if (activeTab === 'receitas') {
    await renderReceitasView();
  } else if (activeTab === 'configuracoes') {
    await renderPecasView();
    await renderAdicionaisView();
  }
}

// Painel do Dashboard Geral
async function renderDashboard() {
  const servicos = await getAllRecords('servicos');
  const estoque = await getAllRecords('estoque');
  const pedidos = await getAllRecords('pedidos');
  const receitas = await getAllRecords('receitas');

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const nomeMesAtual = meses[currentMonth];

  // Cálculos de Faturamento - Filtrados pelo mês atual
  const servicosFinalizadosAll = servicos.filter(s => s.status !== 'Agendado');
  const servicosMes = servicosFinalizadosAll.filter(s => {
    if (!s.data) return false;
    const sDate = new Date(s.data);
    return sDate.getMonth() === currentMonth && sDate.getFullYear() === currentYear;
  });
  const totalServicos = servicosMes.reduce((acc, curr) => acc + (curr.valor || 0), 0);

  const pedidosFinalizadosAll = pedidos.filter(p => p.status !== 'Agendado');
  const pedidosMes = pedidosFinalizadosAll.filter(p => {
    if (!p.data) return false;
    const pDate = new Date(p.data);
    return pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear;
  });
  const totalPedidos = pedidosMes.reduce((acc, curr) => acc + ((curr.itens ? curr.valor : (curr.quantidade * curr.valor)) + (curr.frete || 0)), 0);

  // Contadores de Estoque
  const totalItensEstoque = estoque.length;

  // Status de Sincronização ou Total Pendente
  const unsyncedBadge = document.getElementById('dashTotalUnsynced');
  const usingFirebase = useFirebase;

  if (usingFirebase) {
    if (navigator.onLine) {
      unsyncedBadge.textContent = 'Nuvem Conectada';
      unsyncedBadge.style.color = 'var(--success)';
    } else {
      unsyncedBadge.textContent = 'Offline (Salvo local)';
      unsyncedBadge.style.color = 'var(--warning)';
    }
  } else {
    unsyncedBadge.textContent = 'Apenas Local';
    unsyncedBadge.style.color = 'var(--info)';
  }

  // Atualiza no DOM do Dashboard com o mês correspondente
  const labelServicos = document.querySelector('#dashboard .info-card:nth-child(1) h3');
  if (labelServicos) labelServicos.textContent = `Faturamento Serviços (${nomeMesAtual})`;
  const labelPedidos = document.querySelector('#dashboard .info-card:nth-child(2) h3');
  if (labelPedidos) labelPedidos.textContent = `Vendas/Pedidos (${nomeMesAtual})`;

  document.getElementById('dashTotalServicos').textContent = formatMoney(totalServicos);
  document.getElementById('dashTotalPedidos').textContent = formatMoney(totalPedidos);
  document.getElementById('dashTotalEstoque').textContent = `${totalItensEstoque} insumo${totalItensEstoque !== 1 ? 's' : ''}`;

  // Atividades Recentes (combina as últimas 5 transações de vendas e serviços ordenadas por data)
  const recentesTable = document.getElementById('tableRecentes').querySelector('tbody');

  const atividades = [];
  servicosFinalizadosAll.forEach(s => {
    atividades.push({
      tipo: 'Serviço',
      desc: `Serviço prestado a: ${s.nome}`,
      data: new Date(s.data),
      valor: s.valor,
      synced: s.synced
    });
  });
  pedidosFinalizadosAll.forEach(p => {
    const itensDesc = p.itens ? (Array.isArray(p.itens) ? p.itens.map(i => i.replace(/\s*-\s*R\$\s*[\d.]+/i, '')).join(', ') : p.itens) : `${p.item}`;
    atividades.push({
      tipo: 'Pedido (Venda)',
      desc: `Venda para ${p.nome || 'Cliente Avulso'} - ${itensDesc}`,
      data: new Date(p.data),
      valor: p.itens ? p.valor + (p.frete || 0) : (p.quantidade * p.valor) + (p.frete || 0),
      synced: p.synced
    });
  });

  // Ordena por data decrescente
  atividades.sort((a, b) => b.data - a.data);
  const ultimas5 = atividades.slice(0, 5);

  if (ultimas5.length === 0) {
    recentesTable.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted);">Nenhuma atividade registrada ainda.</td>
      </tr>
    `;
  } else {
    recentesTable.innerHTML = ultimas5.map(a => `
      <tr>
        <td><strong>${a.tipo}</strong></td>
        <td>${escapeHTML(a.desc)}</td>
        <td>${formatDate(a.data)}</td>
        <td>${formatMoney(a.valor)}</td>
      </tr>
    `).join('');
  }
}

// 1. ABA DE SERVIÇOS
async function renderServicosView() {
  const servicos = await getAllRecords('servicos');
  const tbody = document.getElementById('tableServicos').querySelector('tbody');

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const nomeMesAtual = meses[currentMonth];
  const anoAtual = now.getFullYear();

  // Atualiza o título do histórico dinamicamente para mostrar o mês correspondente
  const tituloHistorico = document.querySelector('#servicos .table-panel h2');
  if (tituloHistorico) {
    tituloHistorico.textContent = `Histórico de Serviços (${nomeMesAtual}/${anoAtual})`;
  }

  // Filtra os serviços agendados (fila) e os já finalizados (histórico do mês atual)
  const servicosFila = servicos.filter(s => s.status === 'Agendado');
  const servicosHistorico = servicos.filter(s => {
    if (s.status === 'Agendado') return false;
    if (!s.data) return false;
    const sDate = new Date(s.data);
    return sDate.getMonth() === currentMonth && sDate.getFullYear() === currentYear;
  });

  // --- RENDERIZA O MURAL DA FILA DE ESPERA ---
  const muralPanel = document.getElementById('muralFilaPanel');
  const muralGrid = document.getElementById('muralFilaGrid');

  if (muralPanel && muralGrid) {
    if (servicosFila.length > 0) {
      muralPanel.style.display = 'block';
      muralGrid.innerHTML = servicosFila.map(s => {
        const itensStr = Array.isArray(s.itens) ? s.itens.join(', ') : s.itens;
        const adicionaisStr = s.adicionais ? s.adicionais : '';

        let contentHtml = '';
        if (itensStr) {
          contentHtml += `<div><strong>Peças:</strong> ${escapeHTML(itensStr)}</div>`;
        }
        if (adicionaisStr) {
          contentHtml += `<div style="margin-top: 4px; font-size: 0.82rem; color: var(--primary); font-weight: 500;"><strong>Adicionais:</strong> ${escapeHTML(adicionaisStr)}</div>`;
        }
        if (!itensStr && !adicionaisStr) {
          contentHtml = '<span style="color: var(--text-muted); font-style: italic;">Sem itens/adicionais</span>';
        }

        return `
          <div class="mural-card" style="background: var(--bg-card); border: 1px solid var(--border-glass); border-radius: var(--radius-md); padding: 16px; display: flex; flex-direction: column; gap: 12px; transition: var(--transition-smooth); box-shadow: var(--shadow-lg);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <h3 style="font-family: var(--font-heading); font-size: 1.05rem; color: var(--text-main); margin-bottom: 2px;">${escapeHTML(s.nome || 'Cliente Avulso')}</h3>
                ${s.telefone ? `<div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 4px;">📞 ${escapeHTML(s.telefone)}</div>` : ''}
                <span style="font-size: 0.75rem; color: var(--text-muted);">${formatDate(new Date(s.data))}</span>
              </div>
              <span style="background: rgba(245, 158, 11, 0.1); color: var(--warning); padding: 4px 8px; border-radius: var(--radius-sm); font-size: 0.75rem; font-weight: bold; border: 1px solid rgba(245, 158, 11, 0.2);">Fila</span>
            </div>
            
            <div style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4; flex-grow: 1;">
              ${contentHtml}
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-glass); padding-top: 12px; margin-top: 4px;">
              <div style="font-size: 0.9rem; font-weight: bold; color: var(--text-main);">Total: <span style="color: var(--success);">${formatMoney(s.valor + (s.frete || 0))}</span></div>
              <div style="display: flex; gap: 6px;">
                <button class="btn btn-primary btnConcluirServico" data-id="${s.id}" style="padding: 6px 12px; font-size: 0.75rem; border-radius: var(--radius-sm);">
                  Concluir
                </button>
                <button class="btn-icon-only danger btnDelete" data-store="servicos" data-id="${s.id}" title="Excluir Registro" style="padding: 6px; border-radius: var(--radius-sm);">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } else {
      muralPanel.style.display = 'none';
      muralGrid.innerHTML = '';
    }
  }

  // --- RENDERIZA O HISTÓRICO DE SERVIÇOS ---
  if (servicosHistorico.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted);">Nenhum serviço registrado localmente.</td>
      </tr>
    `;
  } else {
    tbody.innerHTML = servicosHistorico.map(s => {
      // Remove o valor (ex: " - R$ 15.00") de cada item para exibição limpa na tabela principal do histórico
      const itensStr = Array.isArray(s.itens) 
        ? s.itens.map(item => item.replace(/\s*-\s*R\$\s*[\d.]+/i, '')).join(', ') 
        : s.itens;
        
      const adicionaisStr = s.adicionais 
        ? s.adicionais.split(', ').map(ad => ad.replace(/\s*-\s*R\$\s*[\d.]+/i, '')).join(', ') 
        : '';

      let contentHtml = '';
      if (itensStr) {
        contentHtml += `<div><strong>Peças:</strong> ${escapeHTML(itensStr)}</div>`;
      }
      if (adicionaisStr) {
        contentHtml += `<div style="margin-top: 4px; font-size: 0.82rem; color: var(--primary); font-weight: 500;"><strong>Adicionais:</strong> ${escapeHTML(adicionaisStr)}</div>`;
      }
      if (!itensStr && !adicionaisStr) {
        contentHtml = '<span style="color: var(--text-muted); font-style: italic;">Sem itens/adicionais</span>';
      }

      return `
        <tr class="servico-row" data-id="${s.id}" style="cursor: pointer;">
          <td>
            <strong>${escapeHTML(s.nome || 'Cliente Avulso')}</strong>
            ${s.telefone ? `<br><small style="color:var(--text-muted); font-size: 0.75rem;">📞 ${escapeHTML(s.telefone)}</small>` : ''}
            <br><small style="color:var(--text-muted);">${formatDate(new Date(s.data))}</small>
          </td>
          <td>${contentHtml}</td>
          <td>
            Subtotal: ${formatMoney(s.valor)}
            ${s.frete > 0 ? `<br><small style="color:var(--text-muted);">Frete: ${formatMoney(s.frete)}</small>` : ''}
            <br><strong>Total: ${formatMoney(s.valor + (s.frete || 0))}</strong>
          </td>
          <td>${s.meioPagamento}</td>
          <td>
            <button class="btn-icon-only danger btnDelete" data-store="servicos" data-id="${s.id}" title="Excluir Registro">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // --- CONFIGURA OS EVENTOS ---
  setupTableActions();

  // Evento para o botão de Concluir na Fila (Abre o modal de edição/ajuste antes de fechar)
  const btnConcluirList = document.querySelectorAll('.btnConcluirServico');
  btnConcluirList.forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const service = servicos.find(s => String(s.id) === String(id));
      if (service) {
        // Busca os cadastros de peças e adicionais para o modal
        currentPecas = await getAllRecords('pecas');
        currentAdicionais = await getAllRecords('adicionais');

        // Abre o modal de conclusão com os dados pré-carregados
        const modalIdInput = document.getElementById('modalServId');
        const modalNomeInput = document.getElementById('modalServNome');
        const modalTelefoneInput = document.getElementById('modalServTelefone');
        const modalFreteInput = document.getElementById('modalServFrete');
        const modalPagamentoSelect = document.getElementById('modalServPagamento');
        const modalValorInput = document.getElementById('modalServValor');
        const modalItensContainer = document.getElementById('modalServItensContainer');
        const modalAdicionaisContainer = document.getElementById('modalServAdicionaisContainer');

        if (modalIdInput) modalIdInput.value = service.id;
        if (modalNomeInput) modalNomeInput.value = service.nome || '';
        if (modalTelefoneInput) modalTelefoneInput.value = service.telefone || '';
        if (modalFreteInput) modalFreteInput.value = service.frete || 0;
        if (modalPagamentoSelect) modalPagamentoSelect.value = service.meioPagamento || 'Pix';
        if (modalValorInput) modalValorInput.value = service.valor.toFixed(2);

        // Limpa os containers
        if (modalItensContainer) modalItensContainer.innerHTML = '';
        if (modalAdicionaisContainer) modalAdicionaisContainer.innerHTML = '';

        // Popula os itens
        const regex = /^(.*?)\s*\(x(\d+)(?:\s*-\s*R\$\s*([\d.]+))?\)$/i;
        if (Array.isArray(service.itens)) {
          service.itens.forEach(itemStr => {
            const match = itemStr.match(regex);
            if (match) {
              addModalItemRow(match[1], parseInt(match[2], 10), match[3] || '');
            } else {
              addModalItemRow(itemStr, 1, '');
            }
          });
        }

        // Popula os adicionais
        const adList = service.adicionais ? service.adicionais.split(', ') : [];
        adList.forEach(adStr => {
          if (!adStr.trim()) return;
          const match = adStr.match(regex);
          if (match) {
            addModalAdicionalRow(match[1], parseInt(match[2], 10), match[3] || '');
          } else {
            addModalAdicionalRow(adStr, 1, '');
          }
        });

        // Adiciona pelo menos uma linha de item vazia se estiver zerado
        if (modalItensContainer && modalItensContainer.children.length === 0) {
          addModalItemRow('', 1, '');
        }

        // Exibe o modal
        const modal = document.getElementById('modalConcluirServico');
        if (modal) {
          modal.style.display = 'flex';
          recalculaValorModal();
        }
      }
    });
  });
}

// 2. ABA DE ESTOQUE
async function renderEstoqueView() {
  const estoqueOriginal = await getAllRecords('estoque');
  const estoque = estoqueOriginal.filter(e => e.quantidade !== 0);
  const tbody = document.getElementById('tableEstoque').querySelector('tbody');

  if (estoque.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted);">Nenhum insumo cadastrado com estoque disponível.</td>
      </tr>
    `;
  } else {
    // Agrupa por nome de insumo (case-insensitive)
    const grouped = {};
    estoque.forEach(e => {
      const key = e.item.toLowerCase().trim();
      if (!grouped[key]) {
        grouped[key] = {
          item: e.item.trim(),
          quantidadeTotal: 0,
          valorTotal: 0,
          lotes: []
        };
      }
      grouped[key].quantidadeTotal += e.quantidade;
      grouped[key].valorTotal += e.quantidade * e.valor;
      grouped[key].lotes.push(e);
    });

    tbody.innerHTML = Object.values(grouped).map(g => {
      const precoMedio = g.quantidadeTotal > 0 ? (g.valorTotal / g.quantidadeTotal) : 0;
      
      // Ordena os lotes: mais antigos primeiro (FIFO) para conferência
      g.lotes.sort((a, b) => {
        const dataA = a.data ? new Date(a.data).getTime() : 0;
        const dataB = b.data ? new Date(b.data).getTime() : 0;
        return dataA - dataB || a.id - b.id;
      });

      return `
        <tr class="estoque-row" data-item="${escapeHTML(g.item.toLowerCase().trim())}" style="cursor: pointer;">
          <td>
            <strong>${escapeHTML(g.item)}</strong><br>
            <small style="color: var(--primary); font-size: 0.75rem;">Ver ${g.lotes.length} lote(s)</small>
          </td>
          <td style="color:${g.quantidadeTotal <= 2 ? 'var(--error)' : 'var(--text-main)'}; font-weight:${g.quantidadeTotal <= 2 ? 'bold' : 'normal'};">
            ${g.quantidadeTotal}
            ${g.quantidadeTotal <= 2 ? '<br><small style="color:var(--error); font-weight:normal;">Estoque Baixo!</small>' : ''}
          </td>
          <td>${formatMoney(precoMedio)} <span style="font-size:0.75rem; color:var(--text-muted);">(médio)</span></td>
          <td><strong>${formatMoney(g.valorTotal)}</strong></td>
          <td>
            <button class="btn btn-secondary btnVerLotes" data-item="${escapeHTML(g.item.toLowerCase().trim())}" style="padding: 4px 8px; font-size: 0.75rem;">
              Ver Lotes
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  setupTableActions();
  setupEstoqueSelectOption();
  await renderEstoqueProdutosView();
}

// 3. ABA DE PEDIDOS (VENDAS)
async function renderPedidosView() {
  const pedidos = await getAllRecords('pedidos');
  const tbody = document.getElementById('tablePedidos').querySelector('tbody');

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const nomeMesAtual = meses[currentMonth];
  const anoAtual = now.getFullYear();

  // Atualiza o título do histórico dinamicamente para mostrar o mês correspondente
  const tituloHistorico = document.querySelector('#pedidos .table-panel h2');
  if (tituloHistorico) {
    tituloHistorico.textContent = `Pedidos Realizados (${nomeMesAtual}/${anoAtual})`;
  }

  // Filtra pedidos em fila (Agendados) e histórico (Finalizados do mês atual)
  const pedidosFila = pedidos.filter(p => p.status === 'Agendado');
  const pedidosHistorico = pedidos.filter(p => {
    if (p.status === 'Agendado') return false;
    if (!p.data) return false;
    const pDate = new Date(p.data);
    return pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear;
  });

  // --- RENDERIZA O MURAL DA FILA DE ESPERA ---
  const muralPanel = document.getElementById('muralPedidosPanel');
  const muralGrid = document.getElementById('muralPedidosGrid');

  if (muralPanel && muralGrid) {
    if (pedidosFila.length > 0) {
      muralPanel.style.display = 'block';
      muralGrid.innerHTML = pedidosFila.map(p => {
        const itensStr = p.itens ? (Array.isArray(p.itens) ? p.itens.join(', ') : p.itens) : `${p.quantidade}x ${p.item}`;
        return `
          <div class="mural-card" style="background: var(--bg-card); border: 1px solid var(--border-glass); border-radius: var(--radius-md); padding: 16px; display: flex; flex-direction: column; gap: 12px; transition: var(--transition-smooth); box-shadow: var(--shadow-lg);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <h3 style="font-family: var(--font-heading); font-size: 1.05rem; color: var(--text-main); margin-bottom: 2px;">${escapeHTML(p.nome || 'Cliente Avulso')}</h3>
                ${p.telefone ? `<div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 4px;">📞 ${escapeHTML(p.telefone)}</div>` : ''}
                <span style="font-size: 0.75rem; color: var(--text-muted);">${formatDate(new Date(p.data))}</span>
              </div>
              <span style="background: rgba(245, 158, 11, 0.1); color: var(--warning); padding: 4px 8px; border-radius: var(--radius-sm); font-size: 0.75rem; font-weight: bold; border: 1px solid rgba(245, 158, 11, 0.2);">Fila</span>
            </div>
            
            <div style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4; flex-grow: 1;">
              <div><strong>Itens:</strong> ${escapeHTML(itensStr)}</div>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-glass); padding-top: 12px; margin-top: 4px;">
              <span style="font-size: 1rem; font-weight: bold; color: var(--primary);">${formatMoney((p.itens ? p.valor : (p.quantidade * p.valor)) + (p.frete || 0))}</span>
              <button class="btn btn-secondary btnConcluirPedido" data-id="${p.id}" style="padding: 6px 12px; font-size: 0.75rem;">Concluir</button>
            </div>
          </div>
        `;
      }).join('');
    } else {
      muralPanel.style.display = 'none';
      muralGrid.innerHTML = '';
    }
  }

  // --- RENDERIZA O HISTÓRICO DE PEDIDOS ---
  if (pedidosHistorico.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted);">Nenhum pedido de venda finalizado registrado.</td>
      </tr>
    `;
  } else {
    tbody.innerHTML = pedidosHistorico.map(p => {
      // Remove o valor (ex: " - R$ 15.00") de cada item para exibição limpa na tabela
      const itensStr = p.itens
        ? (Array.isArray(p.itens)
            ? p.itens.map(item => item.replace(/\s*-\s*R\$\s*[\d.]+/i, '')).join(', ')
            : p.itens)
        : p.item;

      return `
        <tr class="pedido-row" data-id="${p.id}" style="cursor: pointer;">
          <td>
            <strong>${escapeHTML(p.nome || 'Cliente Avulso')}</strong>
            ${p.telefone ? `<br><small style="color:var(--text-muted); font-size: 0.75rem;">📞 ${escapeHTML(p.telefone)}</small>` : ''}
            <br><small style="color:var(--text-muted);">${formatDate(new Date(p.data))}</small>
          </td>
          <td>${escapeHTML(itensStr)}</td>
          <td>
            Subtotal: ${formatMoney(p.itens ? p.valor : (p.quantidade * p.valor))}
            ${p.frete > 0 ? `<br><small style="color:var(--text-muted);">Frete: ${formatMoney(p.frete)}</small>` : ''}
            <br><strong>Total: ${formatMoney((p.itens ? p.valor : (p.quantidade * p.valor)) + (p.frete || 0))}</strong>
          </td>
          <td>${p.meioPagamento || 'Pix'}</td>
          <td>
            <button class="btn-icon-only danger btnDelete" data-store="pedidos" data-id="${p.id}" title="Excluir Venda">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // --- CONFIGURA OS EVENTOS ---
  setupTableActions();

  // Evento para o botão de Concluir na Fila (Abre o modal de edição/ajuste antes de fechar)
  const btnConcluirList = document.querySelectorAll('.btnConcluirPedido');
  btnConcluirList.forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-id'));
      try {
        const order = await getRecordById('pedidos', id);
        if (!order) return;

        // Abre o modal de conclusão com os dados pré-carregados
        const modalIdInput = document.getElementById('modalPedId');
        const modalNomeInput = document.getElementById('modalPedNome');
        const modalTelefoneInput = document.getElementById('modalPedTelefone');
        const modalFreteInput = document.getElementById('modalPedFrete');
        const modalPagamentoSelect = document.getElementById('modalPedPagamento');
        const modalItensContainer = document.getElementById('modalPedItensContainer');

        if (modalIdInput) modalIdInput.value = order.id;
        if (modalNomeInput) modalNomeInput.value = order.nome || '';
        if (modalTelefoneInput) modalTelefoneInput.value = order.telefone || '';
        if (modalFreteInput) modalFreteInput.value = order.frete || 0;
        if (modalPagamentoSelect) modalPagamentoSelect.value = order.meioPagamento || 'Pix';

        // Limpa o container
        if (modalItensContainer) modalItensContainer.innerHTML = '';

        // Popula os itens
        const regex = /^(.*?)\s*\(x(\d+)(?:\s*-\s*R\$\s*([\d.]+))?\)$/i;
        const itemsList = order.itens ? (Array.isArray(order.itens) ? order.itens : [order.itens]) : [`${order.item} (x${order.quantidade} - R$ ${order.valor.toFixed(2)})`];

        for (const itemStr of itemsList) {
          const match = itemStr.match(regex);
          if (match) {
            const nome = match[1];
            const qty = parseInt(match[2], 10) || 1;
            const price = match[3] ? parseFloat(match[3]) || 0 : 0;
            await addModalPedItemRow(nome, qty, price.toFixed(2));
          } else {
            await addModalPedItemRow(itemStr, 1, '0.00');
          }
        }

        document.getElementById('modalConcluirPedido').style.display = 'flex';
        recalculaValorModalPedido();
      } catch (err) {
        showToast('Erro ao carregar dados do pedido: ' + err.message, 'error');
      }
    });
  });
}

// 4. ABA DE RECEITAS
async function renderReceitasView() {
  const receitas = await getAllRecords('receitas');
  const estoque = await getAllRecords('estoque');
  const tbody = document.getElementById('tableReceitas').querySelector('tbody');

  // Alimentar os campos de estoque nos formulários de receitas e serviços de primeira linha
  setupEstoqueSelectOption();

  if (receitas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted);">Nenhuma receita cadastrada ainda.</td>
      </tr>
    `;
    return;
  }

  // Prepara mapa de custos de estoque
  const estoqueAgrupado = obterEstoqueAgrupado(estoque);
  const estoqueMap = {};
  estoqueAgrupado.forEach(e => {
    estoqueMap[e.item.toLowerCase()] = e.valor;
  });

  tbody.innerHTML = receitas.map(r => {
    // Calcula custo total estimado
    let custoMateriasPrimas = 0;
    const mpTexto = r.materiaPrima.map(mp => {
      const precoUnit = estoqueMap[mp.item.toLowerCase()] || 0;
      custoMateriasPrimas += precoUnit * mp.quantidade;
      return `${escapeHTML(mp.item)} (x${mp.quantidade})`;
    }).join(', ');

    const custoTotal = custoMateriasPrimas + (r.maoDeObra || 0);

    return `
      <tr>
        <td><strong>${escapeHTML(r.produtoFinal)}</strong></td>
        <td>
          <span style="font-size:0.85rem; color:var(--text-muted); display:inline-block; max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${escapeHTML(mpTexto)}
          </span>
          <br><a href="#" class="view-recipe-details" data-id="${r.id}" style="color:var(--secondary); font-size:0.75rem; text-decoration:underline;">Ver Detalhes</a>
        </td>
        <td>${formatMoney(r.maoDeObra)}</td>
        <td><strong>${formatMoney(custoTotal)}</strong></td>
        <!-- Removida coluna Planilha -->
        <td>
          <button class="btn-icon-only danger btnDelete" data-store="receitas" data-id="${r.id}" title="Excluir Receita">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  setupTableActions();
  setupRecipeDetailsLinks(receitas, estoqueMap);
}

// Configura opções de insumos da primeira linha do formulário de receitas
async function setupEstoqueSelectOption() {
  const select = document.querySelector('.mp-select');
  if (select) {
    const estoque = await getAllRecords('estoque');
    const estoqueAgrupado = obterEstoqueAgrupado(estoque);
    const currentValue = select.value;
    let options = '<option value="">Selecione insumo...</option>';
    estoqueAgrupado.forEach(item => {
      options += `<option value="${escapeHTML(item.item)}" data-valor="${item.valor}">${escapeHTML(item.item)} (Disp: ${item.quantidade})</option>`;
    });
    select.innerHTML = options;
    select.value = currentValue;
    setupCustoCalculoEvents();
  }
}

// Configura eventos para ações das tabelas (Editar/Excluir)
function setupTableActions() {
  // Ações de Deleção
  document.querySelectorAll('.btnDelete').forEach(btn => {
    btn.removeEventListener('click', handleDeleteClick);
    btn.addEventListener('click', handleDeleteClick);
  });

  // Ação de Edição (Estoque apenas por enquanto)
  document.querySelectorAll('.btnEdit').forEach(btn => {
    btn.removeEventListener('click', handleEditStockClick);
    btn.addEventListener('click', handleEditStockClick);
  });
}

async function handleDeleteClick(e) {
  const btn = e.currentTarget;
  const store = btn.getAttribute('data-store');
  const id = Number(btn.getAttribute('data-id'));

  const confirmar = confirm('Tem certeza que deseja excluir este registro?');
  if (confirmar) {
    try {
      await deleteRecord(store, id);
      showToast('Registro excluído.');
      await reloadAllViews();
    } catch (err) {
      showToast('Erro ao deletar: ' + err.message, 'error');
    }
  }
}

async function handleEditStockClick(e) {
  const btn = e.currentTarget;
  const id = Number(btn.getAttribute('data-id'));

  try {
    const item = await getRecordById('estoque', id);
    if (item) {
      // Carrega no formulário de estoque
      document.getElementById('estoqueId').value = item.id;
      document.getElementById('estItem').value = item.item;
      document.getElementById('estQtd').value = item.quantidade;
      document.getElementById('estValor').value = item.valor;

      document.getElementById('estoqueFormTitle').textContent = 'Editar Item';
      document.getElementById('btnEstoqueSubmit').textContent = 'Salvar Alterações';
      document.getElementById('btnEstoqueCancel').style.display = 'block';

      // Rola a página para o topo do formulário em telas mobile
      document.getElementById('formEstoque').scrollIntoView({ behavior: 'smooth' });
    }
  } catch (err) {
    showToast('Erro ao carregar item para edição: ' + err.message, 'error');
  }
}

// Visualizador de Detalhes da Composição da Receita
function setupRecipeDetailsLinks(receitas, estoqueMap) {
  document.querySelectorAll('.view-recipe-details').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const id = Number(e.currentTarget.getAttribute('data-id'));
      const receita = receitas.find(r => r.id === id);

      if (receita) {
        const modal = document.getElementById('recipeModal');
        const modalTitle = document.getElementById('modalRecipeTitle');
        const modalBody = document.getElementById('modalRecipeBody');

        modalTitle.textContent = `Receita: ${receita.produtoFinal}`;

        let mpList = '';
        let totalInsumos = 0;

        receita.materiaPrima.forEach(mp => {
          const valUnit = estoqueMap[mp.item.toLowerCase()] || 0;
          const totalMp = valUnit * mp.quantidade;
          totalInsumos += totalMp;
          mpList += `
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid #1f2937; padding-bottom:4px;">
              <span>${escapeHTML(mp.item)} (x${mp.quantidade})</span>
              <span>Unit: ${formatMoney(valUnit)} | Total: <strong>${formatMoney(totalMp)}</strong></span>
            </div>
          `;
        });

        modalBody.innerHTML = `
          <h4 style="margin-bottom:12px; color:var(--secondary);">Insumos e Matérias-Primas</h4>
          <div style="margin-bottom:20px; background:rgba(0,0,0,0.2); padding:12px; border-radius:8px;">
            ${mpList}
            <div style="display:flex; justify-content:space-between; margin-top:12px; font-weight:bold; color:var(--primary);">
              <span>Subtotal Insumos</span>
              <span>${formatMoney(totalInsumos)}</span>
            </div>
          </div>
          
          <h4 style="margin-bottom:12px; color:var(--secondary);">Custos Adicionais</h4>
          <div style="display:flex; justify-content:space-between; background:rgba(0,0,0,0.2); padding:12px; border-radius:8px; margin-bottom:20px;">
            <span>Mão de Obra</span>
            <strong>${formatMoney(receita.maoDeObra)}</strong>
          </div>

          <div style="display:flex; justify-content:space-between; font-size:1.15rem; font-weight:800; border-top:2px solid var(--border-glass); padding-top:12px;">
            <span>CUSTO DE FABRICAÇÃO TOTAL</span>
            <span style="color:var(--primary);">${formatMoney(totalInsumos + receita.maoDeObra)}</span>
          </div>
        `;

        modal.classList.add('active');
      }
    });
  });

  // Fecha Modal
  const btnClose = document.getElementById('btnCloseRecipeModal');
  if (btnClose) {
    btnClose.addEventListener('click', () => {
      document.getElementById('recipeModal').classList.remove('active');
    });
  }

  // Fecha modal ao clicar fora
  window.addEventListener('click', (e) => {
    const modal = document.getElementById('recipeModal');
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
}

// Configuração da aba Ajustes
function setupMaintenanceEvents() {
  const btnExport = document.getElementById('btnExportData');
  const btnImport = document.getElementById('btnImportData');
  const importInput = document.getElementById('importFileInput');
  const btnReset = document.getElementById('btnResetDB');

  if (btnExport) {
    btnExport.addEventListener('click', async () => {
      try {
        const data = {
          servicos: await getAllRecords('servicos'),
          estoque: await getAllRecords('estoque'),
          pedidos: await getAllRecords('pedidos'),
          receitas: await getAllRecords('receitas'),
          pecas: await getAllRecords('pecas'),
          adicionais: await getAllRecords('adicionais'),
          estoque_produtos: await getAllRecords('estoque_produtos'),
          configuracoes: [
            { chave: 'discount_qtd1', valor: discountConfig.qtd1 },
            { chave: 'discount_pct1', valor: discountConfig.pct1 },
            { chave: 'discount_qtd2', valor: discountConfig.qtd2 },
            { chave: 'discount_pct2', valor: discountConfig.pct2 }
          ]
        };

        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-pinheiro-afiacoes-${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        URL.revokeObjectURL(url);
        showToast('Backup exportado com sucesso!');
      } catch (err) {
        showToast('Erro ao exportar backup: ' + err.message, 'error');
      }
    });
  }

  if (btnImport && importInput) {
    btnImport.addEventListener('click', () => {
      importInput.click();
    });

    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target.result);

          if (data.servicos && data.estoque && data.pedidos && data.receitas) {
            const confirmar = confirm('Atenção: A importação irá adicionar estes dados ao seu banco de dados atual. Deseja prosseguir?');
            if (!confirmar) return;

            // Importa Serviços
            for (const item of data.servicos) {
              delete item.id; // deixa IndexedDB auto-incrementar
              await addRecord('servicos', item);
            }
            // Importa Estoque
            for (const item of data.estoque) {
              delete item.id;
              await addRecord('estoque', item);
            }
            // Importa Pedidos
            for (const item of data.pedidos) {
              delete item.id;
              await addRecord('pedidos', item);
            }
            // Importa Receitas
            for (const item of data.receitas) {
              delete item.id;
              await addRecord('receitas', item);
            }

            // Importa Peças
            if (data.pecas) {
              for (const item of data.pecas) {
                delete item.id;
                try {
                  await addRecord('pecas', item);
                } catch (e) {
                  // ignora erros de nome duplicado na importação
                }
              }
            }

            // Importa Adicionais
            if (data.adicionais) {
              for (const item of data.adicionais) {
                delete item.id;
                try {
                  await addRecord('adicionais', item);
                } catch (e) {
                  // ignora duplicados
                }
              }
            }

            // Importa Estoque de Produtos
            if (data.estoque_produtos) {
              for (const item of data.estoque_produtos) {
                delete item.id;
                try {
                  await addRecord('estoque_produtos', item);
                } catch (e) {
                  // ignora duplicados
                }
              }
            }

            if (data.configuracoes) {
              for (const cfg of data.configuracoes) {
                await setConfig(cfg.chave, cfg.valor);
                if (cfg.chave === 'discount_qtd1') {
                  discountConfig.qtd1 = Number(cfg.valor);
                  if (document.getElementById('descQtd1')) document.getElementById('descQtd1').value = cfg.valor;
                } else if (cfg.chave === 'discount_pct1') {
                  discountConfig.pct1 = Number(cfg.valor);
                  if (document.getElementById('descPct1')) document.getElementById('descPct1').value = cfg.valor;
                } else if (cfg.chave === 'discount_qtd2') {
                  discountConfig.qtd2 = Number(cfg.valor);
                  if (document.getElementById('descQtd2')) document.getElementById('descQtd2').value = cfg.valor;
                } else if (cfg.chave === 'discount_pct2') {
                  discountConfig.pct2 = Number(cfg.valor);
                  if (document.getElementById('descPct2')) document.getElementById('descPct2').value = cfg.valor;
                }
              }
            }

            showToast('Backup restaurado e mesclado com sucesso!');
            await reloadAllViews();
          } else {
            showToast('Arquivo de backup inválido.', 'error');
          }
        } catch (err) {
          showToast('Erro ao ler arquivo: ' + err.message, 'error');
        }
      };
      reader.readAsText(file);
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', async () => {
      const confirmar = confirm('ATENÇÃO: Isso excluirá TODOS os dados salvos localmente no navegador! Deseja realmente excluir tudo?');
      if (confirmar) {
        try {
          const req = indexedDB.deleteDatabase('PinheiroAfiacoesDB');
          req.onsuccess = () => {
            showToast('Banco de dados local deletado. Recarregando...', 'success');
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          };
          req.onerror = () => {
            showToast('Erro ao resetar banco local.', 'error');
          };
        } catch (err) {
          showToast('Erro: ' + err.message, 'error');
        }
      }
    });
  }
}

// --- FUNÇÕES UTILITÁRIAS ---
function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

function formatDate(dateObj) {
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return 'Data inválida';
  }
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dateObj);
}

function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// --- GESTÃO DE PREÇOS E CADASTROS ADICIONAIS (PEÇAS E ADICIONAIS) ---

function setupPricingEvents() {
  // FORMULÁRIO DE PEÇAS
  const formPeca = document.getElementById('formPecaPreco');
  const btnPecaCancel = document.getElementById('btnPecaCancel');

  if (formPeca) {
    formPeca.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const idVal = document.getElementById('pecaId').value;
        const nome = document.getElementById('pecaNome').value.trim();
        const precoPadrao = parseFloat(document.getElementById('pecaPreco').value) || 0;

        if (idVal) {
          const id = Number(idVal);
          const registro = await getRecordById('pecas', id);
          if (registro) {
            registro.nome = nome;
            registro.precoPadrao = precoPadrao;
            await updateRecord('pecas', registro);
            showToast('Peça atualizada com sucesso!');
          }
        } else {
          // Verifica se já existe
          const todas = await getAllRecords('pecas');
          const duplicado = todas.find(x => x.nome.toLowerCase() === nome.toLowerCase());
          if (duplicado) {
            showToast(`A peça "${nome}" já está cadastrada.`, 'warning');
            return;
          }

          await addRecord('pecas', { nome, precoPadrao });
          showToast('Peça cadastrada com sucesso!');
        }

        formPeca.reset();
        document.getElementById('pecaId').value = '';
        if (btnPecaCancel) btnPecaCancel.style.display = 'none';
        document.getElementById('btnPecaSubmit').textContent = 'Salvar Peça';

        await renderPecasView();
        await updateAllSelectors();
      } catch (err) {
        showToast('Erro ao salvar peça: ' + err.message, 'error');
      }
    });
  }

  if (btnPecaCancel && formPeca) {
    btnPecaCancel.addEventListener('click', () => {
      formPeca.reset();
      document.getElementById('pecaId').value = '';
      btnPecaCancel.style.display = 'none';
      document.getElementById('btnPecaSubmit').textContent = 'Salvar Peça';
    });
  }

  // FORMULÁRIO DE ADICIONAIS
  const formAdicional = document.getElementById('formAdicionalPreco');
  const btnAdicionalCancel = document.getElementById('btnAdicionalCancel');

  if (formAdicional) {
    formAdicional.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const idVal = document.getElementById('adicionalId').value;
        const nome = document.getElementById('adicionalNome').value.trim();
        const precoPadrao = parseFloat(document.getElementById('adicionalPreco').value) || 0;
        const insumoAtrelado = document.getElementById('adicionalInsumo').value;
        const qtdConsumida = parseFloat(document.getElementById('adicionalQtdInsumo').value) || 0;

        if (idVal) {
          const id = Number(idVal);
          const registro = await getRecordById('adicionais', id);
          if (registro) {
            registro.nome = nome;
            registro.precoPadrao = precoPadrao;
            registro.insumoAtrelado = insumoAtrelado;
            registro.qtdConsumida = insumoAtrelado ? qtdConsumida : 0;
            await updateRecord('adicionais', registro);
            showToast('Adicional updated successfully!');
          }
        } else {
          // Verifica se já existe
          const todas = await getAllRecords('adicionais');
          const duplicado = todas.find(x => x.nome.toLowerCase() === nome.toLowerCase());
          if (duplicado) {
            showToast(`O adicional "${nome}" já está cadastrado.`, 'warning');
            return;
          }

          await addRecord('adicionais', {
            nome,
            precoPadrao,
            insumoAtrelado,
            qtdConsumida: insumoAtrelado ? qtdConsumida : 0
          });
          showToast('Adicional cadastrado com sucesso!');
        }

        formAdicional.reset();
        document.getElementById('adicionalId').value = '';
        if (btnAdicionalCancel) btnAdicionalCancel.style.display = 'none';
        document.getElementById('btnAdicionalSubmit').textContent = 'Salvar Adicional';

        await renderAdicionaisView();
        await updateAllSelectors();
      } catch (err) {
        showToast('Erro ao salvar adicional: ' + err.message, 'error');
      }
    });
  }

  if (btnAdicionalCancel && formAdicional) {
    btnAdicionalCancel.addEventListener('click', () => {
      formAdicional.reset();
      document.getElementById('adicionalId').value = '';
      btnAdicionalCancel.style.display = 'none';
      document.getElementById('btnAdicionalSubmit').textContent = 'Salvar Adicional';
    });
  }

  // FORMULÁRIO DE CONFIGURAÇÃO DE DESCONTOS
  const formDescontos = document.getElementById('formConfigDescontos');
  if (formDescontos) {
    formDescontos.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const qtd1 = Number(document.getElementById('descQtd1').value) || 5;
        const pct1 = Number(document.getElementById('descPct1').value) || 5;
        const qtd2 = Number(document.getElementById('descQtd2').value) || 10;
        const pct2 = Number(document.getElementById('descPct2').value) || 10;

        await setConfig('discount_qtd1', qtd1);
        await setConfig('discount_pct1', pct1);
        await setConfig('discount_qtd2', qtd2);
        await setConfig('discount_pct2', pct2);

        discountConfig.qtd1 = qtd1;
        discountConfig.pct1 = pct1;
        discountConfig.qtd2 = qtd2;
        discountConfig.pct2 = pct2;

        showToast('Configurações de desconto salvas com sucesso!');
        recalculaValorServico();
      } catch (err) {
        showToast('Erro ao salvar descontos: ' + err.message, 'error');
      }
    });
  }
}

async function renderPecasView() {
  const table = document.getElementById('tablePecasPrecos');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  const pecas = await getAllRecords('pecas');

  if (pecas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; color: var(--text-muted);">Nenhuma peça cadastrada.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = pecas.map(p => `
    <tr>
      <td><strong>${escapeHTML(p.nome)}</strong></td>
      <td>${formatMoney(p.precoPadrao)}</td>
      <td>
        <div style="display: flex; gap: 8px;">
          <button class="btn-icon-only edit-peca" data-id="${p.id}" title="Editar Peça">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
          <button class="btn-icon-only danger delete-peca" data-id="${p.id}" title="Excluir Peça">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.edit-peca').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-id'));
      const p = await getRecordById('pecas', id);
      if (p) {
        document.getElementById('pecaId').value = p.id;
        document.getElementById('pecaNome').value = p.nome;
        document.getElementById('pecaPreco').value = p.precoPadrao;
        document.getElementById('btnPecaCancel').style.display = 'inline-block';
        document.getElementById('btnPecaSubmit').textContent = 'Atualizar Peça';
      }
    });
  });

  tbody.querySelectorAll('.delete-peca').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-id'));
      const p = await getRecordById('pecas', id);
      if (p && confirm(`Tem certeza que deseja excluir a peça "${p.nome}"?`)) {
        try {
          await deleteRecord('pecas', id);
          showToast('Peça excluída com sucesso!');
          await renderPecasView();
          await updateAllSelectors();
        } catch (err) {
          showToast('Erro ao excluir peça: ' + err.message, 'error');
        }
      }
    });
  });
}

async function renderAdicionaisView() {
  const table = document.getElementById('tableAdicionaisPrecos');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  const adicionais = await getAllRecords('adicionais');

  if (adicionais.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--text-muted);">Nenhum adicional cadastrado.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = adicionais.map(a => {
    const insumoStr = a.insumoAtrelado ? `${escapeHTML(a.insumoAtrelado)} (x${a.qtdConsumida})` : '-';
    return `
      <tr>
        <td><strong>${escapeHTML(a.nome)}</strong></td>
        <td>${formatMoney(a.precoPadrao)}</td>
        <td style="color: var(--primary); font-weight: 500;">${insumoStr}</td>
        <td>
          <div style="display: flex; gap: 8px;">
            <button class="btn-icon-only edit-adicional" data-id="${a.id}" title="Editar Adicional">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button class="btn-icon-only danger delete-adicional" data-id="${a.id}" title="Excluir Adicional">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.edit-adicional').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-id'));
      const a = await getRecordById('adicionais', id);
      if (a) {
        document.getElementById('adicionalId').value = a.id;
        document.getElementById('adicionalNome').value = a.nome;
        document.getElementById('adicionalPreco').value = a.precoPadrao;
        document.getElementById('adicionalInsumo').value = a.insumoAtrelado || '';
        document.getElementById('adicionalQtdInsumo').value = a.qtdConsumida || '';
        document.getElementById('btnAdicionalCancel').style.display = 'inline-block';
        document.getElementById('btnAdicionalSubmit').textContent = 'Atualizar Adicional';
      }
    });
  });

  tbody.querySelectorAll('.delete-adicional').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-id'));
      const a = await getRecordById('adicionais', id);
      if (a && confirm(`Tem certeza que deseja excluir o adicional "${a.nome}"?`)) {
        try {
          await deleteRecord('adicionais', id);
          showToast('Adicional excluído com sucesso!');
          await renderAdicionaisView();
          await updateAllSelectors();
        } catch (err) {
          showToast('Erro ao excluir adicional: ' + err.message, 'error');
        }
      }
    });
  });
}

async function updateSalesSelectors() {
  const receitas = await getAllRecords('receitas');
  const estoque = await getAllRecords('estoque');
  const estoqueAgrupado = obterEstoqueAgrupado(estoque);

  let options = '<option value="">Selecione o produto/item...</option>';

  options += '<optgroup label="Produtos Fabricados (Receitas)">';
  receitas.forEach(r => {
    options += `<option value="${escapeHTML(r.produtoFinal)}" data-type="receita">${escapeHTML(r.produtoFinal)}</option>`;
  });
  options += '</optgroup>';

  options += '<optgroup label="Insumos/Estoque (Avulso)">';
  estoqueAgrupado.forEach(item => {
    options += `<option value="${escapeHTML(item.item)}" data-type="avulso" data-preco="${item.valor}">${escapeHTML(item.item)} (Disp: ${item.quantidade})</option>`;
  });
  options += '</optgroup>';

  return options;
}

async function updateAllSelectors() {
  // Atualiza selects de Pedidos/Vendas
  const pedSelects = document.querySelectorAll('.ped-item-select');
  if (pedSelects.length > 0) {
    const optionsHtml = await updateSalesSelectors();
    pedSelects.forEach(select => {
      const currentValue = select.value;
      select.innerHTML = optionsHtml;
      select.value = currentValue;
    });
  }
  const pecas = await getAllRecords('pecas');
  const adicionais = await getAllRecords('adicionais');

  // Atualiza select de Insumos nos Adicionais
  const adicionalInsumoSelect = document.getElementById('adicionalInsumo');
  if (adicionalInsumoSelect) {
    const currentValue = adicionalInsumoSelect.value;
    const estoque = await getAllRecords('estoque');
    let options = '<option value="">Nenhum</option>';
    estoque.forEach(e => {
      options += `<option value="${escapeHTML(e.item)}">${escapeHTML(e.item)}</option>`;
    });
    adicionalInsumoSelect.innerHTML = options;
    adicionalInsumoSelect.value = currentValue;
  }

  // Atualiza selects de Peças
  const itemSelects = document.querySelectorAll('.item-select');
  itemSelects.forEach(select => {
    const currentValue = select.value;
    let options = '<option value="">Selecione a peça...</option>';
    pecas.forEach(p => {
      options += `<option value="${escapeHTML(p.nome)}" data-preco="${p.precoPadrao}">${escapeHTML(p.nome)} (${formatMoney(p.precoPadrao)})</option>`;
    });
    options += '<option value="custom">Outro (Digitar)...</option>';
    select.innerHTML = options;

    // Restaura valor se ainda existir
    if (currentValue) {
      select.value = currentValue;
    }
  });

  // Atualiza selects de Adicionais
  const adicionalSelects = document.querySelectorAll('.adicional-select');
  adicionalSelects.forEach(select => {
    const currentValue = select.value;
    let options = '<option value="">Selecione o adicional...</option>';
    adicionais.forEach(a => {
      options += `<option value="${escapeHTML(a.nome)}" data-preco="${a.precoPadrao}">${escapeHTML(a.nome)} (${formatMoney(a.precoPadrao)})</option>`;
    });
    options += '<option value="custom">Outro (Digitar)...</option>';
    select.innerHTML = options;

    if (currentValue) {
      select.value = currentValue;
    }
  });

  // Atualiza select de Receitas na Produção
  const prodRecipeSelect = document.getElementById('prodRecipeSelect');
  if (prodRecipeSelect) {
    const currentValue = prodRecipeSelect.value;
    const receitas = await getAllRecords('receitas');
    let options = '<option value="">Selecione um produto/receita...</option>';
    receitas.forEach(r => {
      options += `<option value="${escapeHTML(r.produtoFinal)}">${escapeHTML(r.produtoFinal)}</option>`;
    });
    prodRecipeSelect.innerHTML = options;
    if (currentValue) {
      prodRecipeSelect.value = currentValue;
    }
  }
}

function recalculaValorServico() {
  let totalPecas = 0;
  let subtotalPecas = 0;

  // Calcula itens
  const itemRows = document.querySelectorAll('#servItensContainer .dynamic-item-row');
  itemRows.forEach(row => {
    const select = row.querySelector('.item-select');
    const qtyInput = row.querySelector('.item-qty');
    const priceInput = row.querySelector('.item-price');
    if (select && qtyInput && priceInput) {
      const precoUnitario = parseFloat(priceInput.value) || 0;
      const qty = parseFloat(qtyInput.value) || 0;
      totalPecas += qty;
      subtotalPecas += precoUnitario * qty;
    }
  });

  // Calcula desconto progressivo nas peças
  let descontoPercentual = 0;
  if (totalPecas >= discountConfig.qtd2) {
    descontoPercentual = discountConfig.pct2;
  } else if (totalPecas >= discountConfig.qtd1) {
    descontoPercentual = discountConfig.pct1;
  }
  const valorDesconto = subtotalPecas * (descontoPercentual / 100);
  const subtotalPecasComDesconto = subtotalPecas - valorDesconto;

  // Calcula adicionais
  let subtotalAdicionais = 0;
  const adicionalRows = document.querySelectorAll('#servAdicionaisContainer .dynamic-item-row');
  adicionalRows.forEach(row => {
    const select = row.querySelector('.adicional-select');
    const qtyInput = row.querySelector('.adicional-qty');
    const priceInput = row.querySelector('.adicional-price');
    if (select && qtyInput && priceInput) {
      const precoUnitario = parseFloat(priceInput.value) || 0;
      const qty = parseFloat(qtyInput.value) || 0;
      subtotalAdicionais += precoUnitario * qty;
    }
  });

  const valorTotalSugerido = subtotalPecasComDesconto + subtotalAdicionais;

  // Preenche o campo
  const inputValor = document.getElementById('servValor');
  if (inputValor) {
    inputValor.value = valorTotalSugerido.toFixed(2);
  }

  // Atualiza label sugerida com o detalhamento
  const labelSugerido = document.getElementById('servValorSugerido');
  if (labelSugerido) {
    if (subtotalPecas > 0 || subtotalAdicionais > 0) {
      let breakdown = `Subtotal Peças: ${formatMoney(subtotalPecas)}`;
      if (valorDesconto > 0) {
        breakdown += ` | Desconto Progressivo (${descontoPercentual}%): -${formatMoney(valorDesconto)}`;
      }
      if (subtotalAdicionais > 0) {
        breakdown += ` | Adicionais: ${formatMoney(subtotalAdicionais)}`;
      }
      breakdown += ` | <strong>Preço Sugerido: ${formatMoney(valorTotalSugerido)}</strong>`;
      labelSugerido.innerHTML = breakdown;
    } else {
      labelSugerido.innerHTML = '';
    }
  }
}

// --- RENDERIZAÇÃO E GESTÃO DE ESTOQUE DE PRODUTOS FINALIZADOS ---

async function renderEstoqueProdutosView() {
  const table = document.getElementById('tableEstoqueProdutos');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  const produtos = await getAllRecords('estoque_produtos');
  const receitas = await getAllRecords('receitas');
  const estoqueInsumos = await getAllRecords('estoque');
  const estoqueInsumosAgrupado = obterEstoqueAgrupado(estoqueInsumos);

  if (produtos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted);">Nenhum produto em estoque.</td>
      </tr>
    `;
    return;
  }

  const rows = [];
  for (const p of produtos) {
    const receita = receitas.find(r => r.produtoFinal.toLowerCase() === p.produto.toLowerCase());
    let custoUnitario = 0;

    if (receita) {
      custoUnitario += receita.maoDeObra || 0;
      if (Array.isArray(receita.materiaPrima)) {
        receita.materiaPrima.forEach(mp => {
          const insumo = estoqueInsumosAgrupado.find(i => i.item.toLowerCase() === mp.item.toLowerCase());
          const precoUnitarioInsumo = insumo ? insumo.valor : 0;
          custoUnitario += precoUnitarioInsumo * mp.quantidade;
        });
      }
    }

    const custoTotal = custoUnitario * p.quantidade;
    const precoVendaStr = p.precoVenda !== undefined ? formatMoney(p.precoVenda) : 'Não cadastrado';

    rows.push(`
      <tr>
        <td><strong>${escapeHTML(p.produto)}</strong></td>
        <td>${p.quantidade} un.</td>
        <td>${formatMoney(custoUnitario)}</td>
        <td style="color: var(--secondary); font-weight: bold;">${precoVendaStr}</td>
        <td><strong>${formatMoney(custoTotal)}</strong></td>
        <td>
          <button class="btn-icon-only danger btnDeleteProdutoEstoque" data-id="${p.id}" title="Remover do Estoque">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </td>
      </tr>
    `);
  }

  tbody.innerHTML = rows.join('');

  // Evento para deletar o registro do estoque de produtos
  tbody.querySelectorAll('.btnDeleteProdutoEstoque').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-id'));
      const p = await getRecordById('estoque_produtos', id);
      if (p && confirm(`Deseja realmente remover o produto "${p.produto}" do estoque?`)) {
        try {
          await deleteRecord('estoque_produtos', id);
          showToast('Produto removido do estoque!');
          await reloadAllViews();
        } catch (err) {
          showToast('Erro ao remover produto: ' + err.message, 'error');
        }
      }
    });
  });
}

// --- FUNÇÕES AUXILIARES DE ESTOQUE POR LOTE (FIFO) ---

// Consolida os itens do estoque agrupando por nome, calculando a quantidade total e o preço médio ponderado
function obterEstoqueAgrupado(estoqueItens) {
  const grouped = {};
  estoqueItens.forEach(e => {
    // Filtra lotes zerados para não afetar o cálculo, a menos que seja o único registro de estoque
    if (e.quantidade === 0) return;

    const key = e.item.toLowerCase().trim();
    if (!grouped[key]) {
      grouped[key] = {
        item: e.item.trim(),
        quantidade: 0,
        valorTotal: 0,
        latestId: 0,
        latestValor: e.valor
      };
    }
    grouped[key].quantidade += e.quantidade;
    grouped[key].valorTotal += e.quantidade * e.valor;
    if (e.id > grouped[key].latestId) {
      grouped[key].latestId = e.id;
      grouped[key].latestValor = e.valor;
    }
  });

  return Object.values(grouped).map(g => ({
    item: g.item,
    quantidade: g.quantidade,
    valor: g.quantidade > 0 ? parseFloat((g.valorTotal / g.quantidade).toFixed(2)) : g.latestValor
  }));
}

// Executa o consumo de um insumo descontando primeiro do lote mais antigo com quantidade disponível (FIFO)
async function consumirInsumoFIFO(itemName, qtdAConsumir) {
  if (qtdAConsumir <= 0) return;
  const estoque = await getAllRecords('estoque');

  // Filtra registros do mesmo insumo
  const lotes = estoque.filter(e => e.item.toLowerCase().trim() === itemName.toLowerCase().trim());

  // Ordena por data (mais antigo primeiro), usando ID como critério de desempate
  lotes.sort((a, b) => {
    const dataA = a.data ? new Date(a.data).getTime() : 0;
    const dataB = b.data ? new Date(b.data).getTime() : 0;
    return dataA - dataB || a.id - b.id;
  });

  let restante = qtdAConsumir;

  // Primeiro consome dos lotes com quantidade > 0
  for (const lote of lotes) {
    if (lote.quantidade > 0) {
      if (lote.quantidade >= restante) {
        lote.quantidade -= restante;
        lote.synced = 0;
        await updateRecord('estoque', lote);
        restante = 0;
        break;
      } else {
        restante -= lote.quantidade;
        lote.quantidade = 0;
        lote.synced = 0;
        await updateRecord('estoque', lote);
      }
    }
  }

  // Se ainda restar quantidade a consumir (estoque insuficiente / negativo autorizado)
  if (restante > 0) {
    if (lotes.length > 0) {
      // Deduz do lote mais recente
      const ultimoLote = lotes[lotes.length - 1];
      ultimoLote.quantidade -= restante;
      ultimoLote.synced = 0;
      await updateRecord('estoque', ultimoLote);
    } else {
      // Se não há nenhum lote cadastrado para este item, cria um novo registro negativo
      const novoInsumo = {
        item: itemName,
        quantidade: -restante,
        valor: 0,
        data: new Date().toISOString(),
        synced: 0
      };
      await addRecord('estoque', novoInsumo);
    }
  }
}

// --- FUNÇÕES DO MODAL DE CONCLUSÃO DE SERVIÇOS AGENDADOS ---
function setupModalConcluir() {
  const btnFecharModalConcluir = document.getElementById('btnFecharModalConcluir');
  const btnModalCancelar = document.getElementById('btnModalCancelar');
  const btnModalAddServItem = document.getElementById('btnModalAddServItem');
  const btnModalAddAdicionalRow = document.getElementById('btnModalAddAdicionalRow');
  const formModalConcluir = document.getElementById('formModalConcluir');

  const fecharModal = () => {
    const modal = document.getElementById('modalConcluirServico');
    if (modal) modal.style.display = 'none';
  };

  if (btnFecharModalConcluir) btnFecharModalConcluir.addEventListener('click', fecharModal);
  if (btnModalCancelar) btnModalCancelar.addEventListener('click', fecharModal);

  if (btnModalAddServItem) {
    btnModalAddServItem.addEventListener('click', () => {
      addModalItemRow('', 1, '');
    });
  }

  if (btnModalAddAdicionalRow) {
    btnModalAddAdicionalRow.addEventListener('click', () => {
      addModalAdicionalRow('', 1, '');
    });
  }

  if (formModalConcluir) {
    formModalConcluir.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const id = document.getElementById('modalServId').value;
        const nome = document.getElementById('modalServNome').value.trim();
        const telefone = document.getElementById('modalServTelefone') ? document.getElementById('modalServTelefone').value.trim() : '';
        const valor = parseFloat(document.getElementById('modalServValor').value) || 0;
        const frete = parseFloat(document.getElementById('modalServFrete').value) || 0;
        const meioPagamento = document.getElementById('modalServPagamento').value;

        // Coleta itens do modal
        const itens = [];
        const itemRows = document.querySelectorAll('.modal-item-row');
        itemRows.forEach(row => {
          const select = row.querySelector('.modal-item-select');
          const qtyInput = row.querySelector('.modal-item-qty');
          const priceInput = row.querySelector('.modal-item-price');

          let name = '';
          if (select) {
            if (select.value === 'custom') {
              const customInput = row.querySelector('.modal-item-name-custom');
              name = customInput ? customInput.value.trim() : '';
            } else {
              name = select.value;
            }
          }

          if (name) {
            const qty = qtyInput ? qtyInput.value : 1;
            const price = priceInput ? parseFloat(priceInput.value) || 0 : 0;
            itens.push(`${name} (x${qty} - R$ ${price.toFixed(2)})`);
          }
        });

        // Coleta adicionais do modal
        const adicionaisArr = [];
        const adicionalRows = document.querySelectorAll('.modal-adicional-row');
        adicionalRows.forEach(row => {
          const select = row.querySelector('.modal-adicional-select');
          const qtyInput = row.querySelector('.modal-adicional-qty');
          const priceInput = row.querySelector('.modal-adicional-price');

          let name = '';
          if (select) {
            if (select.value === 'custom') {
              const customInput = row.querySelector('.modal-adicional-name-custom');
              name = customInput ? customInput.value.trim() : '';
            } else {
              name = select.value;
            }
          }

          if (name) {
            const qty = qtyInput ? qtyInput.value : 1;
            const price = priceInput ? parseFloat(priceInput.value) || 0 : 0;
            adicionaisArr.push(`${name} (x${qty} - R$ ${price.toFixed(2)})`);
          }
        });

        if (itens.length === 0 && adicionaisArr.length === 0) {
          showToast('Adicione pelo menos uma peça ou um serviço adicional.', 'error');
          return;
        }

        const adicionais = adicionaisArr.join(', ');

        const service = await getRecordById('servicos', Number(id));
        if (service) {
          // Processa dedução de estoque dos adicionais na conclusão do serviço
          const todosAdicionais = await getAllRecords('adicionais');
          const estoqueInsumos = await getAllRecords('estoque');

          const deducoesEstoque = [];
          let estoqueInsuficiente = false;
          let insumoFaltante = '';

          const adicionalRows = document.querySelectorAll('.modal-adicional-row');
          adicionalRows.forEach(row => {
            const select = row.querySelector('.modal-adicional-select');
            const qtyInput = row.querySelector('.modal-adicional-qty');
            const qtyVal = qtyInput ? parseFloat(qtyInput.value) || 0 : 0;

            let name = '';
            if (select) {
              if (select.value === 'custom') {
                const customInput = row.querySelector('.modal-adicional-name-custom');
                name = customInput ? customInput.value.trim() : '';
              } else {
                name = select.value;
              }
            }

            if (name) {
              const ad = todosAdicionais.find(x => x.nome.toLowerCase() === name.toLowerCase());
              if (ad && ad.insumoAtrelado) {
                const totalDisponivel = estoqueInsumos
                  .filter(e => e.item.toLowerCase().trim() === ad.insumoAtrelado.toLowerCase().trim())
                  .reduce((sum, e) => sum + e.quantidade, 0);
                const totalConsumo = ad.qtdConsumida * qtyVal;

                if (totalDisponivel < totalConsumo) {
                  estoqueInsuficiente = true;
                  insumoFaltante = ad.insumoAtrelado;
                }

                deducoesEstoque.push({
                  insumoNome: ad.insumoAtrelado,
                  quantidade: totalConsumo
                });
              }
            }
          });

          if (estoqueInsuficiente) {
            const prosseguir = confirm(`Atenção: Não há estoque suficiente do insumo "${insumoFaltante}" atrelado aos adicionais selecionados.\nDeseja concluir o serviço mesmo assim (deixando o estoque do insumo negativo)?`);
            if (!prosseguir) return;
          }

          // Executa a dedução de insumos de fato
          for (const ded of deducoesEstoque) {
            await consumirInsumoFIFO(ded.insumoNome, ded.quantidade);
          }

          service.nome = nome;
          service.telefone = telefone;
          service.itens = itens;
          service.adicionais = adicionais;
          service.valor = valor;
          service.frete = frete;
          service.meioPagamento = meioPagamento;
          service.status = 'Finalizado';
          service.synced = 0;

          await updateRecord('servicos', service);
          showToast('Serviço concluído com sucesso!');
          fecharModal();
          await reloadAllViews();
        }
      } catch (err) {
        showToast('Erro ao concluir serviço: ' + err.message, 'error');
      }
    });
  }

  // Delegação para controlar visibilidade de inputs personalizados e preencher preços no modal
  document.addEventListener('change', (e) => {
    if (e.target.classList.contains('modal-item-select')) {
      const row = e.target.closest('.dynamic-item-row');
      const customInput = row.querySelector('.modal-item-name-custom');
      const priceInput = row.querySelector('.modal-item-price');
      if (e.target.value === 'custom') {
        customInput.style.display = 'block';
        customInput.setAttribute('required', 'required');
        if (priceInput) priceInput.value = '';
      } else {
        customInput.style.display = 'none';
        customInput.removeAttribute('required');
        const selectedOption = e.target.options[e.target.selectedIndex];
        const preco = selectedOption ? parseFloat(selectedOption.getAttribute('data-preco')) || 0 : 0;
        if (priceInput) {
          priceInput.value = selectedOption && e.target.value ? preco.toFixed(2) : '';
        }
      }
      recalculaValorModal();
    }

    if (e.target.classList.contains('modal-adicional-select')) {
      const row = e.target.closest('.dynamic-item-row');
      const customInput = row.querySelector('.modal-adicional-name-custom');
      const priceInput = row.querySelector('.modal-adicional-price');
      if (e.target.value === 'custom') {
        customInput.style.display = 'block';
        customInput.setAttribute('required', 'required');
        if (priceInput) priceInput.value = '';
      } else {
        customInput.style.display = 'none';
        customInput.removeAttribute('required');
        const selectedOption = e.target.options[e.target.selectedIndex];
        const preco = selectedOption ? parseFloat(selectedOption.getAttribute('data-preco')) || 0 : 0;
        if (priceInput) {
          priceInput.value = selectedOption && e.target.value ? preco.toFixed(2) : '';
        }
      }
      recalculaValorModal();
    }
  });

  // Delegação para remover linhas dentro do modal
  document.addEventListener('click', (e) => {
    if (e.target.closest('.btnRemoveModalRow')) {
      const row = e.target.closest('.dynamic-item-row');
      if (row) {
        row.remove();
        recalculaValorModal();
        recalculaValorModalPedido();
      }
    }
  });

  // Delegação para recalcular ao alterar quantidade/preço no modal
  document.addEventListener('input', (e) => {
    if (
      e.target.classList.contains('modal-item-qty') ||
      e.target.classList.contains('modal-item-price') ||
      e.target.classList.contains('modal-adicional-qty') ||
      e.target.classList.contains('modal-adicional-price')
    ) {
      recalculaValorModal();
    }
  });
}

function addModalItemRow(name = '', qty = 1, price = '') {
  const container = document.getElementById('modalServItensContainer');
  if (!container) return;

  // Build options
  let options = '<option value="">Selecione a peça...</option>';
  let isCustom = name !== '' && !currentPecas.some(p => p.nome.toLowerCase() === name.toLowerCase());

  currentPecas.forEach(p => {
    const selected = (!isCustom && p.nome.toLowerCase() === name.toLowerCase()) ? 'selected' : '';
    options += `<option value="${escapeHTML(p.nome)}" data-preco="${p.precoPadrao}" ${selected}>${escapeHTML(p.nome)} (${formatMoney(p.precoPadrao)})</option>`;
  });

  const customSelected = isCustom || name === 'custom' ? 'selected' : '';
  options += `<option value="custom" ${customSelected}>Outro (Digitar)...</option>`;

  const row = document.createElement('div');
  row.className = 'dynamic-item-row modal-item-row';
  row.style.flexWrap = 'wrap';
  row.style.marginBottom = '8px';

  row.innerHTML = `
    <div style="display: flex; gap: 8px; width: 100%; align-items: center;">
      <select class="form-control modal-item-select" style="flex: 1;" required>
        ${options}
      </select>
      <input type="number" class="form-control modal-item-qty" placeholder="Qtd" min="1" value="${qty}" style="width: 65px;" required>
      <input type="number" class="form-control modal-item-price" placeholder="Preço" step="0.01" min="0" value="${price}" style="width: 85px;" required>
      <button type="button" class="btn-icon-only danger btnRemoveModalRow">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
    <input type="text" class="form-control modal-item-name-custom" placeholder="Nome da peça personalizada" value="${isCustom ? escapeHTML(name) : ''}" style="${isCustom ? 'display: block;' : 'display: none;'} margin-top: 8px; width: 100%;" ${isCustom ? 'required' : ''} />
  `;
  container.appendChild(row);
  recalculaValorModal();
}

function addModalAdicionalRow(name = '', qty = 1, price = '') {
  const container = document.getElementById('modalServAdicionaisContainer');
  if (!container) return;

  // Build options
  let options = '<option value="">Selecione o adicional...</option>';
  let isCustom = name !== '' && !currentAdicionais.some(a => a.nome.toLowerCase() === name.toLowerCase());

  currentAdicionais.forEach(a => {
    const selected = (!isCustom && a.nome.toLowerCase() === name.toLowerCase()) ? 'selected' : '';
    options += `<option value="${escapeHTML(a.nome)}" data-preco="${a.precoPadrao}" ${selected}>${escapeHTML(a.nome)} (${formatMoney(a.precoPadrao)})</option>`;
  });

  const customSelected = isCustom || name === 'custom' ? 'selected' : '';
  options += `<option value="custom" ${customSelected}>Outro (Digitar)...</option>`;

  const row = document.createElement('div');
  row.className = 'dynamic-item-row modal-adicional-row';
  row.style.flexWrap = 'wrap';
  row.style.marginBottom = '8px';

  row.innerHTML = `
    <div style="display: flex; gap: 8px; width: 100%; align-items: center;">
      <select class="form-control modal-adicional-select" style="flex: 1;" required>
        ${options}
      </select>
      <input type="number" class="form-control modal-adicional-qty" placeholder="Qtd" min="1" value="${qty}" style="width: 65px;" required>
      <input type="number" class="form-control modal-adicional-price" placeholder="Preço" step="0.01" min="0" value="${price}" style="width: 85px;" required>
      <button type="button" class="btn-icon-only danger btnRemoveModalRow">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
    <input type="text" class="form-control modal-adicional-name-custom" placeholder="Nome do adicional personalizado" value="${isCustom ? escapeHTML(name) : ''}" style="${isCustom ? 'display: block;' : 'display: none;'} margin-top: 8px; width: 100%;" ${isCustom ? 'required' : ''} />
  `;
  container.appendChild(row);
  recalculaValorModal();
}

function recalculaValorModal() {
  let totalPecas = 0;
  let subtotalPecas = 0;

  // Calcula itens
  const itemRows = document.querySelectorAll('.modal-item-row');
  itemRows.forEach(row => {
    const qtyInput = row.querySelector('.modal-item-qty');
    const priceInput = row.querySelector('.modal-item-price');
    if (qtyInput && priceInput) {
      const qty = parseFloat(qtyInput.value) || 0;
      const price = parseFloat(priceInput.value) || 0;
      totalPecas += qty;
      subtotalPecas += price * qty;
    }
  });

  // Calcula desconto progressivo nas peças
  let descontoPercentual = 0;
  if (totalPecas >= discountConfig.qtd2) {
    descontoPercentual = discountConfig.pct2;
  } else if (totalPecas >= discountConfig.qtd1) {
    descontoPercentual = discountConfig.pct1;
  }
  const valorDesconto = subtotalPecas * (descontoPercentual / 100);
  const subtotalPecasComDesconto = subtotalPecas - valorDesconto;

  // Calcula adicionais
  let subtotalAdicionais = 0;
  const adicionalRows = document.querySelectorAll('.modal-adicional-row');
  adicionalRows.forEach(row => {
    const qtyInput = row.querySelector('.modal-adicional-qty');
    const priceInput = row.querySelector('.modal-adicional-price');
    if (qtyInput && priceInput) {
      const qty = parseFloat(qtyInput.value) || 0;
      const price = parseFloat(priceInput.value) || 0;
      subtotalAdicionais += price * qty;
    }
  });

  const valorTotalSugerido = subtotalPecasComDesconto + subtotalAdicionais;

  // Preenche o campo
  const inputValor = document.getElementById('modalServValor');
  if (inputValor) {
    inputValor.value = valorTotalSugerido.toFixed(2);
  }

  // Atualiza label sugerida com o detalhamento
  const labelSugerido = document.getElementById('modalServValorSugerido');
  if (labelSugerido) {
    if (subtotalPecas > 0 || subtotalAdicionais > 0) {
      let breakdown = `Subtotal Peças: ${formatMoney(subtotalPecas)}`;
      if (valorDesconto > 0) {
        breakdown += ` | Desconto Progressivo (${descontoPercentual}%): -${formatMoney(valorDesconto)}`;
      }
      if (subtotalAdicionais > 0) {
        breakdown += ` | Adicionais: ${formatMoney(subtotalAdicionais)}`;
      }
      breakdown += ` | <strong>Preço Sugerido: ${formatMoney(valorTotalSugerido)}</strong>`;
      labelSugerido.innerHTML = breakdown;
    } else {
      labelSugerido.innerHTML = '';
    }
  }
}

// --- FUNÇÕES DO MODAL DE DETALHES DO SERVIÇO ---
function setupModalDetalhes() {
  const fecharModal = () => {
    const modal = document.getElementById('modalDetalhesServico');
    if (modal) modal.style.display = 'none';
  };

  const btnFecharModalDetalhes = document.getElementById('btnFecharModalDetalhes');
  if (btnFecharModalDetalhes) btnFecharModalDetalhes.addEventListener('click', fecharModal);

  const btnFecharModalDetalhesAcoes = document.getElementById('btnFecharModalDetalhesAcoes');
  if (btnFecharModalDetalhesAcoes) btnFecharModalDetalhesAcoes.addEventListener('click', fecharModal);

  // Delegação global para abrir os detalhes de um serviço ao clicar na linha
  document.addEventListener('click', (e) => {
    const row = e.target.closest('.servico-row');
    if (row && !e.target.closest('.btnDelete')) {
      const id = row.getAttribute('data-id');
      exibirDetalhesServico(id);
    }
  });
}

async function exibirDetalhesServico(id) {
  try {
    const s = await getRecordById('servicos', Number(id));
    if (!s) return;

    // Preenche cabeçalho
    document.getElementById('detalheCliente').textContent = s.nome || 'Cliente Avulso';
    const detalheTelefone = document.getElementById('detalheTelefone');
    if (detalheTelefone) {
      detalheTelefone.textContent = s.telefone || 'Não informado';
    }
    document.getElementById('detalheData').textContent = formatDate(new Date(s.data));
    document.getElementById('detalhePagamento').textContent = s.meioPagamento;

    // Limpa listas
    const itensList = document.getElementById('detalheItensList');
    const adListContainer = document.getElementById('detalheAdicionaisList');
    const adSection = document.getElementById('detalheAdicionaisSection');

    itensList.innerHTML = '';
    adListContainer.innerHTML = '';
    adSection.style.display = 'none';

    let subtotalPecas = 0;
    let subtotalAdicionais = 0;
    const regex = /^(.*?)\s*\(x(\d+)(?:\s*-\s*R\$\s*([\d.]+))?\)$/i;

    // Processa itens
    if (Array.isArray(s.itens)) {
      s.itens.forEach(itemStr => {
        const match = itemStr.match(regex);
        if (match) {
          const nome = match[1];
          const qty = parseInt(match[2], 10) || 1;
          const precoUnitario = match[3] ? parseFloat(match[3]) || 0 : 0;
          const totalItem = qty * precoUnitario;
          subtotalPecas += totalItem;

          itensList.innerHTML += `
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
              <span><strong>${escapeHTML(nome)}</strong> (x${qty}) <span style="color: var(--text-muted); font-size: 0.8rem; margin-left: 4px;">a ${formatMoney(precoUnitario)} cada</span></span>
              <span style="color: var(--text-main); font-weight: 500;">${formatMoney(totalItem)}</span>
            </div>
          `;
        } else {
          itensList.innerHTML += `
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
              <span><strong>${escapeHTML(itemStr)}</strong></span>
              <span style="color: var(--text-muted); font-style: italic;">R$ 0,00</span>
            </div>
          `;
        }
      });
    }

    // Processa adicionais
    const adList = s.adicionais ? s.adicionais.split(', ') : [];
    if (adList.length > 0 && adList[0].trim() !== '') {
      adSection.style.display = 'block';
      adList.forEach(adStr => {
        const match = adStr.match(regex);
        if (match) {
          const nome = match[1];
          const qty = parseInt(match[2], 10) || 1;
          const precoUnitario = match[3] ? parseFloat(match[3]) || 0 : 0;
          const totalAd = qty * precoUnitario;
          subtotalAdicionais += totalAd;

          adListContainer.innerHTML += `
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
              <span><strong>${escapeHTML(nome)}</strong> (x${qty}) <span style="color: var(--text-muted); font-size: 0.8rem; margin-left: 4px;">a ${formatMoney(precoUnitario)} cada</span></span>
              <span style="color: var(--text-main); font-weight: 500;">${formatMoney(totalAd)}</span>
            </div>
          `;
        } else {
          adListContainer.innerHTML += `
            <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
              <span><strong>${escapeHTML(adStr)}</strong></span>
              <span style="color: var(--text-muted); font-style: italic;">R$ 0,00</span>
            </div>
          `;
        }
      });
    }

    // Processa totais
    const subtotalGeral = subtotalPecas + subtotalAdicionais;
    const desconto = subtotalGeral - s.valor;

    document.getElementById('detalheSubtotal').textContent = formatMoney(subtotalGeral);

    if (desconto > 0.01) {
      document.getElementById('detalheDescontoRow').style.display = 'flex';
      document.getElementById('detalheDesconto').textContent = '-' + formatMoney(desconto);
    } else {
      document.getElementById('detalheDescontoRow').style.display = 'none';
    }

    if (s.frete > 0) {
      document.getElementById('detalheFreteRow').style.display = 'flex';
      document.getElementById('detalheFrete').textContent = formatMoney(s.frete);
    } else {
      document.getElementById('detalheFreteRow').style.display = 'none';
    }

    document.getElementById('detalheTotal').textContent = formatMoney(s.valor + (s.frete || 0));

    // Exibe o modal
    document.getElementById('modalDetalhesServico').style.display = 'flex';
  } catch (err) {
    showToast('Erro ao abrir detalhes: ' + err.message, 'error');
  }
}

// --- FUNÇÕES DO MODAL DE DETALHES DE LOTES DE ESTOQUE ---
function setupModalLotes() {
  const fecharModal = () => {
    const modal = document.getElementById('modalLotesEstoque');
    if (modal) modal.style.display = 'none';
  };

  const btnFecharModalLotes = document.getElementById('btnFecharModalLotes');
  if (btnFecharModalLotes) btnFecharModalLotes.addEventListener('click', fecharModal);

  const btnFecharModalLotesAcoes = document.getElementById('btnFecharModalLotesAcoes');
  if (btnFecharModalLotesAcoes) btnFecharModalLotesAcoes.addEventListener('click', fecharModal);

  // Delegação global para abrir os lotes de um insumo do estoque ao clicar na linha da tabela consolidada
  const tbody = document.getElementById('tableEstoque').querySelector('tbody');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const row = e.target.closest('.estoque-row');
      if (row && !e.target.closest('button')) {
        const itemKey = row.getAttribute('data-item');
        exibirLotesInsumo(itemKey);
      }
    });

    // Listener para botões específicos "Ver Lotes"
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('.btnVerLotes');
      if (btn) {
        const itemKey = btn.getAttribute('data-item');
        exibirLotesInsumo(itemKey);
      }
    });
  }

  // Gerenciamento de eventos de ação dentro do modal de lotes (editar/excluir lote individual)
  const modalLotesBody = document.getElementById('modalLotesTableBody');
  if (modalLotesBody) {
    modalLotesBody.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.btnEditLote');
      if (editBtn) {
        const id = Number(editBtn.getAttribute('data-id'));
        fecharModal();
        const mockEvent = { currentTarget: editBtn };
        await handleEditStockClick(mockEvent);
        return;
      }

      const deleteBtn = e.target.closest('.btnDeleteLote');
      if (deleteBtn) {
        const id = Number(deleteBtn.getAttribute('data-id'));
        const confirmar = confirm('Tem certeza que deseja excluir este lote de estoque?');
        if (confirmar) {
          try {
            await deleteRecord('estoque', id);
            showToast('Lote de estoque excluído.');
            
            await reloadAllViews();

            const itemKey = document.getElementById('modalLotesItemNome').textContent.toLowerCase().trim();
            const estoque = await getAllRecords('estoque');
            const lotesRestantes = estoque.filter(el => el.item.toLowerCase().trim() === itemKey && el.quantidade !== 0);

            if (lotesRestantes.length > 0) {
              exibirLotesInsumo(itemKey);
            } else {
              fecharModal();
            }
          } catch (err) {
            showToast('Erro ao deletar lote: ' + err.message, 'error');
          }
        }
      }
    });
  }
}

async function exibirLotesInsumo(itemKey) {
  try {
    const estoqueOriginal = await getAllRecords('estoque');
    const lotes = estoqueOriginal.filter(e => e.item.toLowerCase().trim() === itemKey.toLowerCase().trim() && e.quantidade !== 0);

    if (lotes.length === 0) {
      showToast('Nenhum lote ativo encontrado para este insumo.', 'warning');
      return;
    }

    // Ordena os lotes: mais antigos primeiro (FIFO)
    lotes.sort((a, b) => {
      const dataA = a.data ? new Date(a.data).getTime() : 0;
      const dataB = b.data ? new Date(b.data).getTime() : 0;
      return dataA - dataB || a.id - b.id;
    });

    document.getElementById('modalLotesItemNome').textContent = lotes[0].item;

    const tbody = document.getElementById('modalLotesTableBody');
    tbody.innerHTML = lotes.map((l, index) => {
      const dataStr = l.data ? formatDate(new Date(l.data)) : 'Lote Inicial';
      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid var(--border-glass);">
            <strong>Lote ${index + 1}</strong> <span style="font-size: 0.72rem; color: var(--primary); font-weight: normal;">(FIFO)</span><br>
            <small style="color: var(--text-muted);">${dataStr}</small>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid var(--border-glass);">${l.quantidade}</td>
          <td style="padding: 10px; border-bottom: 1px solid var(--border-glass);">${formatMoney(l.valor)}</td>
          <td style="padding: 10px; border-bottom: 1px solid var(--border-glass);"><strong>${formatMoney(l.quantidade * l.valor)}</strong></td>
          <td style="padding: 10px; border-bottom: 1px solid var(--border-glass);">
            <div style="display: flex; gap: 8px;">
              <button class="btn-icon-only btnEditLote" data-id="${l.id}" title="Editar Lote">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
              </button>
              <button class="btn-icon-only danger btnDeleteLote" data-id="${l.id}" title="Excluir Lote">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    document.getElementById('modalLotesEstoque').style.display = 'flex';
  } catch (err) {
    showToast('Erro ao abrir detalhamento de lotes: ' + err.message, 'error');
  }
}

// --- FUNÇÕES DO MODAL DE CONCLUSÃO DE PEDIDOS AGENDADOS ---
function setupModalConcluirPedido() {
  const btnFecharModalConcluirPedido = document.getElementById('btnFecharModalConcluirPedido');
  const btnModalAddPedItem = document.getElementById('btnModalAddPedItem');
  const formModalConcluirPedido = document.getElementById('formModalConcluirPedido');

  const fecharModal = () => {
    const modal = document.getElementById('modalConcluirPedido');
    if (modal) modal.style.display = 'none';
  };

  if (btnFecharModalConcluirPedido) btnFecharModalConcluirPedido.addEventListener('click', fecharModal);

  if (btnModalAddPedItem) {
    btnModalAddPedItem.addEventListener('click', () => {
      addModalPedItemRow('', 1, '');
    });
  }

  if (formModalConcluirPedido) {
    formModalConcluirPedido.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const id = document.getElementById('modalPedId').value;
        const nome = document.getElementById('modalPedNome').value.trim() || 'Cliente Avulso';
        const telefone = document.getElementById('modalPedTelefone') ? document.getElementById('modalPedTelefone').value.trim() : '';
        const frete = parseFloat(document.getElementById('modalPedFrete').value) || 0;
        const meioPagamento = document.getElementById('modalPedPagamento').value;

        const itemsToSell = [];
        const itens = [];
        let valor = 0;

        const itemRows = document.querySelectorAll('.modal-ped-row');
        for (const row of itemRows) {
          const select = row.querySelector('.modal-ped-select');
          if (!select || !select.value) {
            showToast('Por favor, selecione todos os itens da venda.', 'error');
            return;
          }
          const selectedOption = select.options[select.selectedIndex];
          const itemNome = select.value;
          const type = selectedOption ? selectedOption.getAttribute('data-type') : '';
          const qtyInput = row.querySelector('.modal-ped-qty');
          const priceInput = row.querySelector('.modal-ped-price');
          const quantidade = parseFloat(qtyInput.value) || 0;
          const preco = parseFloat(priceInput.value) || 0;

          itemsToSell.push({ itemNome, type, quantidade, valor: preco });
          itens.push(`${itemNome} (x${quantidade} - R$ ${preco.toFixed(2)})`);
          valor += quantidade * preco;
        }

        if (itemsToSell.length === 0) {
          showToast('Adicione pelo menos um item para registrar a venda.', 'error');
          return;
        }

        // Realiza o processamento e baixa de estoque para cada item
        for (const item of itemsToSell) {
          const { itemNome, type, quantidade } = item;

          if (type === 'receita') {
            const receitas = await getAllRecords('receitas');
            const receita = receitas.find(r => r.produtoFinal.toLowerCase() === itemNome.toLowerCase());

            const estoqueFinalizado = await getAllRecords('estoque_produtos');
            const prodEstocado = estoqueFinalizado.find(p => p.produto.toLowerCase() === itemNome.toLowerCase());
            const qtdDisponivelProd = prodEstocado ? prodEstocado.quantidade : 0;

            if (qtdDisponivelProd >= quantidade) {
              prodEstocado.quantidade -= quantidade;
              prodEstocado.synced = 0;
              await updateRecord('estoque_produtos', prodEstocado);
            } else {
              const diferenca = quantidade - qtdDisponivelProd;

              if (!receita) {
                const prosseguir = confirm(`Atenção: Estoque insuficiente de "${itemNome}" em estoque (${qtdDisponivelProd} un. disponíveis) e este produto não possui receita cadastrada. Deseja realizar a venda mesmo assim?`);
                if (!prosseguir) return;

                if (prodEstocado) {
                  prodEstocado.quantidade = 0;
                  prodEstocado.synced = 0;
                  await updateRecord('estoque_produtos', prodEstocado);
                }
              } else {
                const estoqueInsumos = await getAllRecords('estoque');
                let insumosInsuficientes = false;
                let insumoFaltante = '';

                for (const mp of receita.materiaPrima) {
                  const totalDisponivel = estoqueInsumos
                    .filter(e => e.item.toLowerCase().trim() === mp.item.toLowerCase().trim())
                    .reduce((sum, e) => sum + e.quantidade, 0);
                  const qtdNecessaria = mp.quantidade * diferenca;

                  if (totalDisponivel < qtdNecessaria) {
                    insumosInsuficientes = true;
                    insumoFaltante = mp.item;
                    break;
                  }
                }

                if (insumosInsuficientes) {
                  const prosseguir = confirm(`Atenção: Estoque insuficiente de produtos e insumos para completar esta venda!\nNão há insumo "${insumoFaltante}" suficiente no estoque para fabricar as ${diferenca} un. restantes.\nDeseja realizar a venda mesmo assim (deixando o estoque de insumos negativo)?`);
                  if (!prosseguir) return;
                }

                if (prodEstocado) {
                  prodEstocado.quantidade = 0;
                  prodEstocado.synced = 0;
                  await updateRecord('estoque_produtos', prodEstocado);
                }

                for (const mp of receita.materiaPrima) {
                  const qtdNecessaria = mp.quantidade * diferenca;
                  await consumirInsumoFIFO(mp.item, qtdNecessaria);
                }
              }
            }
          } else if (type === 'avulso') {
            const estoqueInsumos = await getAllRecords('estoque');
            const totalDisponivel = estoqueInsumos
              .filter(e => e.item.toLowerCase().trim() === itemNome.toLowerCase().trim())
              .reduce((sum, e) => sum + e.quantidade, 0);

            if (totalDisponivel < quantidade) {
              const prosseguir = confirm(`Atenção: Estoque de insumo insuficiente para o item avulso "${itemNome}"!\nDisponível: ${totalDisponivel} un. Solicitado: ${quantidade} un.\nDeseja realizar a venda mesmo assim (deixando o estoque negativo)?`);
              if (!prosseguir) return;
            }

            await consumirInsumoFIFO(itemNome, quantidade);
          }
        }

        const service = await getRecordById('pedidos', Number(id));
        if (service) {
          service.nome = nome;
          service.telefone = telefone;
          service.itens = itens;
          service.valor = valor;
          service.frete = frete;
          service.meioPagamento = meioPagamento;
          service.status = 'Finalizado';
          service.synced = 0;

          // Remove legacy keys
          delete service.item;
          delete service.quantidade;

          await updateRecord('pedidos', service);
          showToast('Venda concluída com sucesso!');
          fecharModal();
          await reloadAllViews();
        }
      } catch (err) {
        showToast('Erro ao concluir venda: ' + err.message, 'error');
      }
    });
  }

  // Evento delegado no modal para preenchimento de preços
  document.addEventListener('change', (e) => {
    if (e.target.classList.contains('modal-ped-select')) {
      const row = e.target.closest('.dynamic-item-row');
      const selectedOption = e.target.options[e.target.selectedIndex];
      const priceInput = row.querySelector('.modal-ped-price');
      const price = selectedOption ? parseFloat(selectedOption.getAttribute('data-preco')) || 0 : 0;
      if (priceInput) {
        priceInput.value = price.toFixed(2);
      }
      recalculaValorModalPedido();
    }
  });

  // Evento delegado no modal para recálculo de valor total
  document.addEventListener('input', (e) => {
    if (e.target.classList.contains('modal-ped-qty') || e.target.classList.contains('modal-ped-price') || e.target.id === 'modalPedFrete') {
      recalculaValorModalPedido();
    }
  });
}

function recalculaValorModalPedido() {
  let total = 0;
  const rows = document.querySelectorAll('.modal-ped-row');
  rows.forEach(row => {
    const qtyInput = row.querySelector('.modal-ped-qty');
    const priceInput = row.querySelector('.modal-ped-price');
    if (qtyInput && priceInput) {
      const qty = parseFloat(qtyInput.value) || 0;
      const price = parseFloat(priceInput.value) || 0;
      total += qty * price;
    }
  });

  const freteInput = document.getElementById('modalPedFrete');
  const frete = freteInput ? parseFloat(freteInput.value) || 0 : 0;

  const totalText = document.getElementById('modalPedTotalText');
  if (totalText) {
    totalText.innerHTML = formatMoney(total + frete);
  }
}

async function addModalPedItemRow(name = '', qty = 1, price = '') {
  const container = document.getElementById('modalPedItensContainer');
  if (!container) return;

  const salesOptions = await updateSalesSelectors();

  const row = document.createElement('div');
  row.className = 'dynamic-item-row modal-ped-row';
  row.style.flexWrap = 'wrap';
  row.style.marginBottom = '8px';

  row.innerHTML = `
    <div style="display: flex; gap: 8px; width: 100%; align-items: center;">
      <select class="form-control modal-ped-select" style="flex: 1;" required>
        ${salesOptions}
      </select>
      <input type="number" class="form-control modal-ped-qty" placeholder="Qtd" min="1" value="${qty}" style="width: 65px;" required>
      <input type="number" class="form-control modal-ped-price" placeholder="Preço" step="0.01" min="0" value="${price}" style="width: 85px;" required>
      <button type="button" class="btn-icon-only danger btnRemoveModalRow">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
  `;
  container.appendChild(row);

  const select = row.querySelector('.modal-ped-select');
  if (name) {
    select.value = name;
  }

  recalculaValorModalPedido();
}

// --- FUNÇÕES DO MODAL DE DETALHES DO PEDIDO ---
function setupModalDetalhesPedido() {
  const fecharModal = () => {
    const modal = document.getElementById('modalDetalhesPedido');
    if (modal) modal.style.display = 'none';
  };

  const btnFecharModalDetalhesPedido = document.getElementById('btnFecharModalDetalhesPedido');
  if (btnFecharModalDetalhesPedido) btnFecharModalDetalhesPedido.addEventListener('click', fecharModal);

  // Delegação global para abrir os detalhes de um pedido ao clicar na linha
  document.addEventListener('click', (e) => {
    const row = e.target.closest('.pedido-row');
    if (row && !e.target.closest('.btnDelete')) {
      const id = row.getAttribute('data-id');
      exibirDetalhesPedido(id);
    }
  });
}

async function exibirDetalhesPedido(id) {
  try {
    const p = await getRecordById('pedidos', Number(id));
    if (!p) return;

    document.getElementById('detalhePedCliente').textContent = p.nome || 'Cliente Avulso';
    document.getElementById('detalhePedTelefone').textContent = p.telefone || 'Não informado';
    document.getElementById('detalhePedData').textContent = formatDate(new Date(p.data));
    document.getElementById('detalhePedPagamento').textContent = p.meioPagamento || 'Pix';

    const listContainer = document.getElementById('detalhePedItensList');
    listContainer.innerHTML = '';

    let subtotal = 0;
    const regex = /^(.*?)\s*\(x(\d+)(?:\s*-\s*R\$\s*([\d.]+))?\)$/i;

    const adList = p.itens ? (Array.isArray(p.itens) ? p.itens : [p.itens]) : [`${p.item} (x${p.quantidade} - R$ ${p.valor.toFixed(2)})`];

    adList.forEach(itemStr => {
      const match = itemStr.match(regex);
      if (match) {
        const nome = match[1];
        const qty = parseInt(match[2], 10) || 1;
        const precoUnitario = match[3] ? parseFloat(match[3]) || 0 : 0;
        const totalItem = qty * precoUnitario;
        subtotal += totalItem;

        listContainer.innerHTML += `
          <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
            <span><strong>${escapeHTML(nome)}</strong> (x${qty}) <span style="color: var(--text-muted); font-size: 0.8rem; margin-left: 4px;">a ${formatMoney(precoUnitario)} cada</span></span>
            <span style="color: var(--text-main); font-weight: 500;">${formatMoney(totalItem)}</span>
          </div>
        `;
      } else {
        listContainer.innerHTML += `
          <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
            <span><strong>${escapeHTML(itemStr)}</strong></span>
            <span style="color: var(--text-muted); font-style: italic;">R$ 0,00</span>
          </div>
        `;
      }
    });

    document.getElementById('detalhePedSubtotal').textContent = formatMoney(subtotal || p.valor);
    document.getElementById('detalhePedFrete').textContent = formatMoney(p.frete || 0);
    document.getElementById('detalhePedTotal').textContent = formatMoney((subtotal || p.valor) + (p.frete || 0));

    document.getElementById('modalDetalhesPedido').style.display = 'flex';
  } catch (err) {
    showToast('Erro ao abrir detalhes: ' + err.message, 'error');
  }
}

