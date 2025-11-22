// Provide a safe noop localStorage implementation on the server
const ensureServerLocalStorage = () => {
  if (typeof window !== "undefined") return;

  const globalWithStorage = globalThis as typeof globalThis & {
    localStorage?: Storage;
  };

  if (
    typeof globalWithStorage.localStorage === "object" &&
    typeof globalWithStorage.localStorage?.getItem === "function"
  ) {
    return;
  }

  const storage = new Map<string, string>();

  globalWithStorage.localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
    key: (index: number) => Array.from(storage.keys())[index] ?? null,
    get length() {
      return storage.size;
    },
  } as Storage;
};

ensureServerLocalStorage();
