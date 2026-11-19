/* productos.js — RF-01: datos, ilustraciones, filtro por categoría y búsqueda */
import { $, money, shade, toast } from './utils.js';
import { remaining, available, addToCart } from './carrito.js';
import { initDeseados, hasDeseado, toggleDeseado, deseadosCount } from './deseados.js';
import { getCategorias, getProductos } from './api.js';

/* Se llenan desde el backend con cargarCatalogo(); 'todo' es solo un filtro del front */
export const CATS = [{ id: 'todo', nombre: 'Todo', color: 'var(--c-green)' }];
export const PRODUCTOS = [];

/** Pide categorías y productos a la API y reemplaza el contenido de CATS y PRODUCTOS. */
export async function cargarCatalogo() {
  const [cats, prods] = await Promise.all([getCategorias(), getProductos()]);
  CATS.splice(1, CATS.length, ...cats);
  PRODUCTOS.splice(0, PRODUCTOS.length, ...prods);
}

/** Vuelve a pedir solo los productos (stock actualizado después de una compra). */
export async function recargarProductos() {
  PRODUCTOS.splice(0, PRODUCTOS.length, ...(await getProductos()));
}

export function byId(id) { return PRODUCTOS.find(p => p.id === +id); }
export function catName(id) { return CATS.find(c => c.id === id)?.nombre ?? ''; }
export function catColor(id) { return CATS.find(c => c.id === id)?.color ?? 'var(--c-green)'; }
export function fmtQty(p, q) { return p.unidad === 'm' ? q.toFixed(1) + ' m' : String(q); }

