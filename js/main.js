/* main.js — punto de entrada: carga los datos del backend y arranca los módulos */
import { $, toast } from './utils.js';
import { art, initCatalog, renderCatalog, cargarCatalogo, recargarProductos } from './productos.js';
import { state, initCarrito, refresh, setOnChange, setStoreActionGuard, setCheckoutGuard, save, CFG } from './carrito.js';
import { initCalculadora, renderCalcSelects } from './calculadora.js';
import { initCheckout } from './checkout.js';
import { initAuth, requireAuth, requireCheckoutAuth, restaurarSesion } from './auth.js';
import { setDeseadosOnChange } from './deseados.js';
import { getConfiguracion } from './api.js';

/* Cuando cambia el carrito o los deseados se refresca el catálogo y la calculadora */
setOnChange(() => { renderCatalog(); renderCalcSelects(); });
setDeseadosOnChange(() => renderCatalog());

/* Ilustración decorativa del hero (no depende de la API) */
(function hero() {
  const mk = (cls, p) => art(p).replace('<svg ', `<svg class="${cls}" `).replace(/ role="img" aria-label="[^"]*"/, '');
  $('#heroArt').innerHTML =
    '<svg class="string" viewBox="0 0 100 90" preserveAspectRatio="none"><path d="M18 22 C 40 70, 70 10, 82 30 S 60 86, 54 80" fill="none" stroke="#F29A3B" stroke-width=".9" stroke-dasharray="2 1.6" stroke-linecap="round"/></svg>' +
    mk('a1', { cat: 'hilos', color: '#F08BB4' }) +
    mk('a2', { cat: 'botones', color: '#F6CF4A', holes: 4 }) +
    mk('a3', { cat: 'telas', color: '#4CC3E3', patron: 'rayas' }) +
    mk('a4', { cat: 'botones', color: '#6CC24A', holes: 2 });
})();

/* Tema claro / oscuro */
$('#themeBtn').addEventListener('click', () => {
  const root = document.documentElement;
  const cur = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  root.dataset.theme = cur === 'dark' ? 'light' : 'dark';
});

/* Reinicio de la demostración: vacía el carrito y vuelve a leer el stock real de la base de datos */
$('#resetDemo').addEventListener('click', async () => {
  state.cart = {}; state.coupon = null;
  save();
  await recargarProductos().catch(() => {});
  refresh();
  toast('Carrito reiniciado. El stock viene de la base de datos.');
});

/* Arranque: primero los datos del servidor, después los módulos que los usan */
async function iniciar() {
  $('#catalogo-grid').innerHTML = '<p class="empty" role="status">Cargando catálogo…</p>';
  try {
    const [cfg] = await Promise.all([getConfiguracion(), cargarCatalogo()]);
    Object.assign(CFG, cfg);
  } catch (err) {
    $('#catalogo-grid').innerHTML =
      `<div class="empty" role="alert"><p>${err.message}</p><button type="button" class="btn btn--sm" id="retryLoad">Reintentar</button></div>`;
    $('#retryLoad').addEventListener('click', iniciar, { once: true });
    return;
  }
  initCarrito();
  initCatalog();              // también prepara la lista de deseados
  await restaurarSesion();    // si había sesión, recupera el usuario y sus deseados
  initAuth();
  setStoreActionGuard(requireAuth);
  setCheckoutGuard(requireCheckoutAuth);
  initCalculadora();
  initCheckout();
  refresh();
}

iniciar().catch(err => { console.error(err); toast('No se pudo iniciar la página.'); });
