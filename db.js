/**
 * db.js - Gerenciador de Banco de Dados Local (IndexedDB) e Nuvem (Firebase Firestore)
 * Projeto: PWA Pinheiro Afiações
 */

// Importa os SDKs do Firebase Modulares diretamente do CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  getDocs, 
  enableIndexedDbPersistence,
  getDocFromCache,
  getDocsFromCache
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBN81SYoPNU40MCM9OyXc0MyZbGtkcLV-Y",
  authDomain: "controle-pinheiro-afiacoes.firebaseapp.com",
  projectId: "controle-pinheiro-afiacoes",
  storageBucket: "controle-pinheiro-afiacoes.firebasestorage.app",
  messagingSenderId: "605618047271",
  appId: "1:605618047271:web:51b7005d7743262ea2c102",
  measurementId: "G-MKLCLERQ5G"
};

export const useFirebase = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY" && firebaseConfig.apiKey !== "";

let dbInstance = null; // Instância IndexedDB (IDBDatabase) ou Firestore

// --- GERADOR DE ULID COM PREFIXOS ---
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ENCODING_LEN = ENCODING.length;

export function generateUlid(seedTime = Date.now()) {
  let timeStr = "";
  let time = seedTime;
  for (let i = 9; i >= 0; i--) {
    const mod = time % ENCODING_LEN;
    timeStr = ENCODING.charAt(mod) + timeStr;
    time = Math.floor(time / ENCODING_LEN);
  }
  let randStr = "";
  for (let i = 0; i < 16; i++) {
    const rand = Math.floor(Math.random() * ENCODING_LEN);
    randStr += ENCODING.charAt(rand);
  }
  return timeStr + randStr;
}

export function getPrefixForRecord(storeName, record = {}) {
  if (storeName === 'pedidos' || storeName === 'vendas') return 'ven';
  if (storeName === 'servicos') return 'srv';
  if (storeName === 'compras') return 'cmp';
  if (storeName === 'receitas') return 'rec';
  if (storeName === 'pecas') return 'pec';
  if (storeName === 'adicionais') return 'adc';
  if (storeName === 'estoque_movimentacoes') return 'mov';
  if (storeName === 'configuracoes') return 'cfg';
  if (storeName === 'estoque_produtos') return 'prd';

  if (storeName === 'estoque') {
    const tipo = String(record.tipo_item || '').toUpperCase();
    if (tipo === 'PRODUTO_ACABADO') return 'prd';
    if (tipo === 'USO_INTERNO') return 'usi';
    if (tipo === 'PESQUISA_DESENVOLVIMENTO' || tipo === 'PND') return 'pnd';
    return 'est';
  }

  return 'gen';
}

export function generatePrefixedId(storeName, record = {}) {
  const prefix = getPrefixForRecord(storeName, record);
  return `${prefix}_${generateUlid()}`;
}

export function parseId(id) {
  if (id === null || id === undefined) return id;
  if (typeof id === 'number') return id;
  const strId = String(id).trim();
  if (/^\d+$/.test(strId)) return Number(strId);
  return strId;
}

// --- INICIALIZAÇÃO ---
export function initDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    if (useFirebase) {
      try {
        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app, "default");
        
        enableIndexedDbPersistence(firestore)
          .then(() => {
            console.log('Firebase Firestore Modular: Persistência offline ativada.');
            dbInstance = firestore;
            resolve(dbInstance);
          })
          .catch((err) => {
            console.warn('Firebase Firestore Modular: Falha ao ativar persistência offline:', err.message);
            dbInstance = firestore;
            resolve(dbInstance);
          });
      } catch (error) {
        console.error('Erro ao inicializar Firebase Firestore:', error);
        reject(error);
      }
    } else {
      console.log('Firebase não configurado. Usando IndexedDB local como fallback.');
      const DB_NAME = 'PinheiroAfiacoesDB';
      const DB_VERSION = 6; // Versão 6 inclui a store de compras de matérias-primas e estoque

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('Erro ao abrir o IndexedDB:', event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = async (event) => {
        dbInstance = event.target.result;
        console.log('IndexedDB conectado com sucesso.');
        try {
          await migrarIdsLegados();
        } catch (mErr) {
          console.warn('Aviso durante migração de IDs legados:', mErr);
        }
        resolve(dbInstance);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        setupIndexedDBStructure(db, event);
      };
    }
  });
}