/* ---------- Ilustraciones SVG de producto ---------- */
export function art(p) {
  const c = p.color, d = shade(c, -0.22), l = shade(c, 0.35);
  const wrap = inner => `<svg viewBox="0 0 100 100" role="img" aria-label="${p.nombre}">${inner}</svg>`;

  if (p.cat === 'hilos') return wrap(`
    <circle cx="50" cy="50" r="42" fill="${c}"/>
    <g fill="none" stroke="${d}" stroke-width="3" stroke-linecap="round"><path d="M16 40 Q50 22 84 40"/><path d="M10 54 Q50 34 90 54"/><path d="M15 68 Q50 48 85 68"/><path d="M28 82 Q50 66 72 82"/></g>
    <path d="M24 26 Q38 14 56 12" fill="none" stroke="${l}" stroke-width="4" stroke-linecap="round" opacity=".7"/>
    <path d="M80 78 q14 8 8 16 q-4 5 -12 2" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`);

  if (p.cat === 'botones') {
    const hole = shade(c, -0.55);
    const holes = p.holes === 2
      ? `<circle cx="42" cy="50" r="4.5" fill="${hole}"/><circle cx="58" cy="50" r="4.5" fill="${hole}"/>`
      : [[42, 42], [58, 42], [42, 58], [58, 58]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="${hole}"/>`).join('');
    return wrap(`<circle cx="50" cy="50" r="40" fill="${c}"/><circle cx="50" cy="50" r="40" fill="none" stroke="${d}" stroke-width="3"/><circle cx="50" cy="50" r="29" fill="none" stroke="${d}" stroke-width="3"/>${holes}`);
  }

  if (p.cat === 'cierres') {
    let teeth = '';
    for (let i = 0; i < 9; i++) teeth += `<rect x="38" y="${22 + i * 8}" width="11" height="4" rx="1.5" fill="#C9CFD8"/><rect x="51" y="${26 + i * 8}" width="11" height="4" rx="1.5" fill="#AEB6C2"/>`;
    return wrap(`<rect x="30" y="6" width="40" height="90" rx="4" fill="${c}"/><rect x="30" y="6" width="40" height="90" rx="4" fill="none" stroke="${d}" stroke-width="2" stroke-dasharray="4 3"/>${teeth}
      <rect x="40" y="10" width="20" height="16" rx="5" fill="#8E97A6"/><circle cx="50" cy="32" r="5" fill="none" stroke="#8E97A6" stroke-width="3"/>`);
  }

  if (p.cat === 'telas') {
    let deco = '';
    if (p.patron === 'rayas') for (let i = 0; i < 6; i++) deco += `<rect x="${14 + i * 14}" y="20" width="6" height="60" fill="${shade(c, 0.55)}" opacity=".85"/>`;
    if (p.patron === 'lunares') for (let i = 0; i < 12; i++) deco += `<circle cx="${24 + (i % 4) * 18 + (Math.floor(i / 4) % 2) * 9}" cy="${30 + Math.floor(i / 4) * 18}" r="4" fill="#FBFAF5"/>`;
    const weave = `<g stroke="${shade(c, 0.2)}" stroke-width="1" opacity=".6">${Array.from({ length: 8 }, (_, i) => `<path d="M12 ${26 + i * 7}H88"/>`).join('')}</g>`;
    return wrap(`<rect x="8" y="16" width="84" height="68" rx="8" fill="${c}"/>${weave}${deco}<rect x="13" y="21" width="74" height="58" rx="5" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="5 4" opacity=".85"/>
      <path d="M92 60 L70 84 L92 84Z" fill="${d}" opacity=".35"/>`);
  }

  const tools = {
    tijeras: `<circle cx="32" cy="76" r="13" fill="none" stroke="${c}" stroke-width="7"/><circle cx="68" cy="76" r="13" fill="none" stroke="${c}" stroke-width="7"/><path d="M38 64 L66 10 L72 14 L50 58Z M62 64 L34 10 L28 14 L50 58Z" fill="#AEB6C2" stroke="#8E97A6" stroke-width="2" stroke-linejoin="round"/><circle cx="50" cy="56" r="3.5" fill="#6B7380"/>`,
    aguja: [0, 1, 2].map(i => `<g transform="rotate(${-30 + i * 30} 50 90)"><rect x="48" y="8" width="4" height="82" rx="2" fill="#C9CFD8"/><ellipse cx="50" cy="16" rx="1.7" ry="5" fill="${c}" stroke="#8E97A6" stroke-width=".8"/></g>`).join(''),
    cinta: `<rect x="6" y="30" width="88" height="40" rx="6" fill="${c}"/><g stroke="#2B2A3A" stroke-width="2">${Array.from({ length: 15 }, (_, i) => `<path d="M${12 + i * 5.6} 30v${i % 5 === 0 ? 14 : 8}"/>`).join('')}</g><rect x="6" y="30" width="88" height="40" rx="6" fill="none" stroke="${d}" stroke-width="2" stroke-dasharray="4 3"/>`,
    dedal: `<path d="M26 82 L32 40 Q50 14 68 40 L74 82Z" fill="${c}" stroke="#8E97A6" stroke-width="3" stroke-linejoin="round"/><g fill="#8E97A6">${[[40, 40], [50, 36], [60, 40], [38, 52], [48, 50], [58, 52], [68, 52], [40, 64], [50, 62], [60, 64]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6"/>`).join('')}</g><rect x="22" y="80" width="56" height="9" rx="4" fill="#8E97A6"/>`,
    alfiler: [0, 1, 2, 3].map(i => `<g transform="rotate(${-36 + i * 24} 50 92)"><rect x="49" y="18" width="2" height="74" fill="#AEB6C2"/><circle cx="50" cy="16" r="7" fill="${i % 2 ? '#F6CF4A' : c}"/></g>`).join('')
  };
  return wrap(tools[p.tool]);
}

/* ---------- Render del catálogo ---------- */
let filtro = 'todo';
let busqueda = '';
let mostrandoDeseados = false;

function stockBadge(p) {
  const r = remaining(p);
  if (available(p) <= 0) return '<span class="stock out">Agotado</span>';
  if (r <= 0) return '<span class="stock low">Ya tienes todo el stock en tu carrito</span>';
  if (r <= 5) return `<span class="stock low">Quedan ${fmtQty(p, r)}</span>`;
  return `<span class="stock ok">Stock: ${fmtQty(p, r)}</span>`;
}

export function renderWishlistCount() {
  $('#wishlistCount').textContent = deseadosCount();
}

export function renderChips() {
  $('#chips').innerHTML = CATS.map(c =>
    `<button type="button" class="chip" style="--chip:${c.color}" data-cat="${c.id}" aria-pressed="${c.id === filtro}">${c.nombre}</button>`
  ).join('');
}

export function renderCatalog() {
  const q = busqueda.trim().toLowerCase();
  const list = PRODUCTOS.filter(p =>
    (filtro === 'todo' || p.cat === filtro) &&
    (!mostrandoDeseados || hasDeseado(p.id)) &&
    (!q || p.nombre.toLowerCase().includes(q) || catName(p.cat).toLowerCase().includes(q)));
  $('#resultCount').textContent = mostrandoDeseados
    ? `${list.length} producto${list.length === 1 ? '' : 's'} en mis deseados`
    : `${list.length} producto${list.length === 1 ? '' : 's'}`;
  renderWishlistCount();
  $('#wishlistFilter').setAttribute('aria-pressed', String(mostrandoDeseados));
  $('#wishlistFilterCount').textContent = deseadosCount();
  $('#catalogo-grid').innerHTML = list.length ? list.map(p => {
    const per = p.unidad === 'm' ? ' / metro' : '';
    const isWishlisted = hasDeseado(p.id);
    return `<article class="product-card" style="--cat:${catColor(p.cat)}" aria-labelledby="prod-${p.id}">
      <div class="product-card__art">
        ${art(p)}
        <button type="button" class="wishlist-toggle" data-wishlist="${p.id}" aria-pressed="${isWishlisted}" aria-label="${isWishlisted ? 'Quitar' : 'Agregar'} ${p.nombre} ${isWishlisted ? 'de' : 'a'} mis deseados" title="${isWishlisted ? 'Quitar de mis deseados' : 'Agregar a mis deseados'}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg>
        </button>
      </div>
      <span class="product-card__cat">${catName(p.cat)}${p.desc ? ' · ' + p.desc : ''}</span>
      <h3 id="prod-${p.id}">${p.nombre}</h3>
      <p class="product-card__precio">${money(p.precio)}<small>${per}</small></p>
      <p>${stockBadge(p)}</p>
      <button type="button" class="btn btn--sm" data-add="${p.id}" ${remaining(p) <= 0 ? 'disabled' : ''} aria-label="Agregar ${p.nombre} al carrito">${p.unidad === 'm' ? 'Agregar 1 m' : 'Agregar al carrito'}</button>
    </article>`;
  }).join('') : mostrandoDeseados && deseadosCount() === 0
    ? '<div class="empty wishlist-empty"><p>Aún no tienes productos deseados.</p><button type="button" class="btn btn--sm" data-clear-wishlist-filter>Explorar catálogo</button></div>'
    : '<p class="empty">No encontramos productos con ese filtro. Prueba con otra palabra o categoría.</p>';
}

export function initCatalog() {
  initDeseados(PRODUCTOS.map(p => p.id));
  renderChips();
  renderCatalog();
  $('#chips').addEventListener('click', e => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    filtro = b.dataset.cat;
    renderChips();
    renderCatalog();
  });
  $('#q').addEventListener('input', e => { busqueda = e.target.value; renderCatalog(); });
  $('#wishlistFilter').addEventListener('click', () => {
    mostrandoDeseados = !mostrandoDeseados;
    renderCatalog();
  });
  $('#wishlistBtn').addEventListener('click', () => {
    mostrandoDeseados = true;
    renderCatalog();
  });
  $('#catalogo-grid').addEventListener('click', e => {
    if (e.target.closest('[data-clear-wishlist-filter]')) {
      mostrandoDeseados = false;
      renderCatalog();
      return;
    }
    const wishlistButton = e.target.closest('[data-wishlist]');
    if (wishlistButton) {
      const p = byId(wishlistButton.dataset.wishlist);
      if (!p) return;
      const added = toggleDeseado(p.id);
      renderCatalog();
      toast(added ? `${p.nombre} agregado a tus deseados.` : `${p.nombre} quitado de tus deseados.`);
      return;
    }
    const b = e.target.closest('[data-add]');
    if (!b) return;
    const p = byId(b.dataset.add);
    if (addToCart(p.id, 1)) toast(`${p.nombre} agregado al carrito.`);
  });
}
