const DATABASE_NAME = "store-order-confirmation";
const STORE_NAME = "receipt-photos";
const DATABASE_VERSION = 1;

type ReceiptPhotoRecord = {
  orderNumber: string;
  photo: Blob;
  savedAt: number;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "orderNumber" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open receipt photo storage."));
  });
}

export async function saveOrderConfirmationPhoto(
  orderNumber: string,
  photo: Blob
): Promise<void> {
  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    store.put({ orderNumber, photo, savedAt: Date.now() });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Could not save receipt photo."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Receipt photo storage was aborted."));
  }).finally(() => database.close());
}

export async function loadOrderConfirmationPhoto(
  orderNumber: string
): Promise<Blob | null> {
  const database = await openDatabase();

  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction
        .objectStore(STORE_NAME)
        .get(orderNumber) as IDBRequest<ReceiptPhotoRecord | undefined>;

      request.onsuccess = () => {
        const record = request.result;
        if (!record || Date.now() - record.savedAt > 24 * 60 * 60 * 1000) {
          resolve(null);
          return;
        }

        resolve(record.photo);
      };
      request.onerror = () =>
        reject(request.error ?? new Error("Could not load receipt photo."));
    });
  } finally {
    database.close();
  }
}
