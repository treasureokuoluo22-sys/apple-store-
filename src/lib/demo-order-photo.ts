const DATABASE_NAME = "store-demo-order-review";
const STORE_NAME = "product-photos";
const DATABASE_VERSION = 1;
const PHOTO_TTL_MS = 60 * 60 * 1000;

type DemoPhotoRecord = {
  demoOrderNumber: string;
  photo: Blob;
  savedAt: number;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, {
          keyPath: "demoOrderNumber",
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ?? new Error("Could not open demo photo storage.")
      );
  });
}

export async function saveDemoOrderPhoto(
  demoOrderNumber: string,
  photo: Blob
): Promise<void> {
  const database = await openDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      store.put({
        demoOrderNumber,
        photo,
        savedAt: Date.now(),
      } satisfies DemoPhotoRecord);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(
          transaction.error ?? new Error("Could not save the demo photo.")
        );
      transaction.onabort = () =>
        reject(
          transaction.error ?? new Error("Demo photo storage was aborted.")
        );
    });
  } finally {
    database.close();
  }
}

export async function loadDemoOrderPhoto(
  demoOrderNumber: string
): Promise<Blob | null> {
  const database = await openDatabase();

  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction
        .objectStore(STORE_NAME)
        .get(demoOrderNumber) as IDBRequest<DemoPhotoRecord | undefined>;

      request.onsuccess = () => {
        const record = request.result;
        if (!record) {
          resolve(null);
          return;
        }

        if (Date.now() - record.savedAt > PHOTO_TTL_MS) {
          const cleanup = database.transaction(STORE_NAME, "readwrite");
          cleanup.objectStore(STORE_NAME).delete(demoOrderNumber);
          cleanup.oncomplete = () => resolve(null);
          cleanup.onerror = () =>
            reject(
              cleanup.error ?? new Error("Could not remove the expired demo photo.")
            );
          return;
        }

        resolve(record.photo);
      };
      request.onerror = () =>
        reject(request.error ?? new Error("Could not load the demo photo."));
    });
  } finally {
    database.close();
  }
}

export async function deleteDemoOrderPhoto(
  demoOrderNumber: string
): Promise<void> {
  const database = await openDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(demoOrderNumber);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(
          transaction.error ?? new Error("Could not remove the demo photo.")
        );
      transaction.onabort = () =>
        reject(
          transaction.error ?? new Error("Demo photo cleanup was aborted.")
        );
    });
  } finally {
    database.close();
  }
}