// Configura a estrutura do IndexedDB
function setupIndexedDBStructure(db, event) {
  // Object Store: Serviços
  if (!db.objectStoreNames.contains('servicos')) {
    const servicosStore = db.createObjectStore('servicos', { keyPath: 'id' });
    servicosStore.createIndex('synced', 'synced', { unique: false });
    servicosStore.createIndex('data', 'data', { unique: false });
  }

  // Object Store: Estoque Central (Unificado)
  if (!db.objectStoreNames.contains('estoque')) {
    const estoqueStore = db.createObjectStore('estoque', { keyPath: 'id' });
    estoqueStore.createIndex('nome', 'nome', { unique: false });
    estoqueStore.createIndex('tipo_item', 'tipo_item', { unique: false });
    estoqueStore.createIndex('synced', 'synced', { unique: false });
  }

  // Object Store: Movimentações de Estoque (Audit Log)
  if (!db.objectStoreNames.contains('estoque_movimentacoes')) {
    const movStore = db.createObjectStore('estoque_movimentacoes', { keyPath: 'id' });
    movStore.createIndex('id_item', 'id_item', { unique: false });
    movStore.createIndex('tipo_movimentacao', 'tipo_movimentacao', { unique: false });
    movStore.createIndex('data', 'data', { unique: false });
    movStore.createIndex('synced', 'synced', { unique: false });
  }

  // Object Store: Compras de Insumos e Matérias-Primas
  if (!db.objectStoreNames.contains('compras')) {
    const comprasStore = db.createObjectStore('compras', { keyPath: 'id' });
    comprasStore.createIndex('id_compra', 'id_compra', { unique: false });
    comprasStore.createIndex('data', 'data', { unique: false });
    comprasStore.createIndex('synced', 'synced', { unique: false });
  }

  // Object Store: Pedidos / Vendas
  if (!db.objectStoreNames.contains('pedidos')) {
    const pedidosStore = db.createObjectStore('pedidos', { keyPath: 'id' });
    pedidosStore.createIndex('synced', 'synced', { unique: false });
    pedidosStore.createIndex('data', 'data', { unique: false });
  }

  // Object Store: Receitas
  if (!db.objectStoreNames.contains('receitas')) {
    const receitasStore = db.createObjectStore('receitas', { keyPath: 'id' });
    receitasStore.createIndex('produtoFinal', 'produtoFinal', { unique: false });
    receitasStore.createIndex('synced', 'synced', { unique: false });
  }

  // Object Store: Peças Afiadas (Preços Padrões)
  if (!db.objectStoreNames.contains('pecas')) {
    const pecasStore = db.createObjectStore('pecas', { keyPath: 'id' });
    pecasStore.createIndex('nome', 'nome', { unique: false });
  }

  // Object Store: Adicionais
  if (!db.objectStoreNames.contains('adicionais')) {
    const adicionaisStore = db.createObjectStore('adicionais', { keyPath: 'id' });
    adicionaisStore.createIndex('nome', 'nome', { unique: false });
  }

  // Object Store: Configurações Gerais
  if (!db.objectStoreNames.contains('configuracoes')) {
    db.createObjectStore('configuracoes', { keyPath: 'chave' });
  }

  console.log('Estrutura do IndexedDB v5 configurada/atualizada.');
}

// Executa uma transação genérica no IndexedDB (fallback)
function getStore(storeName, mode = 'readonly') {
  return initDB().then((db) => {
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  });
}

