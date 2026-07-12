/**
 * app.js - Lógica Principal da Aplicação (PWA Pinheiro Afiações)
 */

import {
  initDB,
  addRecord,
  getAllRecords,
  getRecordById,
  updateRecord,
  deleteRecord,
  getConfig,
  setConfig,
  getUnsyncedRecords,
  markAsSynced
} from './db.js';

// --- ESTADO GLOBAL DA APLICAÇÃO ---
let activeTab = 'dashboard';
let googleSheetsUrl = '';
let discountConfig = { qtd1: 5, pct1: 5, qtd2: 10, pct2: 10 };

// --- EVENTOS INICIAIS ---
window.addEventListener('DOMContentLoaded', async () => {
  try {
    // Inicializa Banco de Dados
    await initDB();
    console.log('Banco de dados inicializado com sucesso no app.js');

    // Carrega Configurações
    googleSheetsUrl = await getConfig('googleSheetsUrl') || '';
    const urlInput = document.getElementById('googleSheetsUrlInput');
    if (urlInput && googleSheetsUrl) {
      urlInput.value = googleSheetsUrl;
    }

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
    setupDynamicRows();
    setupFormSubmissions();
    setupConnectionMonitoring();
    setupMaintenanceEvents();
    setupPricingEvents();

    // Renderiza dados iniciais
    await reloadAllViews();
    await updateAllSelectors();

    // Inicia Sincronização Automática (se configurado e online)
    autoSyncEngine();
  } catch (err) {
    showToast('Erro ao iniciar a aplicação: ' + err.message, 'error');
  }
});

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
      // Tenta sincronizar ao voltar a ficar online
      await syncAllStores();
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
          <button type="button" class="btn-icon-only danger btnRemoveRow">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
        <input type="text" class="form-control item-name-custom" placeholder="Nome da peça personalizada" style="display: none; margin-top: 8px; width: 100%;" />
      `;
      containerServItens.appendChild(row);
      updateRemoveButtons(containerServItens);
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
          <button type="button" class="btn-icon-only danger btnRemoveRow">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
        <input type="text" class="form-control adicional-name-custom" placeholder="Nome do adicional personalizado" style="display: none; margin-top: 8px; width: 100%;" />
      `;
      containerServAdicionais.appendChild(row);
      updateRemoveButtons(containerServAdicionais);
      updateAllSelectors();
    });
  }

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

  // Lógica geral de remoção
  document.addEventListener('click', (e) => {
    if (e.target.closest('.btnRemoveRow')) {
      const btn = e.target.closest('.btnRemoveRow');
      const row = btn.closest('.dynamic-item-row');
      if (row) {
        const container = row.parentNode;
        row.remove();
        updateRemoveButtons(container);
        recalculaCustoReceita();
        recalculaValorServico();
      }
    }
  });

  // Delegação para controlar visibilidade de inputs personalizados de peças/adicionais nos serviços
  document.addEventListener('change', (e) => {
    if (e.target.classList.contains('item-select')) {
      const row = e.target.closest('.dynamic-item-row');
      const customInput = row.querySelector('.item-name-custom');
      if (e.target.value === 'custom') {
        customInput.style.display = 'block';
        customInput.setAttribute('required', 'required');
      } else {
        customInput.style.display = 'none';
        customInput.removeAttribute('required');
      }
      recalculaValorServico();
    }
    
    if (e.target.classList.contains('adicional-select')) {
      const row = e.target.closest('.dynamic-item-row');
      const customInput = row.querySelector('.adicional-name-custom');
      if (e.target.value === 'custom') {
        customInput.style.display = 'block';
        customInput.setAttribute('required', 'required');
      } else {
        customInput.style.display = 'none';
        customInput.removeAttribute('required');
      }
      recalculaValorServico();
    }
  });

  // Delegação para recalcular valores em tempo real se mudarem quantidades
  document.addEventListener('input', (e) => {
    if (e.target.classList.contains('item-qty') || e.target.classList.contains('adicional-qty')) {
      recalculaValorServico();
    }
  });
}

