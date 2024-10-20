import { writable } from 'svelte/store';

function debounce(fn: (...args: any[]) => void, delay: number) {
  let timeout: Timer | undefined;
  return (...args: any) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

export function persistent<T>(key: string, initialValue: T, debounceDelay = 300) {
  let storedValue;
  if (typeof window !== 'undefined') {
    storedValue = localStorage.getItem(key);
  }

  const store = writable<typeof initialValue>(storedValue ? JSON.parse(storedValue) : initialValue);

  if (typeof window !== 'undefined') {
    store.subscribe(
      debounce((value) => {
        if (value === undefined) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, JSON.stringify(value));
        }
      }, debounceDelay)
    );
  }

  return store;
}