// --- HELPER DE NORMALIZAÇÃO DE ITENS DE ESTOQUE ---
function normalizeStockRecord(r, isFinishedGoodsOnly = false) {
  if (!r) return r;
  r.id_item = r.id_item || r.id || '';
  r.id = r.id || r.id_item || '';
  r.nome = r.nome || r.item || r.produto || '';
  r.item = r.item || r.nome || r.produto || '';
  r.produto = r.produto || r.nome || r.item || '';
  if (!r.tipo_item) {
    r.tipo_item = isFinishedGoodsOnly ? 'PRODUTO_ACABADO' : 'MATERIA_PRIMA';
  }
  r.unidade_medida = r.unidade_medida || r.unidade || 'UN';
  r.custo_medio = r.custo_medio !== undefined ? Number(r.custo_medio) : (Number(r.preco || r.valor) || 0);
  r.valor = r.valor !== undefined ? Number(r.valor) : r.custo_medio;
  r.quantidade_atual = r.quantidade_atual !== undefined ? Number(r.quantidade_atual) : (Number(r.quantidade) || 0);
  r.quantidade = r.quantidade !== undefined ? Number(r.quantidade) : r.quantidade_atual;
  return r;
}

// --- OPERAÇÕES CRUD ---

// Adiciona um registro
export function addRecord(storeName, record) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      let targetStore = storeName;

      // Redireciona escrita de estoque_produtos para a store unificada 'estoque'
      if (storeName === 'estoque_produtos') {
        targetStore = 'estoque';
        record.tipo_item = record.tipo_item || 'PRODUTO_ACABADO';
      }

      // Garante ID com ULID e prefixo apropriado
      if (!record.id && !record.id_item) {
        record.id = generatePrefixedId(targetStore, record);
      } else if (!record.id && record.id_item) {
        record.id = record.id_item;
      }

      if (targetStore === 'estoque') {
        normalizeStockRecord(record, record.tipo_item === 'PRODUTO_ACABADO');
      }

      if (useFirebase) {
        record.synced = 1;
        setDoc(doc(db, targetStore, String(record.id)), record)
          .catch(err => console.error(`Erro ao sincronizar escrita de ${targetStore} no Firebase:`, err));
        
        resolve(record.id);
      } else {
        const store = await getStore(targetStore, 'readwrite');
        if (record.synced === undefined) {
          record.synced = 0;
        }
        const request = store.put(record);
        request.onsuccess = () => {
          resolve(record.id);
        };
        request.onerror = (event) => {
          reject(event.target.error);
        };
      }
    } catch (error) {
      reject(error);
    }
  });
}

// Retorna todos os registros de uma store
export function getAllRecords(storeName) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      let targetStore = storeName;
      let filterFinishedGoods = false;

      if (storeName === 'estoque_produtos') {
        targetStore = 'estoque';
        filterFinishedGoods = true;
      }

      const sortRecords = (records) => {
        return records.sort((a, b) => {
          const idA = String(a.id || a.id_item || '');
          const idB = String(b.id || b.id_item || '');
          return idA.localeCompare(idB);
        });
      };

      if (useFirebase) {
        try {
          let querySnapshot;
          try {
            querySnapshot = await getDocsFromCache(collection(db, targetStore));
            getDocs(collection(db, targetStore)).catch(err => 
              console.warn(`Erro ao atualizar cache de ${targetStore} em segundo plano:`, err.message)
            );
          } catch (cacheErr) {
            querySnapshot = await getDocs(collection(db, targetStore));
          }

          let records = [];
          querySnapshot.forEach((docSnap) => {
            records.push(docSnap.data());
          });

          if (filterFinishedGoods) {
            records = records.filter(r => r.tipo_item === 'PRODUTO_ACABADO');
          }

          if (targetStore === 'estoque') {
            records.forEach(r => normalizeStockRecord(r, filterFinishedGoods));
          }

          resolve(sortRecords(records));
        } catch (fbError) {
          console.warn(`Erro ao ler todos os registros de ${targetStore} (modo offline ou permissões):`, fbError);
          resolve([]);
        }
      } else {
        const store = await getStore(targetStore, 'readonly');
        const request = store.getAll();
        request.onsuccess = (event) => {
          let records = event.target.result || [];
          if (filterFinishedGoods) {
            records = records.filter(r => r.tipo_item === 'PRODUTO_ACABADO');
          }
          if (targetStore === 'estoque') {
            records.forEach(r => normalizeStockRecord(r, filterFinishedGoods));
          }
          resolve(sortRecords(records));
        };
        request.onerror = (event) => {
          reject(event.target.error);
        };
      }
    } catch (error) {
      reject(error);
    }
  });
}

