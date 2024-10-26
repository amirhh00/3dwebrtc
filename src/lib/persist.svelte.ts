import { writable } from 'svelte/store';
import { browser } from '$app/environment';

function debounce(fn: (...args: unknown[]) => void, delay: number) {
  let timeout: Timer | undefined;
  return (...args: unknown[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

export function persistentWritable<T>(key: string, initialValue: T, debounceDelay = 300) {
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

export class LocalStore<T> {
  value = $state<T>() as T;
  private _key = '';

  constructor(key: string, value: T) {
    this._key = key;
    this.value = value;

    if (browser) {
      const item = localStorage.getItem(key);
      if (item) this.value = this.deserialize(item);
    }

    $effect.root(() => {
      $effect(() => {
        localStorage.setItem(this.key, this.serialize(this.value));
      });
      return () => {};
    });
  }

  get key() {
    return this._key;
  }

  serialize(value: T): string {
    return JSON.stringify(value);
  }

  deserialize(item: string): T {
    return JSON.parse(item);
  }
}

export function localStore<T>(key: string, value: T) {
  return new LocalStore(key, value);
}