function updateRemoveButtons(container) {
  const rows = container.querySelectorAll('.dynamic-item-row');
  const isAdicionais = container.id === 'servAdicionaisContainer';
  rows.forEach((row, index) => {
    const btn = row.querySelector('.btnRemoveRow');
    if (btn) {
      btn.style.display = (rows.length === 1 && !isAdicionais) ? 'none' : 'inline-flex';
    }
  });
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
        const nome = document.getElementById('servNome').value;
        const valor = parseFloat(document.getElementById('servValor').value) || 0;
        const frete = parseFloat(document.getElementById('servFrete').value) || 0;
        const meioPagamento = document.getElementById('servPagamento').value;
        
        // Coleta itens dinâmicos
        const itens = [];
        const rows = document.querySelectorAll('#servItensContainer .dynamic-item-row');
        rows.forEach(row => {
          const select = row.querySelector('.item-select');
          const qtyText = row.querySelector('.item-qty').value;
          let itemText = '';
          if (select) {
            if (select.value === 'custom') {
              itemText = row.querySelector('.item-name-custom').value.trim();
            } else {
              itemText = select.value;
            }
          }
          if (itemText) {
            itens.push(`${itemText} (x${qtyText})`);
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
            adicionaisArr.push(`${adicionalText} (x${qtyText})`);
          }
        }

        if (itens.length === 0 && adicionaisArr.length === 0) {
          showToast('Adicione pelo menos uma peça ou um serviço adicional.', 'error');
          return;
        }

        if (estoqueInsuficiente) {
          const prosseguir = confirm(`Atenção: Não há estoque suficiente do insumo "${insumoFaltante}" atrelado aos adicionais selecionados.\nDeseja registrar o serviço mesmo assim (deixando o estoque do insumo negativo)?`);
          if (!prosseguir) return;
        }

        // Executa dedução dos insumos
        for (const ded of deducoesEstoque) {
          await consumirInsumoFIFO(ded.insumoNome, ded.quantidade);
        }

        const adicionais = adicionaisArr.join(', ');

        const novoServico = {
          nome,
          itens,
          adicionais,
          valor,
          frete,
          meioPagamento,
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
              <select class="form-control item-select" style="flex: 1;">
                <option value="">Selecione a peça...</option>
                <option value="custom">Outro (Digitar)...</option>
              </select>
              <input type="number" class="form-control item-qty" placeholder="Qtd" min="1" value="1" style="width: 70px;">
              <button type="button" class="btn-icon-only danger btnRemoveRow" style="display:none;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
            <input type="text" class="form-control item-name-custom" placeholder="Nome da peça personalizada" style="display: none; margin-top: 8px; width: 100%;" />
          </div>
        `;
        
        await updateAllSelectors();
        await reloadAllViews();
        syncAllStores();
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
          // Verifica se já existe um lote com o mesmo nome e mesmo preço unitário
          const loteMesmoPreco = estoqueItens.find(x => x.item.toLowerCase().trim() === item.toLowerCase().trim() && x.valor === valor);
          if (loteMesmoPreco) {
            const confirmar = confirm(`O item "${item}" já possui um lote cadastrado com este mesmo valor unitário (${formatMoney(valor)}). Deseja somar a quantidade (${quantidade}) a este lote?`);
            if (confirmar) {
              loteMesmoPreco.quantidade += quantidade;
              loteMesmoPreco.synced = 0;
              await updateRecord('estoque', loteMesmoPreco);
              showToast('Quantidade somada ao lote existente!');
            } else {
              return;
            }
          } else {
            // Novo lote
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
        }

        // Restaura formulário
        formEstoque.reset();
        document.getElementById('estoqueId').value = '';
        document.getElementById('estoqueFormTitle').textContent = 'Nova Entrada';
        document.getElementById('btnEstoqueSubmit').textContent = 'Adicionar ao Estoque';
        document.getElementById('btnEstoqueCancel').style.display = 'none';
        
        await reloadAllViews();
        syncAllStores();
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
  const pedManualCheck = document.getElementById('pedManualItemCheck');
  const pedItemSelect = document.getElementById('pedItem');
  const pedItemManual = document.getElementById('pedItemManual');

  if (pedManualCheck) {
    pedManualCheck.addEventListener('change', () => {
      if (pedManualCheck.checked) {
        pedItemSelect.style.display = 'none';
        pedItemSelect.removeAttribute('required');
        pedItemManual.style.display = 'block';
        pedItemManual.setAttribute('required', 'required');
      } else {
        pedItemSelect.style.display = 'block';
        pedItemSelect.setAttribute('required', 'required');
        pedItemManual.style.display = 'none';
        pedItemManual.removeAttribute('required');
      }
    });
  }

  if (pedItemSelect) {
    pedItemSelect.addEventListener('change', async () => {
      const selectedProduct = pedItemSelect.value;
      if (!selectedProduct) return;

      // Busca no estoque de produtos finalizados para preencher o preço de venda salvo
      const estoqueProdutos = await getAllRecords('estoque_produtos');
      const prodEstocado = estoqueProdutos.find(p => p.produto.toLowerCase() === selectedProduct.toLowerCase());
      if (prodEstocado && prodEstocado.precoVenda !== undefined) {
        const pedValorInput = document.getElementById('pedValor');
        if (pedValorInput) {
          pedValorInput.value = prodEstocado.precoVenda.toFixed(2);
        }
      }
    });
  }

  if (formPedido) {
    formPedido.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        let itemNome = '';
        if (pedManualCheck.checked) {
          itemNome = pedItemManual.value.trim();
        } else {
          itemNome = pedItemSelect.value;
        }

        const quantidade = parseFloat(document.getElementById('pedQtd').value) || 0;
        const valor = parseFloat(document.getElementById('pedValor').value) || 0;
        const frete = parseFloat(document.getElementById('pedFrete').value) || 0;
        const meioPagamento = document.getElementById('pedPagamento').value;

        if (!itemNome) {
          showToast('Por favor, selecione ou digite o nome do produto vendido.', 'error');
          return;
        }

        // --- SISTEMA INTELIGENTE DE BAIXA DE ESTOQUE ---
        if (!pedManualCheck.checked) {
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
            showToast(`Venda registrada! ${quantidade} un. deduzidas do estoque de produtos finalizados.`);
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

              showToast(`Venda registrada! ${qtdDisponivelProd} un. retiradas do estoque e ${diferenca} un. fabricadas consumindo insumos.`);
            }
          }
        }

        const novoPedido = {
          item: itemNome,
          quantidade,
          valor,
          frete,
          meioPagamento,
          data: new Date().toISOString(),
          synced: 0
        };

        await addRecord('pedidos', novoPedido);
        showToast('Venda registrada com sucesso!');
        formPedido.reset();
        
        // Restaura campos do formulário
        if (pedManualCheck.checked) {
          pedManualCheck.checked = false;
          pedItemSelect.style.display = 'block';
          pedItemSelect.setAttribute('required', 'required');
          pedItemManual.style.display = 'none';
          pedItemManual.removeAttribute('required');
        }

        await reloadAllViews();
        syncAllStores();
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

        const precoVenda = parseFloat(document.getElementById('prodPrecoVenda').value) || 0;

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
        syncAllStores();
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
          synced: 0
        };

        await addRecord('receitas', novaReceita);
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
        syncAllStores();
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

  // Cálculos de Faturamento
  const totalServicos = servicos.reduce((acc, curr) => acc + (curr.valor || 0), 0);
  const totalPedidos = pedidos.reduce((acc, curr) => acc + ((curr.quantidade * curr.valor) + (curr.frete || 0)), 0);
  
  // Contadores de Estoque
  const totalItensEstoque = estoque.length;

  // Status de Sincronização ou Total Pendente
  const unsyncedBadge = document.getElementById('dashTotalUnsynced');
  const usingFirebase = typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0;

  if (usingFirebase) {
    if (navigator.onLine) {
      unsyncedBadge.textContent = 'Nuvem Sincronizada';
      unsyncedBadge.style.color = 'var(--success)';
    } else {
      unsyncedBadge.textContent = 'Offline (Salvo local)';
      unsyncedBadge.style.color = 'var(--warning)';
    }
  } else {
    let unsyncedCount = 0;
    unsyncedCount += (await getUnsyncedRecords('servicos')).length;
    unsyncedCount += (await getUnsyncedRecords('estoque')).length;
    unsyncedCount += (await getUnsyncedRecords('pedidos')).length;
    unsyncedCount += (await getUnsyncedRecords('receitas')).length;

    unsyncedBadge.textContent = `${unsyncedCount} registro${unsyncedCount !== 1 ? 's' : ''}`;
    if (unsyncedCount > 0) {
      unsyncedBadge.style.color = 'var(--warning)';
    } else {
      unsyncedBadge.style.color = 'var(--success)';
    }
  }

  // Atualiza no DOM do Dashboard
  document.getElementById('dashTotalServicos').textContent = formatMoney(totalServicos);
  document.getElementById('dashTotalPedidos').textContent = formatMoney(totalPedidos);
  document.getElementById('dashTotalEstoque').textContent = `${totalItensEstoque} insumo${totalItensEstoque !== 1 ? 's' : ''}`;

  // Atividades Recentes (combina as últimas 5 transações de vendas e serviços ordenadas por data)
  const recentesTable = document.getElementById('tableRecentes').querySelector('tbody');
  
  const atividades = [];
  servicos.forEach(s => {
    atividades.push({
      tipo: 'Serviço',
      desc: `Serviço prestado a: ${s.nome}`,
      data: new Date(s.data),
      valor: s.valor,
      synced: s.synced
    });
  });
  pedidos.forEach(p => {
    atividades.push({
      tipo: 'Pedido (Venda)',
      desc: `Venda de ${p.quantidade}x ${p.item}`,
      data: new Date(p.data),
      valor: (p.quantidade * p.valor) + (p.frete || 0),
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
        <td>
          <span class="tag ${a.synced === 1 ? 'synced' : 'unsynced'}">
            ${a.synced === 1 ? 'Sincronizado' : 'Aguardando'}
          </span>
        </td>
      </tr>
    `).join('');
  }
}