// Busca um registro por ID
export function getRecordById(storeName, id) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const parsedId = parseId(id);
      let targetStore = storeName === 'estoque_produtos' ? 'estoque' : storeName;

      if (useFirebase) {
        try {
          let docSnap;
          try {
            docSnap = await getDocFromCache(doc(db, targetStore, String(parsedId)));
          } catch (cacheErr) {
            docSnap = await getDoc(doc(db, targetStore, String(parsedId)));
          }

          if (docSnap.exists()) {
            const record = docSnap.data();
            if (targetStore === 'estoque') normalizeStockRecord(record);
            resolve(record);
          } else {
            resolve(null);
          }
        } catch (fbError) {
          console.warn(`Erro ao ler registro ${parsedId} de ${targetStore}:`, fbError);
          resolve(null);
        }
      } else {
        const store = await getStore(targetStore, 'readonly');
        const request = store.get(parsedId);
        request.onsuccess = (event) => {
          const record = event.target.result;
          if (record && targetStore === 'estoque') normalizeStockRecord(record);
          resolve(record || null);
        };
        request.onerror = (event) => {
          reject(event.target.error);
        };
      }
    } catch (error) {
      reject(error);
    }
  });
}

// Atualiza um registro existente
export function updateRecord(storeName, record) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      let targetStore = storeName === 'estoque_produtos' ? 'estoque' : storeName;

      record.id = record.id || record.id_item;

      if (targetStore === 'estoque') {
        normalizeStockRecord(record, record.tipo_item === 'PRODUTO_ACABADO');
      }

      if (useFirebase) {
        record.synced = 1;
        setDoc(doc(db, targetStore, String(record.id)), record)
          .catch(err => console.error(`Erro ao sincronizar atualização de ${targetStore} no Firebase:`, err));
        
        resolve(record.id);
      } else {
        const store = await getStore(targetStore, 'readwrite');
        const request = store.put(record);
        request.onsuccess = () => {
          resolve(record.id);
        };
        request.onerror = (event) => {
          reject(event.target.error);
        };
      }
    } catch (error) {
      reject(error);
    }
  });
}

// Deleta um registro por ID
export function deleteRecord(storeName, id) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();
      const parsedId = parseId(id);
      let targetStore = storeName === 'estoque_produtos' ? 'estoque' : storeName;

      if (useFirebase) {
        deleteDoc(doc(db, targetStore, String(parsedId)))
          .catch(err => console.error(`Erro ao sincronizar exclusão de ${targetStore} no Firebase:`, err));
        
        resolve(true);
      } else {
        const store = await getStore(targetStore, 'readwrite');
        const request = store.delete(parsedId);
        request.onsuccess = () => {
          resolve(true);
        };
        request.onerror = (event) => {
          reject(event.target.error);
        };
      }
    } catch (error) {
      reject(error);
    }
  });
}

