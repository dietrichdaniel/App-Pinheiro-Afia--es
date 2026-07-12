/**
 * db.js - Gerenciador de Banco de Dados Local (IndexedDB) e Nuvem (Firebase Firestore)
 * Projeto: PWA Pinheiro Afiações
 */

// --- CONFIGURAÇÃO DO FIREBASE ---
// Insira as credenciais do seu projeto Firebase abaixo para ativar a nuvem automática.
// Se mantiver "YOUR_API_KEY", o sistema usará o IndexedDB local no navegador.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const useFirebase = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY" && firebaseConfig.apiKey !== "";

let dbInstance = null; // Instância IndexedDB ou Firestore

// --- INICIALIZAÇÃO ---
export function initDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    if (useFirebase) {
      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
        }
        const firestore = firebase.firestore();
        
        // Habilita persistência offline
        firestore.enablePersistence({ synchronizeTabs: true })
          .then(() => {
            console.log('Firebase Firestore: Persistência offline ativada.');
            dbInstance = firestore;
            resolve(dbInstance);
          })
          .catch((err) => {
            console.warn('Firebase Firestore: Falha ao ativar persistência offline:', err.message);
            dbInstance = firestore; // Continua usando online mesmo com erro de cache (ex: abas abertas)
            resolve(dbInstance);
          });
      } catch (error) {
        console.error('Erro ao inicializar Firebase Firestore:', error);
        reject(error);
      }
    } else {
      // Fallback para IndexedDB local original
      console.log('Firebase não configurado. Usando IndexedDB local como fallback.');
      const DB_NAME = 'PinheiroAfiacoesDB';
      const DB_VERSION = 4;

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('Erro ao abrir o IndexedDB:', event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        console.log('IndexedDB conectado com sucesso.');
        resolve(dbInstance);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        setupIndexedDBStructure(db, event);
      };
    }
  });
}

// Configura a estrutura antiga do IndexedDB (mantido como fallback)
function setupIndexedDBStructure(db, event) {
  // Object Store: Serviços
  if (!db.objectStoreNames.contains('servicos')) {
    const servicosStore = db.createObjectStore('servicos', { keyPath: 'id', autoIncrement: true });
    servicosStore.createIndex('synced', 'synced', { unique: false });
    servicosStore.createIndex('data', 'data', { unique: false });
  }

  // Object Store: Estoque
  if (!db.objectStoreNames.contains('estoque')) {
    const estoqueStore = db.createObjectStore('estoque', { keyPath: 'id', autoIncrement: true });
    estoqueStore.createIndex('item', 'item', { unique: false });
    estoqueStore.createIndex('synced', 'synced', { unique: false });
  } else {
    const transaction = event.target.transaction;
    if (transaction) {
      const estoqueStore = transaction.objectStore('estoque');
      if (estoqueStore.indexNames.contains('item')) {
        const index = estoqueStore.index('item');
        if (index.unique) {
          estoqueStore.deleteIndex('item');
          estoqueStore.createIndex('item', 'item', { unique: false });
        }
      }
    }
  }

  // Object Store: Pedidos (Vendas)
  if (!db.objectStoreNames.contains('pedidos')) {
    const pedidosStore = db.createObjectStore('pedidos', { keyPath: 'id', autoIncrement: true });
    pedidosStore.createIndex('synced', 'synced', { unique: false });
    pedidosStore.createIndex('data', 'data', { unique: false });
  }

  // Object Store: Receitas
  if (!db.objectStoreNames.contains('receitas')) {
    const receitasStore = db.createObjectStore('receitas', { keyPath: 'id', autoIncrement: true });
    receitasStore.createIndex('produtoFinal', 'produtoFinal', { unique: true });
    receitasStore.createIndex('synced', 'synced', { unique: false });
  }

  // Object Store: Peças Afiadas (Preços Padrões)
  if (!db.objectStoreNames.contains('pecas')) {
    const pecasStore = db.createObjectStore('pecas', { keyPath: 'id', autoIncrement: true });
    pecasStore.createIndex('nome', 'nome', { unique: true });
  }

  // Object Store: Adicionais
  if (!db.objectStoreNames.contains('adicionais')) {
    const adicionaisStore = db.createObjectStore('adicionais', { keyPath: 'id', autoIncrement: true });
    adicionaisStore.createIndex('nome', 'nome', { unique: true });
  }

  // Object Store: Estoque de Produtos Finalizados
  if (!db.objectStoreNames.contains('estoque_produtos')) {
    const estoqueProdutosStore = db.createObjectStore('estoque_produtos', { keyPath: 'id', autoIncrement: true });
    estoqueProdutosStore.createIndex('produto', 'produto', { unique: true });
    estoqueProdutosStore.createIndex('synced', 'synced', { unique: false });
  }

  // Object Store: Configurações Gerais
  if (!db.objectStoreNames.contains('configuracoes')) {
    db.createObjectStore('configuracoes', { keyPath: 'chave' });
  }

  console.log('Estrutura do IndexedDB configurada/atualizada.');
}

