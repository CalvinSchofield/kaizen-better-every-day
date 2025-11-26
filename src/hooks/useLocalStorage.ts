import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  console.log(`[useLocalStorage] Hook called for key: ${key}`);
  
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      console.log(`[useLocalStorage] Window undefined, returning initial value`);
      return initialValue;
    }
    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);
      console.log(`[useLocalStorage] Retrieved from localStorage[${key}]:`, item);
      // Parse stored json or if none return initialValue
      const parsed = item ? JSON.parse(item) : initialValue;
      console.log(`[useLocalStorage] Parsed value:`, parsed);
      return parsed;
    } catch (error) {
      console.error(`Error loading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that
  // persists the new value to localStorage.
  const setValue = (value: T) => {
    console.log(`[useLocalStorage] setValue called for key: ${key}`, value);
    try {
      // Save state
      setStoredValue(value);
      // Save to local storage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(value));
        console.log(`[useLocalStorage] Saved to localStorage[${key}]`);
      }
    } catch (error) {
      console.error(`Error saving localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}