// --- REGISTRO DE MOVIMENTAÇÕES DE ESTOQUE (AUDIT LOG) ---
export async function registrarMovimentacaoEstoque({
  id_item,
  nome_item = '',
  tipo_movimentacao, // 'ENTRADA' | 'SAIDA' | 'AJUSTE' | 'PERDA' | 'PRODUCAO' | 'USO_INTERNO' | 'PND'
  quantidade,
  custo_unitario = 0,
  origem_tipo = 'AJUSTE_MANUAL',
  origem_id = null,
  justificativa = '',
  ip_usuario = ''
}) {
  try {
    const item = await getRecordById('estoque', id_item);
    if (!item) {
      console.warn(`Item de estoque ${id_item} não encontrado para movimentação.`);
      return null;
    }

    const qtdNum = Number(quantidade) || 0;
    const saldoAnterior = Number(item.quantidade_atual) || 0;
    let saldoPosterior = saldoAnterior;

    if (['ENTRADA', 'AJUSTE_POSITIVO'].includes(tipo_movimentacao)) {
      saldoPosterior = saldoAnterior + Math.abs(qtdNum);
    } else if (['SAIDA', 'PERDA', 'PRODUCAO', 'USO_INTERNO', 'PND', 'AJUSTE_NEGATIVO'].includes(tipo_movimentacao)) {
      saldoPosterior = Math.max(0, saldoAnterior - Math.abs(qtdNum));
    } else if (tipo_movimentacao === 'AJUSTE') {
      saldoPosterior = Math.max(0, qtdNum);
    }

    // Atualiza Custo Médio se for uma Entrada com custo informado
    let novoCustoMedio = Number(item.custo_medio) || 0;
    if (tipo_movimentacao === 'ENTRADA' && custo_unitario > 0 && saldoPosterior > 0) {
      const valorEstoqueAnterior = saldoAnterior * novoCustoMedio;
      const valorEntrada = Math.abs(qtdNum) * custo_unitario;
      novoCustoMedio = (valorEstoqueAnterior + valorEntrada) / saldoPosterior;
    }

    item.quantidade_atual = saldoPosterior;
    item.custo_medio = Number(novoCustoMedio.toFixed(2));
    await updateRecord('estoque', item);

    const userIp = ip_usuario || (typeof window !== 'undefined' ? (window.currentUserIp || '') : '') || '127.0.0.1';

    const movimentacao = {
      id: generatePrefixedId('estoque_movimentacoes'),
      id_item,
      nome_item: nome_item || item.nome || item.item || '',
      tipo_movimentacao,
      quantidade: Math.abs(qtdNum),
      custo_unitario: Number(custo_unitario) || novoCustoMedio,
      saldo_anterior: saldoAnterior,
      saldo_posterior: saldoPosterior,
      origem_tipo,
      origem_id,
      justificativa,
      ip_usuario: userIp,
      data: new Date().toISOString()
    };

    const movId = await addRecord('estoque_movimentacoes', movimentacao);
    return movId;
  } catch (error) {
    console.error('Erro ao registrar movimentação de estoque:', error);
    throw error;
  }
}

// --- MIGRAÇÃO AUTOMÁTICA DE IDS LEGADOS PARA O NOVO FORMATO PREFIXADO (ULID) ---
function isIdLegado(id) {
  if (id === null || id === undefined) return false;
  const str = String(id).trim();
  if (!str) return false;
  if (/^\d+$/.test(str) || !str.includes('_')) return true;
  return false;
}