// Executa uma transação genérica no IndexedDB (fallback)
function getStore(storeName, mode = 'readonly') {
  return initDB().then((db) => {
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  });
}

// --- OPERAÇÕES CRUD ---

// Adiciona um registro
export function addRecord(storeName, record) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();

      if (useFirebase) {
        // Gera um ID numérico baseado em timestamp + aleatório se não existir
        if (!record.id) {
          record.id = Date.now() + Math.floor(Math.random() * 1000);
        }
        // No Firebase Firestore, a sincronização é nativa
        record.synced = 1;
        
        await db.collection(storeName).doc(String(record.id)).set(record);
        resolve(record.id);
      } else {
        const store = await getStore(storeName, 'readwrite');
        if (record.synced === undefined) {
          record.synced = 0; // 0 = Não sincronizado, 1 = Sincronizado
        }
        const request = store.add(record);
        request.onsuccess = (event) => {
          resolve(event.target.result);
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

      if (useFirebase) {
        const snapshot = await db.collection(storeName).get();
        const records = [];
        snapshot.forEach((doc) => {
          records.push(doc.data());
        });
        // Ordena por ID para manter a ordem crescente de data/cadastro
        records.sort((a, b) => (a.id || 0) - (b.id || 0));
        resolve(records);
      } else {
        const store = await getStore(storeName, 'readonly');
        const request = store.getAll();
        request.onsuccess = (event) => {
          resolve(event.target.result);
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

      if (useFirebase) {
        const doc = await db.collection(storeName).doc(String(id)).get();
        if (doc.exists) {
          resolve(doc.data());
        } else {
          resolve(null);
        }
      } else {
        const store = await getStore(storeName, 'readonly');
        const request = store.get(Number(id));
        request.onsuccess = (event) => {
          resolve(event.target.result);
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

      if (useFirebase) {
        record.synced = 1;
        await db.collection(storeName).doc(String(record.id)).set(record);
        resolve(record.id);
      } else {
        const store = await getStore(storeName, 'readwrite');
        const request = store.put(record);
        request.onsuccess = (event) => {
          resolve(event.target.result);
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

      if (useFirebase) {
        await db.collection(storeName).doc(String(id)).delete();
        resolve(true);
      } else {
        const store = await getStore(storeName, 'readwrite');
        const request = store.delete(Number(id));
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

// --- CONFIGURAÇÕES GERAIS ---

export function getConfig(chave) {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDB();

      if (useFirebase) {
        const doc = await db.collection('configuracoes').doc(chave).get();
        if (doc.exists) {
          resolve(doc.data().valor);
        } else {
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
        await db.collection('configuracoes').doc(chave).set({ chave, valor });
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

// --- MÉTODOS AUXILIARES DE SINCRONIZAÇÃO (Mantidos por compatibilidade de assinatura) ---

export function getUnsyncedRecords(storeName) {
  return new Promise(async (resolve, reject) => {
    try {
      if (useFirebase) {
        // Com Firebase, o sync é nativo. Retornamos [] porque nada precisa ser sincronizado manualmente.
        resolve([]);
      } else {
        const store = await getStore(storeName, 'readonly');
        const index = store.index('synced');
        const request = index.getAll(IDBKeyRange.only(0));
        request.onsuccess = (event) => {
          resolve(event.target.result);
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

export function markAsSynced(storeName, id) {
  return new Promise(async (resolve, reject) => {
    try {
      if (useFirebase) {
        resolve(true);
      } else {
        const store = await getStore(storeName, 'readwrite');
        const getRequest = store.get(id);
        getRequest.onsuccess = (event) => {
          const record = event.target.result;
          if (record) {
            record.synced = 1;
            const putRequest = store.put(record);
            putRequest.onsuccess = () => resolve(true);
            putRequest.onerror = (e) => reject(e.target.error);
          } else {
            resolve(false);
          }
        };
        getRequest.onerror = (event) => {
          reject(event.target.error);
        };
      }
    } catch (error) {
      reject(error);
    }
  });
}
