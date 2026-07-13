/**
 * google-script.js - Google Apps Script para sincronização com o Google Sheets.
 * 
 * INSTRUÇÕES DE INSTALAÇÃO:
 * 1. Crie uma nova Planilha Google (ou abra uma existente).
 * 2. No menu superior, clique em "Extensões" > "Apps Script".
 * 3. Apague todo o código existente no editor e cole este script.
 * 4. Clique no ícone de salvar (Disquete) no topo.
 * 5. Clique em "Implantar" > "Nova implantação".
 * 6. Em "Selecionar tipo", escolha "App da Web".
 * 7. Configure:
 *    - Descrição: Sincronização PWA Pinheiro Afiações
 *    - Executar como: "Você (seu e-mail)"
 *    - Quem tem acesso: "Qualquer pessoa" (isso é necessário para o app enviar dados sem login complexo)
 * 8. Clique em "Implantar". Autorize as permissões da sua conta se for solicitado.
 * 9. Copie o link gerado ("URL do app da Web") e cole nas Configurações do seu PWA.
 */

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Tenta obter o bloqueio por até 30 segundos para evitar conflitos de gravação concorrente
    lock.waitLock(30000);
    
    if (!e || !e.postData || !e.postData.contents) {
      return response({ status: 'error', message: 'Nenhum dado enviado.' });
    }
    
    const payload = JSON.parse(e.postData.contents);
    const store = payload.store;       // 'servicos', 'estoque', 'pedidos', 'receitas'
    const records = payload.records;   // Array de registros
    
    if (!store || !records || !Array.isArray(records)) {
      return response({ status: 'error', message: 'Parâmetros inválidos.' });
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = getSheetName(store);
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      setupHeaders(sheet, store);
    }
    
    const syncedIds = [];
    const headers = getHeaders(store);
    
    for (const record of records) {
      const rowId = record.id;
      const rowIndex = findRowById(sheet, rowId);
      
      // Mapeia os dados do JSON para a ordem correta das colunas
      const rowData = headers.map(header => {
        if (header === 'ID') return rowId;
        
        // Formata campos específicos
        if (header === 'Matéria Prima' && store === 'receitas') {
          // Converte o array de matérias-primas em texto legível
          if (Array.isArray(record.materiaPrima)) {
            return record.materiaPrima.map(item => `${item.item} (${item.quantidade}x)`).join(', ');
          }
          return record.materiaPrima || '';
        }
        
        if (header === 'Itens' && store === 'servicos') {
          if (Array.isArray(record.itens)) {
            return record.itens.join(', ');
          }
        }
        
        // Devolve o valor correspondente no objeto (usando chave em camelCase)
        const key = camelize(header);
        const value = record[key];
        
        if (value === undefined || value === null) {
          return '';
        }
        
        return value;
      });
      
      if (rowIndex !== -1) {
        // Atualiza a linha existente
        sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      } else {
        // Insere nova linha
        sheet.appendRow(rowData);
      }
      
      syncedIds.push(rowId);
    }
    
    return response({ status: 'success', syncedIds: syncedIds });
    
  } catch (error) {
    return response({ status: 'error', message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

// Retorna o nome amigável da aba da planilha
function getSheetName(store) {
  const mapping = {
    'servicos': 'Serviços',
    'estoque': 'Estoque',
    'pedidos': 'Pedidos',
    'receitas': 'Receitas'
  };
  return mapping[store] || store;
}

// Retorna os cabeçalhos das colunas de cada entidade
function getHeaders(store) {
  switch (store) {
    case 'servicos':
      return ['ID', 'Data', 'Nome', 'Itens', 'Adicionais', 'Valor', 'Frete', 'Meio de Pagamento'];
    case 'estoque':
      return ['ID', 'Item', 'Quantidade', 'Valor', 'Data'];
    case 'pedidos':
      return ['ID', 'Data', 'Item', 'Quantidade', 'Valor', 'Frete', 'Meio de Pagamento'];
    case 'receitas':
      return ['ID', 'Produto Final', 'Matéria Prima', 'Mão de Obra', 'Preço de Venda'];
    default:
      return ['ID'];
  }
}

// Configura os cabeçalhos e formatação inicial da aba
function setupHeaders(sheet, store) {
  const headers = getHeaders(store);
  sheet.appendRow(headers);
  
  // Estiliza o cabeçalho (Negrito, fundo cinza escuro, texto branco)
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#1e293b');
  headerRange.setFontColor('#ffffff');
  headerRange.setHorizontalAlignment('center');
  
  sheet.setFrozenRows(1);
}

// Encontra a linha de um registro pelo ID
function findRowById(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] == id) {
      return i + 2; // +2 porque o range começa em 2 e o array de dados em 0
    }
  }
  return -1;
}

// Converte string com acentos e espaços para camelCase simples
function camelize(str) {
  const map = {
    'Nome': 'nome',
    'Itens': 'itens',
    'Adicionais': 'adicionais',
    'Valor': 'valor',
    'Frete': 'frete',
    'Meio de Pagamento': 'meioPagamento',
    'Data': 'data',
    'Item': 'item',
    'Quantidade': 'quantidade',
    'Produto Final': 'produtoFinal',
    'Matéria Prima': 'materiaPrima',
    'Mão de Obra': 'maoDeObra',
    'Preço de Venda': 'precoVenda'
  };
  return map[str] || str.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
}

// Função de resposta padrão em JSON
function response(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Método de teste GET
function doGet() {
  return ContentService.createTextOutput("API de Sincronização da Pinheiro Afiações está ativa! Use requisições POST para sincronizar dados.")
    .setMimeType(ContentService.MimeType.TEXT);
}
