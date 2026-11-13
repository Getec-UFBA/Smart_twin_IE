import '@testing-library/jest-dom/vitest';

const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
};

const storageMock = createStorageMock();

Object.defineProperty(window, 'localStorage', {
  value: storageMock,
  configurable: true,
  writable: true,
});

Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  configurable: true,
  writable: true,
});
