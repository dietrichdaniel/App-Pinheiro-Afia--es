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

    // Inicializa Eventos da Interface
    setupNavigation();
    setupDynamicRows();
    setupFormSubmissions();
    setupConnectionMonitoring();
    setupMaintenanceEvents();

    // Renderiza dados iniciais
    await reloadAllViews();

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

  function updateStatus() {
    if (navigator.onLine) {
      dot.className = 'status-dot online';
      text.textContent = 'Conectado (Online)';
      // Tenta sincronizar ao voltar a ficar online
      syncAllStores();
    } else {
      dot.className = 'status-dot offline';
      text.textContent = 'Modo Offline';
      showToast('Você está offline. As alterações serão salvas localmente.', 'warning');
    }
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
      row.innerHTML = `
        <input type="text" class="form-control item-name" placeholder="Ex: Serras de Fita" required>
        <input type="number" class="form-control item-qty" placeholder="Qtd" min="1" value="1" style="width: 70px;" required>
        <button type="button" class="btn-icon-only danger btnRemoveRow">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      `;
      containerServItens.appendChild(row);
      updateRemoveButtons(containerServItens);
    });
  }

  // Matérias-Primas da Receita
  const btnAddMateriaPrima = document.getElementById('btnAddMateriaPrima');
  const containerMateriaPrima = document.getElementById('recMateriaPrimaContainer');

  if (btnAddMateriaPrima && containerMateriaPrima) {
    btnAddMateriaPrima.addEventListener('click', async () => {
      const estoqueItens = await getAllRecords('estoque');
      let options = '<option value="">Selecione insumo...</option>';
      estoqueItens.forEach(item => {
        options += `<option value="${escapeHTML(item.item)}" data-valor="${item.valor}">${escapeHTML(item.item)} (Disp: ${item.quantidade})</option>`;
      });

      const row = document.createElement('div');
      row.className = 'dynamic-item-row mp-row';
      row.innerHTML = `
        <select class="form-control mp-select" required>
          ${options}
        </select>
        <input type="number" class="form-control mp-qty" placeholder="Qtd" min="0.001" step="0.001" style="width: 80px;" required>
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
      const row = btn.parentNode;
      const container = row.parentNode;
      row.remove();
      updateRemoveButtons(container);
      recalculaCustoReceita();
    }
  });
}

function updateRemoveButtons(container) {
  const rows = container.querySelectorAll('.dynamic-item-row');
  rows.forEach((row, index) => {
    const btn = row.querySelector('.btnRemoveRow');
    if (btn) {
      // Oculta botão de remover se houver apenas 1 linha
      btn.style.display = rows.length === 1 ? 'none' : 'inline-flex';
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
      const qty = parseFloat(qtyInput.value) || 0;
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
        const adicionais = document.getElementById('servAdicionais').value;
        const valor = parseFloat(document.getElementById('servValor').value) || 0;
        const frete = parseFloat(document.getElementById('servFrete').value) || 0;
        const meioPagamento = document.getElementById('servPagamento').value;
        
        // Coleta itens dinâmicos
        const itens = [];
        const rows = document.querySelectorAll('#servItensContainer .dynamic-item-row');
        rows.forEach(row => {
          const itemText = row.querySelector('.item-name').value;
          const qtyText = row.querySelector('.item-qty').value;
          itens.push(`${itemText} (x${qtyText})`);
        });

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
        
        // Mantém apenas uma linha em branco nos itens
        const container = document.getElementById('servItensContainer');
        container.innerHTML = `
          <div class="dynamic-item-row">
            <input type="text" class="form-control item-name" placeholder="Ex: Serras de Fita" required>
            <input type="number" class="form-control item-qty" placeholder="Qtd" min="1" value="1" style="width: 70px;" required>
            <button type="button" class="btn-icon-only danger btnRemoveRow" style="display:none;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        `;
        
        await reloadAllViews();
        syncAllStores(); // Tenta sincronizar
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
          // Verifica se já existe um item com o mesmo nome para evitar duplicidade
          const duplicado = estoqueItens.find(x => x.item.toLowerCase() === item.toLowerCase());
          if (duplicado) {
            // Pergunta se deseja somar ao estoque ou atualiza direto somando
            const confirmar = confirm(`O item "${item}" já está cadastrado. Deseja somar a quantidade (${quantidade}) e atualizar o preço médio?`);
            if (confirmar) {
              const novaQtd = duplicado.quantidade + quantidade;
              // Preço médio ponderado
              const novoPreco = ((duplicado.quantidade * duplicado.valor) + (quantidade * valor)) / novaQtd;
              
              duplicado.quantidade = novaQtd;
              duplicado.valor = parseFloat(novoPreco.toFixed(2));
              duplicado.synced = 0;
              await updateRecord('estoque', duplicado);
              showToast('Quantidade somada e preço médio atualizado!');
            } else {
              return;
            }
          } else {
            // Novo cadastro
            const novoItem = {
              item,
              quantidade,
              valor,
              synced: 0
            };
            await addRecord('estoque', novoItem);
            showToast('Item adicionado ao estoque local!');
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

      // Se for uma receita, tenta preencher o valor sugerido
      const receitas = await getAllRecords('receitas');
      const receita = receitas.find(r => r.produtoFinal === selectedProduct);
      if (receita) {
        // Tenta buscar o preço estimado de fabricação ou sugere um lucro padrão de 50%
        // Aqui deixamos para o usuário decidir, mas podemos puxar se cadastrado
        // Como o formulário de Pedidos pede o Valor Unitário de Venda, se o usuário tiver histórico, sugerimos, caso contrário fica em branco
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
        const deduzirEstoque = document.getElementById('pedConsumeStock').checked;

        if (!itemNome) {
          showToast('Por favor, selecione ou digite o nome do produto vendido.', 'error');
          return;
        }

        // Regra de Negócio: Deduzir Matérias-Primas se ativo
        if (deduzirEstoque && !pedManualCheck.checked) {
          const receitas = await getAllRecords('receitas');
          const receita = receitas.find(r => r.produtoFinal.toLowerCase() === itemNome.toLowerCase());
          
          if (receita && Array.isArray(receita.materiaPrima)) {
            const estoque = await getAllRecords('estoque');
            const atualizacoesEstoque = [];
            let estoqueInsuficiente = false;
            let insumoFaltante = '';

            // Verifica se há estoque para todos os insumos antes de decrementar
            for (const mp of receita.materiaPrima) {
              const insumoEstoque = estoque.find(e => e.item.toLowerCase() === mp.item.toLowerCase());
              const qtdNecessaria = mp.quantidade * quantidade;

              if (!insumoEstoque || insumoEstoque.quantidade < qtdNecessaria) {
                estoqueInsuficiente = true;
                insumoFaltante = mp.item;
                break;
              }

              // Salva a cópia atualizada do estoque
              atualizacoesEstoque.push({
                record: insumoEstoque,
                novaQtd: insumoEstoque.quantidade - qtdNecessaria
              });
            }

            if (estoqueInsuficiente) {
              const prosseguir = confirm(`Atenção: Não há estoque suficiente do insumo "${insumoFaltante}" para completar a produção desta venda. Deseja realizar a venda mesmo assim sem deduzir do estoque?`);
              if (!prosseguir) return;
            } else {
              // Executa a dedução do estoque
              for (const update of atualizacoesEstoque) {
                update.record.quantidade = update.novaQtd;
                update.record.synced = 0; // Remarca como pendente de sincronização
                await updateRecord('estoque', update.record);
              }
              showToast('Insumos da receita deduzidos do estoque com sucesso!');
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
          const qty = parseFloat(row.querySelector('.mp-qty').value) || 0;
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
            <input type="number" class="form-control mp-qty" placeholder="Qtd" min="0.001" step="0.001" style="width: 80px;" required>
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

  // Renderiza Views de abas baseadas no estado ativo
  if (activeTab === 'servicos') {
    await renderServicosView();
  } else if (activeTab === 'estoque') {
    await renderEstoqueView();
  } else if (activeTab === 'pedidos') {
    await renderPedidosView();
  } else if (activeTab === 'receitas') {
    await renderReceitasView();
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

  // Total Pendente de Sincronização
  let unsyncedCount = 0;
  unsyncedCount += (await getUnsyncedRecords('servicos')).length;
  unsyncedCount += (await getUnsyncedRecords('estoque')).length;
  unsyncedCount += (await getUnsyncedRecords('pedidos')).length;
  unsyncedCount += (await getUnsyncedRecords('receitas')).length;

  // Atualiza no DOM do Dashboard
  document.getElementById('dashTotalServicos').textContent = formatMoney(totalServicos);
  document.getElementById('dashTotalPedidos').textContent = formatMoney(totalPedidos);
  document.getElementById('dashTotalEstoque').textContent = `${totalItensEstoque} insumo${totalItensEstoque !== 1 ? 's' : ''}`;
  
  const unsyncedBadge = document.getElementById('dashTotalUnsynced');
  unsyncedBadge.textContent = `${unsyncedCount} registro${unsyncedCount !== 1 ? 's' : ''}`;
  if (unsyncedCount > 0) {
    unsyncedBadge.style.color = 'var(--warning)';
  } else {
    unsyncedBadge.style.color = 'var(--success)';
  }

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
    return `
      <tr>
        <td><strong>${escapeHTML(s.nome)}</strong><br><small style="color:var(--text-muted);">${formatDate(new Date(s.data))}</small></td>
        <td>${escapeHTML(itensStr)}</td>
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
  const estoque = await getAllRecords('estoque');
  const tbody = document.getElementById('tableEstoque').querySelector('tbody');

  if (estoque.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted);">Nenhum insumo cadastrado.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = estoque.map(e => `
    <tr>
      <td><strong>${escapeHTML(e.item)}</strong></td>
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

  setupTableActions();
  setupEstoqueSelectOption();
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
  const estoqueMap = {};
  estoque.forEach(e => {
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
    const currentValue = select.value;
    let options = '<option value="">Selecione insumo...</option>';
    estoque.forEach(item => {
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
          configuracoes: [
            { chave: 'googleSheetsUrl', valor: googleSheetsUrl }
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

            if (data.configuracoes) {
              const urlConfig = data.configuracoes.find(x => x.chave === 'googleSheetsUrl');
              if (urlConfig) {
                await setConfig('googleSheetsUrl', urlConfig.valor);
                googleSheetsUrl = urlConfig.valor;
                document.getElementById('googleSheetsUrlInput').value = googleSheetsUrl;
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
