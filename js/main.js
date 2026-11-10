/* main.js — punto de entrada: importa y arranca los módulos */
import { $, store, toast } from './utils.js';
import { art, initCatalog, renderCatalog } from './productos.js';
import { state, initCarrito, refresh, setOnChange, save } from './carrito.js';
import { initCalculadora, renderCalcSelects } from './calculadora.js';
import { initCheckout } from './checkout.js';

/* Cuando cambia el carrito se refrescan stock del catálogo y opciones de la calculadora */
setOnChange(() => { renderCatalog(); renderCalcSelects(); });

initCarrito();
initCatalog();
initCalculadora();
initCheckout();
refresh();

/* Ilustración decorativa del hero */
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

/* Reinicio de la demostración */
$('#resetDemo').addEventListener('click', () => {
  state.cart = {}; state.coupon = null; state.sold = {};
  save();
  refresh();
  toast('Carrito y stock reiniciados.');
});
