/* deseados.js — productos favoritos persistentes, independientes del carrito */
import { store } from './utils.js';

const STORAGE_KEY = 'me.wishlist';
let productIds = new Set();
let ids = new Set();

export function initDeseados(validProductIds) {
  productIds = new Set(validProductIds);
  const saved = store.get(STORAGE_KEY, []);
  ids = new Set(Array.isArray(saved)
    ? saved.map(Number).filter(id => productIds.has(id))
    : []);
  store.set(STORAGE_KEY, [...ids]);
}

export function hasDeseado(id) {
  return ids.has(Number(id));
}

export function toggleDeseado(id) {
  id = Number(id);
  if (!productIds.has(id)) return false;
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  store.set(STORAGE_KEY, [...ids]);
  return ids.has(id);
}

export function deseadosCount() {
  return ids.size;
}

export function deseadosIds() {
  return ids;
}