// 1. ABA DE SERVIÇOS
async function renderServicosView() {
  const servicos = await getAllRecords('servicos');
  const tbody = document.getElementById('tableServicos').querySelector('tbody');

  if (servicos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted);">Nenhum serviço registrado localmente.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = servicos.map(s => {
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
      <tr>
        <td><strong>${escapeHTML(s.nome)}</strong><br><small style="color:var(--text-muted);">${formatDate(new Date(s.data))}</small></td>
        <td>${contentHtml}</td>
        <td>
          Subtotal: ${formatMoney(s.valor)}
          ${s.frete > 0 ? `<br><small style="color:var(--text-muted);">Frete: ${formatMoney(s.frete)}</small>` : ''}
          <br><strong>Total: ${formatMoney(s.valor + (s.frete || 0))}</strong>
        </td>
        <td>${s.meioPagamento}</td>
        <td>
          <span class="tag ${s.synced === 1 ? 'synced' : 'unsynced'}">
            ${s.synced === 1 ? 'Sincronizado' : 'Aguardando'}
          </span>
        </td>
        <td>
          <button class="btn-icon-only danger btnDelete" data-store="servicos" data-id="${s.id}" title="Excluir Registro">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  setupTableActions();
}

// 2. ABA DE ESTOQUE
async function renderEstoqueView() {
  const estoqueOriginal = await getAllRecords('estoque');
  const estoque = estoqueOriginal.filter(e => e.quantidade !== 0);
  const tbody = document.getElementById('tableEstoque').querySelector('tbody');

  if (estoque.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted);">Nenhum insumo cadastrado com estoque disponível.</td>
      </tr>
    `;
  } else {
    tbody.innerHTML = estoque.map(e => `
      <tr>
        <td>
          <strong>${escapeHTML(e.item)}</strong><br>
          <small style="color: var(--text-muted); font-size: 0.75rem;">${e.data ? formatDate(new Date(e.data)) : 'Lote Inicial'}</small>
        </td>
        <td style="color:${e.quantidade <= 2 ? 'var(--error)' : 'var(--text-main)'}; font-weight:${e.quantidade <= 2 ? 'bold' : 'normal'};">
          ${e.quantidade}
          ${e.quantidade <= 2 ? '<br><small style="color:var(--error); font-weight:normal;">Estoque Baixo!</small>' : ''}
        </td>
        <td>${formatMoney(e.valor)}</td>
        <td><strong>${formatMoney(e.quantidade * e.valor)}</strong></td>
        <td>
          <span class="tag ${e.synced === 1 ? 'synced' : 'unsynced'}">
            ${e.synced === 1 ? 'Sincronizado' : 'Aguardando'}
          </span>
        </td>
        <td>
          <button class="btn-icon-only btnEdit" data-id="${e.id}" title="Editar Item">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>
          </button>
          <button class="btn-icon-only danger btnDelete" data-store="estoque" data-id="${e.id}" title="Excluir Item">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </td>
      </tr>
    `).join('');
  }

  setupTableActions();
  setupEstoqueSelectOption();
  await renderEstoqueProdutosView();
}

// 3. ABA DE PEDIDOS (VENDAS)
async function renderPedidosView() {
  const pedidos = await getAllRecords('pedidos');
  const tbody = document.getElementById('tablePedidos').querySelector('tbody');

  // Atualiza seletor de produtos baseando nas receitas cadastradas
  const receitas = await getAllRecords('receitas');
  const selectPedItem = document.getElementById('pedItem');
  if (selectPedItem) {
    const currentValue = selectPedItem.value;
    let options = '<option value="">Selecione um produto/receita...</option>';
    receitas.forEach(r => {
      options += `<option value="${escapeHTML(r.produtoFinal)}">${escapeHTML(r.produtoFinal)}</option>`;
    });
    selectPedItem.innerHTML = options;
    selectPedItem.value = currentValue;
  }

  if (pedidos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted);">Nenhum pedido de venda registrado.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = pedidos.map(p => `
    <tr>
      <td><strong>${escapeHTML(p.item)}</strong><br><small style="color:var(--text-muted);">${formatDate(new Date(p.data))}</small></td>
      <td>${p.quantidade}x</td>
      <td>${formatMoney(p.valor)}</td>
      <td>${p.frete > 0 ? formatMoney(p.frete) : 'Grátis'}</td>
      <td><strong>${formatMoney((p.quantidade * p.valor) + (p.frete || 0))}</strong></td>
      <td>
        <span class="tag ${p.synced === 1 ? 'synced' : 'unsynced'}">
          ${p.synced === 1 ? 'Sincronizado' : 'Aguardando'}
        </span>
      </td>
      <td>
        <button class="btn-icon-only danger btnDelete" data-store="pedidos" data-id="${p.id}" title="Excluir Venda">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </td>
    </tr>
  `).join('');

  setupTableActions();
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
        <td>
          <span class="tag ${r.synced === 1 ? 'synced' : 'unsynced'}">
            ${r.synced === 1 ? 'Sincronizado' : 'Aguardando'}
          </span>
        </td>
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

  const confirmar = confirm('Tem certeza que deseja excluir este registro local? Esta ação não afetará os dados já gravados nas planilhas do Google.');
  if (confirmar) {
    try {
      await deleteRecord(store, id);
      showToast('Registro excluído do banco de dados local.');
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

// --- MECANISMO DE SINCRONIZAÇÃO GOOGLE SHEETS ---
async function syncAllStores() {
  const usingFirebase = typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0;
  if (usingFirebase) {
    console.log('Firebase ativo: sincronização em nuvem automática e em tempo real habilitada.');
    return;
  }

  if (!navigator.onLine) {
    console.log('Sync abortado: Dispositivo offline.');
    return;
  }

  if (!googleSheetsUrl) {
    console.log('Sync abortado: URL do Google Sheets não configurada.');
    return;
  }

  const stores = ['servicos', 'estoque', 'pedidos', 'receitas'];
  let totalSynced = 0;

  for (const store of stores) {
    try {
      const records = await getUnsyncedRecords(store);
      if (records.length === 0) continue;

      console.log(`Sincronizando ${records.length} registros da store "${store}"...`);

      // Envia os dados para a API do Apps Script
      // Usamos POST com o payload JSON apropriado
      const response = await fetch(googleSheetsUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8', // Evita gatilhos de preflight complexos
        },
        body: JSON.stringify({
          store: store,
          records: records
        })
      });

      const result = await response.json();
      
      if (result.status === 'success' && Array.isArray(result.syncedIds)) {
        // Marca cada ID como sincronizado no IndexedDB
        for (const id of result.syncedIds) {
          await markAsSynced(store, id);
        }
        totalSynced += result.syncedIds.length;
        console.log(`Store "${store}" sincronizada. ${result.syncedIds.length} itens marcados no IndexedDB.`);
      } else {
        console.error(`Erro na sincronização da store "${store}":`, result.message || 'Resposta inesperada');
      }
    } catch (err) {
      console.error(`Erro de conexão ao sincronizar store "${store}":`, err);
    }
  }

  if (totalSynced > 0) {
    showToast(`${totalSynced} registros sincronizados com o Google Sheets!`);
    await reloadAllViews();
  }
}

// Engine de Sincronização Automática periódico (A cada 30 segundos se estiver online)
function autoSyncEngine() {
  setInterval(() => {
    if (navigator.onLine && googleSheetsUrl) {
      syncAllStores();
    }
  }, 30000);
}

// Configuração da aba Ajustes
function setupMaintenanceEvents() {
  // Salvar URL do Sheets
  const btnSave = document.getElementById('btnSaveConfig');
  const urlInput = document.getElementById('googleSheetsUrlInput');
  const btnTest = document.getElementById('btnTestConnection');
  const btnManual = document.getElementById('btnManualSync');

  if (btnSave && urlInput) {
    btnSave.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      if (url && !url.startsWith('https://script.google.com')) {
        showToast('URL inválida. Deve começar com https://script.google.com', 'error');
        return;
      }
      try {
        await setConfig('googleSheetsUrl', url);
        googleSheetsUrl = url;
        showToast('URL do Google Sheets configurada com sucesso!');
        syncAllStores(); // Roda um sync após salvar
      } catch (err) {
        showToast('Erro ao salvar configuração: ' + err.message, 'error');
      }
    });
  }

  if (btnTest && urlInput) {
    btnTest.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      if (!url) {
        showToast('Por favor, insira a URL primeiro.', 'error');
        return;
      }

      showToast('Testando conexão...', 'info');

      try {
        // Envia uma chamada GET simples para testar
        const res = await fetch(url, { method: 'GET', mode: 'cors' });
        const text = await res.text();
        if (text.includes('sincronização') || res.ok) {
          showToast('Conexão bem sucedida com o Google Apps Script!', 'success');
        } else {
          showToast('Resposta inesperada do servidor do script.', 'warning');
        }
      } catch (err) {
        showToast('Falha na conexão: Verifique a URL e as permissões de CORS do Apps Script. Erro: ' + err.message, 'error');
      }
    });
  }

  if (btnManual) {
    btnManual.addEventListener('click', () => {
      if (!googleSheetsUrl) {
        showToast('Configure a URL do Google Sheets na aba Configurações primeiro.', 'error');
        return;
      }
      showToast('Sincronização forçada iniciada...', 'info');
      syncAllStores();
    });
  }

  // Backup e Manutenção
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
            { chave: 'googleSheetsUrl', valor: googleSheetsUrl },
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
                if (cfg.chave === 'googleSheetsUrl') {
                  googleSheetsUrl = cfg.valor;
                  document.getElementById('googleSheetsUrlInput').value = googleSheetsUrl;
                } else if (cfg.chave === 'discount_qtd1') {
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
      const confirmar = confirm('ATENÇÃO: Isso excluirá TODOS os dados salvos localmente no navegador! Isso NÃO apagará os dados na planilha Google. Deseja realmente excluir tudo?');
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

async function updateAllSelectors() {
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
    if (select && qtyInput) {
      const selectedOption = select.options[select.selectedIndex];
      const precoUnitario = selectedOption && select.value !== 'custom' ? (parseFloat(selectedOption.getAttribute('data-preco')) || 0) : 0;
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
    if (select && qtyInput) {
      const selectedOption = select.options[select.selectedIndex];
      const precoUnitario = selectedOption && select.value !== 'custom' ? (parseFloat(selectedOption.getAttribute('data-preco')) || 0) : 0;
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

