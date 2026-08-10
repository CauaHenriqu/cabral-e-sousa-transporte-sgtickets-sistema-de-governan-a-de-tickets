const DB_NAME = 'sgtickets-draft-db';
const STORE_NAME = 'attachment-drafts';

type StoredDraftFiles = {
  files: File[];
  savedAt: number;
};

const isIndexedDbAvailable = () => typeof window !== 'undefined' && 'indexedDB' in window;

const openDraftDb = async (): Promise<IDBDatabase | null> => {
  if (!isIndexedDbAvailable()) return null;

  return await new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir o banco local de rascunhos.'));
  });
};

const runTransaction = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> => {
  const db = await openDraftDb();
  if (!db) return undefined;

  return await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = operation(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha ao acessar os anexos salvos localmente.'));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error('Falha ao finalizar a gravação local dos anexos.'));
    };
  });
};

export const saveDraftFiles = async (key: string | null, files: File[]) => {
  if (!key) return;
  if (files.length === 0) {
    await clearDraftFiles(key);
    return;
  }

  await runTransaction('readwrite', (store) => store.put({ files, savedAt: Date.now() } satisfies StoredDraftFiles, key));
};

export const loadDraftFiles = async (key: string | null): Promise<File[]> => {
  if (!key) return [];

  const result = await runTransaction<StoredDraftFiles | undefined>('readonly', (store) => store.get(key));
  return Array.isArray(result?.files) ? result.files : [];
};

export const clearDraftFiles = async (key: string | null) => {
  if (!key) return;
  await runTransaction('readwrite', (store) => store.delete(key));
};