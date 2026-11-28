// التخزين في IndexedDB:
// - مخزن "kv" للشجرة نفسها (بيانات نصية خفيفة)
// - مخزن "files" للوثائق والصور والتسجيلات كملفات ثنائية (Blob) مفهرسة بمعرّف
// الأخطاء لا تُبتلع، فمن يستدعي الدالة يعرف إن فشلت العملية ولماذا.

const DB_NAME = "family-tree-db";
const DB_VERSION = 2;
const KV = "kv";
const FILES = "files";
const TREE_KEY = "tree";
const LEGACY_KEY = "family-tree-v1";

const openDb = () =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB غير متاح في هذا المتصفح"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

// عملية واحدة داخل معاملة، ولا تُعتبر ناجحة إلا بعد اكتمال المعاملة فعلياً
const run = async (storeName, mode, makeRequest) => {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const req = makeRequest(tx.objectStore(storeName));
      let result;
      req.onsuccess = () => {
        result = req.result;
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || req.error);
      tx.onabort = () => reject(tx.error || req.error);
    });
  } finally {
    db.close();
  }
};

export const loadTree = () => run(KV, "readonly", (s) => s.get(TREE_KEY));
export const saveTree = (value) => run(KV, "readwrite", (s) => s.put(value, TREE_KEY));

export const putFile = (id, blob) => run(FILES, "readwrite", (s) => s.put(blob, id));
export const getFile = (id) => run(FILES, "readonly", (s) => s.get(id));
export const deleteFile = (id) => run(FILES, "readwrite", (s) => s.delete(id));
export const clearFiles = () => run(FILES, "readwrite", (s) => s.clear());

export const readLegacy = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(LEGACY_KEY));
    return Array.isArray(saved?.people) ? saved.people : null;
  } catch {
    return null;
  }
};

export const clearLegacy = () => {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // لا شيء يُفعل هنا
  }
};
