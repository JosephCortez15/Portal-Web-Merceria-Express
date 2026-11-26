/* deseados.js — productos favoritos persistentes, independientes del carrito.
 * Sin sesión se guardan en este navegador; con sesión también se guardan en la base de datos
 * (tabla lista_deseados) y se unen con los que el usuario ya tenía en su cuenta. */
import { store } from './utils.js';
import { getToken, sincronizarDeseados, agregarDeseado, quitarDeseado } from './api.js';

const STORAGE_KEY = 'me.wishlist';
let productIds = new Set();
let ids = new Set();
let onChange = () => {};
let beforeWishlistAction = () => false;

const guardar = () => store.set(STORAGE_KEY, [...ids]);

export function setDeseadosOnChange(fn) { onChange = fn; }
export function setWishlistActionGuard(fn) { beforeWishlistAction = fn; }
export function requestWishlistAccess() { return beforeWishlistAction(); }

export function initDeseados(validProductIds) {
  productIds = new Set(validProductIds);
  const saved = store.get(STORAGE_KEY, []);
  ids = new Set(getToken() && Array.isArray(saved)
    ? saved.map(Number).filter(id => productIds.has(id))
    : []);
  guardar();
}

/** Con sesión iniciada: sube los deseados locales y trae la lista completa de la cuenta. */
export async function sincronizarConCuenta() {
  if (!getToken()) return;
  const lista = await sincronizarDeseados([...ids]);
  ids = new Set(lista.map(Number).filter(id => productIds.has(id)));
  guardar();
  onChange();
}

/** Al cerrar sesión se limpia la lista de este navegador (queda guardada en la cuenta). */
export function limpiarDeseadosLocales() {
  ids = new Set();
  guardar();
  onChange();
}

export function hasDeseado(id) {
  return ids.has(Number(id));
}

export function toggleDeseado(id) {
  if (!requestWishlistAccess()) return null;
  id = Number(id);
  if (!productIds.has(id)) return false;
  const added = !ids.has(id);
  if (added) ids.add(id); else ids.delete(id);
  guardar();
  if (getToken()) {
    (added ? agregarDeseado(id) : quitarDeseado(id)).catch(() => { /* se reintenta al sincronizar en el próximo inicio */ });
  }
  return added;
}

export function deseadosCount() {
  return ids.size;
}

export function deseadosIds() {
  return ids;
}
