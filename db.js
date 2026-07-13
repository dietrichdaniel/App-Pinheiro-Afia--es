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
// Insira as credenciais do seu projeto Firebase abaixo para ativar a nuvem automática.
// Se mantiver "YOUR_API_KEY", o sistema usará o IndexedDB local no navegador.
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
        // Conecta especificamente ao banco de dados nomeado "default"
        const firestore = getFirestore(app, "default");
        
        // Habilita persistência offline (Modular)
        enableIndexedDbPersistence(firestore)
          .then(() => {
            console.log('Firebase Firestore Modular: Persistência offline ativada.');
            dbInstance = firestore;
            resolve(dbInstance);
          })
          .catch((err) => {
            console.warn('Firebase Firestore Modular: Falha ao ativar persistência offline:', err.message);
            dbInstance = firestore; // Continua usando online mesmo com erro de cache
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
        if (!record.id) {
          record.id = Date.now() + Math.floor(Math.random() * 1000);
        }
        record.synced = 1;
        
        // Escreve de forma assíncrona no cache/Firestore para carregamento instantâneo
        setDoc(doc(db, storeName, String(record.id)), record)
          .catch(err => console.error(`Erro ao sincronizar escrita de ${storeName} no Firebase:`, err));
        
        resolve(record.id);
      } else {
        const store = await getStore(storeName, 'readwrite');
        if (record.synced === undefined) {
          record.synced = 0;
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
        try {
          let querySnapshot;
          try {
            // Tenta obter do cache local primeiro
            querySnapshot = await getDocsFromCache(collection(db, storeName));
            
            // Dispara atualização em segundo plano para manter o cache sincronizado
            getDocs(collection(db, storeName)).catch(err => 
              console.warn(`Erro ao atualizar cache de ${storeName} em segundo plano:`, err.message)
            );
          } catch (cacheErr) {
            // Caso o cache falhe ou esteja vazio, busca do servidor
            querySnapshot = await getDocs(collection(db, storeName));
          }

          const records = [];
          querySnapshot.forEach((docSnap) => {
            records.push(docSnap.data());
          });
          records.sort((a, b) => (a.id || 0) - (b.id || 0));
          resolve(records);
        } catch (fbError) {
          console.warn(`Erro ao ler todos os registros de ${storeName} (modo offline ou permissões):`, fbError);
          resolve([]);
        }
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
        try {
          let docSnap;
          try {
            // Tenta obter do cache local
            docSnap = await getDocFromCache(doc(db, storeName, String(id)));
          } catch (cacheErr) {
            // Fallback para servidor
            docSnap = await getDoc(doc(db, storeName, String(id)));
          }

          if (docSnap.exists()) {
            resolve(docSnap.data());
          } else {
            resolve(null);
          }
        } catch (fbError) {
          console.warn(`Erro ao ler registro ${id} de ${storeName} (modo offline ou permissões):`, fbError);
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
        
        // Escreve no cache de forma assíncrona
        setDoc(doc(db, storeName, String(record.id)), record)
          .catch(err => console.error(`Erro ao sincronizar atualização de ${storeName} no Firebase:`, err));
        
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
        // Deleta no cache de forma assíncrona
        deleteDoc(doc(db, storeName, String(id)))
          .catch(err => console.error(`Erro ao sincronizar exclusão de ${storeName} no Firebase:`, err));
        
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
        try {
          let docSnap;
          try {
            // Tenta obter do cache local
            docSnap = await getDocFromCache(doc(db, 'configuracoes', chave));
          } catch (cacheErr) {
            // Fallback para servidor
            docSnap = await getDoc(doc(db, 'configuracoes', chave));
          }

          if (docSnap.exists()) {
            resolve(docSnap.data().valor);
          } else {
            resolve(null);
          }
        } catch (fbError) {
          console.warn(`Erro ao ler config ${chave} (modo offline ou permissões):`, fbError);
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
        // Salva no cache de forma assíncrona
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
}