export async function migrarIdsLegados() {
  try {
    const STORES = [
      'servicos',
      'estoque',
      'pedidos',
      'vendas',
      'compras',
      'receitas',
      'pecas',
      'adicionais',
      'estoque_movimentacoes'
    ];

    const idMap = new Map();
    let registrosConvertidos = 0;

    // FASE 1: Converter a chave primária (id) de todos os registros antigos
    for (const storeName of STORES) {
      let records = [];
      try {
        records = await getAllRecords(storeName);
      } catch (e) {
        continue;
      }
      if (!records || records.length === 0) continue;

      for (const record of records) {
        const oldId = record.id;
        if (oldId !== undefined && isIdLegado(oldId)) {
          const oldIdStr = String(oldId);
          let newId = idMap.get(oldIdStr);
          if (!newId) {
            newId = generatePrefixedId(storeName, record);
            idMap.set(oldIdStr, newId);
          }

          // Deleta a chave legada sem prefixo
          try {
            await deleteRecord(storeName, oldId);
          } catch (errDel) {
            console.warn(`Aviso ao remover ID legado ${oldId} em ${storeName}:`, errDel);
          }

          // Atualiza as propriedades de ID do registro
          record.id = newId;
          if (record.id_servico && isIdLegado(record.id_servico)) record.id_servico = newId;
          if (record.id_item && isIdLegado(record.id_item)) record.id_item = newId;
          if (record.id_compra && isIdLegado(record.id_compra)) record.id_compra = newId;
          if (record.id_pedido && isIdLegado(record.id_pedido)) record.id_pedido = newId;

          await addRecord(storeName, record);
          registrosConvertidos++;
        }
      }
    }

    // FASE 2: Atualizar chaves estrangeiras vinculadas aos IDs convertidos
    if (idMap.size > 0) {
      for (const storeName of STORES) {
        let records = [];
        try {
          records = await getAllRecords(storeName);
        } catch (e) {
          continue;
        }
        if (!records || records.length === 0) continue;

        for (const record of records) {
          let modificado = false;

          if (storeName === 'estoque_movimentacoes') {
            if (record.id_item && idMap.has(String(record.id_item))) {
              record.id_item = idMap.get(String(record.id_item));
              modificado = true;
            }
            if (record.origem_id && idMap.has(String(record.origem_id))) {
              record.origem_id = idMap.get(String(record.origem_id));
              modificado = true;
            }
          }

          if (['compras', 'pedidos', 'vendas', 'receitas'].includes(storeName) && Array.isArray(record.itens)) {
            record.itens.forEach(item => {
              if (item.id_item && idMap.has(String(item.id_item))) {
                item.id_item = idMap.get(String(item.id_item));
                modificado = true;
              }
              if (item.id && idMap.has(String(item.id))) {
                item.id = idMap.get(String(item.id));
                modificado = true;
              }
            });
          }

          if (modificado) {
            await updateRecord(storeName, record);
          }
        }
      }
      console.log(`Migração concluída com sucesso! ${registrosConvertidos} registros e ${idMap.size} IDs legados convertidos para o novo padrão.`);
    }

    return registrosConvertidos;
  } catch (error) {
    console.error('Erro durante a migração de IDs legados no banco:', error);
  }
}

// --- CONFIGURAÇÕES GERAIS ---
export function getConfig(chave) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();

      if (useFirebase) {
        try {
          let docSnap;
          try {
            docSnap = await getDocFromCache(doc(db, 'configuracoes', chave));
          } catch (cacheErr) {
            docSnap = await getDoc(doc(db, 'configuracoes', chave));
          }

          if (docSnap.exists()) {
            resolve(docSnap.data().valor);
          } else {
            resolve(null);
          }
        } catch (fbError) {
          console.warn(`Erro ao ler config ${chave}:`, fbError);
          resolve(null);
        }
      } else {
        const store = await getStore('configuracoes', 'readonly');
        const request = store.get(chave);
        request.onsuccess = (event) => {
          const res = event.target.result;
          resolve(res ? res.valor : null);
        };
        request.onerror = (event) => {
          reject(event.target.error);
        };
      }
    } catch (error) {
      reject(error);
    }
  });
}

export function setConfig(chave, valor) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();

      if (useFirebase) {
        setDoc(doc(db, 'configuracoes', chave), { chave, valor })
          .catch(err => console.error(`Erro ao sincronizar config ${chave} no Firebase:`, err));
        
        resolve(true);
      } else {
        const store = await getStore('configuracoes', 'readwrite');
        const request = store.put({ chave, valor });
        request.onsuccess = () => {
          resolve(true);
        };
        request.onerror = (event) => {
          reject(event.target.error);
        };
      }
    } catch (error) {
      reject(error);
    }
  });
}
