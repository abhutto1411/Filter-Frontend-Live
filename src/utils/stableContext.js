import { createContext } from 'react';

const registry = (globalThis.__filterStableContexts ??= new Map());

/**
 * `createContext` that returns the same object when Vite hot-reloads the module
 * defining it. A plain `createContext` call makes a new context on every reload,
 * so providers mounted before an edit and hooks loaded after it stop matching
 * ("useX must be used within a Provider") until a full page refresh.
 */
export function createStableContext(key, defaultValue) {
    if (!registry.has(key)) registry.set(key, createContext(defaultValue));
    return registry.get(key);
}
