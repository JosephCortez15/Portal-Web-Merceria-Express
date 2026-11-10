/* productos.js — RF-01: datos, ilustraciones, filtro por categoría y búsqueda */
import { $, money, shade, toast } from './utils.js';
import { remaining, available, addToCart } from './carrito.js';

export const CATS = [
  { id: 'todo', nombre: 'Todo', color: 'var(--c-green)' },
  { id: 'hilos', nombre: 'Hilos', color: 'var(--c-pink)' },
  { id: 'botones', nombre: 'Botones', color: 'var(--c-yellow)' },
  { id: 'cierres', nombre: 'Cierres', color: 'var(--c-orange)' },
  { id: 'telas', nombre: 'Telas por metro', color: 'var(--c-cyan)' },
  { id: 'herramientas', nombre: 'Herramientas', color: 'var(--c-green)' }
];

export const PRODUCTOS = [
  { id: 101, cat: 'hilos', nombre: 'Hilo de poliéster rojo', precio: 8.5, stock: 24, color: '#D6443F', unidad: 'carrete', desc: '200 m' },
  { id: 102, cat: 'hilos', nombre: 'Hilo de algodón azul', precio: 9, stock: 18, color: '#3F6190', unidad: 'carrete', desc: '200 m' },
  { id: 103, cat: 'hilos', nombre: 'Hilo de poliéster verde', precio: 8.5, stock: 3, color: '#4FA533', unidad: 'carrete', desc: '200 m' },
  { id: 104, cat: 'hilos', nombre: 'Hilo mostaza', precio: 8.5, stock: 30, color: '#F6CF4A', unidad: 'carrete', desc: '200 m' },
  { id: 105, cat: 'hilos', nombre: 'Hilo rosa', precio: 8.5, stock: 12, color: '#F08BB4', unidad: 'carrete', desc: '200 m' },
  { id: 106, cat: 'hilos', nombre: 'Hilo naranja', precio: 8.5, stock: 0, color: '#F29A3B', unidad: 'carrete', desc: '200 m' },
  { id: 201, cat: 'botones', nombre: 'Botones de madera x12', precio: 12, stock: 40, color: '#8B5A34', unidad: 'bolsa', holes: 2 },
  { id: 202, cat: 'botones', nombre: 'Botones rosa x10', precio: 10, stock: 25, color: '#F08BB4', unidad: 'bolsa', holes: 4 },
  { id: 203, cat: 'botones', nombre: 'Botones cian x10', precio: 10, stock: 5, color: '#4CC3E3', unidad: 'bolsa', holes: 4 },
  { id: 204, cat: 'botones', nombre: 'Botones mostaza x8', precio: 9, stock: 16, color: '#F6CF4A', unidad: 'bolsa', holes: 2 },
  { id: 301, cat: 'cierres', nombre: 'Cierre rojo 20 cm', precio: 6, stock: 50, color: '#D6443F', unidad: 'pieza' },
  { id: 302, cat: 'cierres', nombre: 'Cierre azul 40 cm', precio: 9, stock: 22, color: '#3F6190', unidad: 'pieza' },
  { id: 303, cat: 'cierres', nombre: 'Cierre invisible 25 cm', precio: 7.5, stock: 14, color: '#F2EEE2', unidad: 'pieza' },
  { id: 401, cat: 'telas', nombre: 'Algodón a rayas cian', precio: 32, stock: 40, color: '#4CC3E3', unidad: 'm', patron: 'rayas', step: 0.5 },
  { id: 402, cat: 'telas', nombre: 'Popelina verde lisa', precio: 28, stock: 25, color: '#6CC24A', unidad: 'm', patron: 'lisa', step: 0.5 },
  { id: 403, cat: 'telas', nombre: 'Lunares sobre rosa', precio: 35, stock: 18, color: '#F08BB4', unidad: 'm', patron: 'lunares', step: 0.5 },
  { id: 404, cat: 'telas', nombre: 'Franela amarilla', precio: 30, stock: 6, color: '#F6CF4A', unidad: 'm', patron: 'lisa', step: 0.5 },
  { id: 405, cat: 'telas', nombre: 'Jean denim', precio: 45, stock: 30, color: '#3F6190', unidad: 'm', patron: 'lisa', step: 0.5 },
  { id: 501, cat: 'herramientas', nombre: 'Tijeras de sastre', precio: 65, stock: 9, color: '#F29A3B', unidad: 'pieza', tool: 'tijeras' },
  { id: 502, cat: 'herramientas', nombre: 'Set de agujas', precio: 15, stock: 35, color: '#4CC3E3', unidad: 'set', tool: 'aguja' },
  { id: 503, cat: 'herramientas', nombre: 'Cinta métrica', precio: 12, stock: 28, color: '#F6CF4A', unidad: 'pieza', tool: 'cinta' },
  { id: 504, cat: 'herramientas', nombre: 'Dedal metálico', precio: 8, stock: 2, color: '#B9C2CF', unidad: 'pieza', tool: 'dedal' },
  { id: 505, cat: 'herramientas', nombre: 'Alfileres con cabeza', precio: 10, stock: 44, color: '#F08BB4', unidad: 'caja', tool: 'alfiler' }
];

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

function stockBadge(p) {
  const r = remaining(p);
  if (available(p) <= 0) return '<span class="stock out">Agotado</span>';
  if (r <= 0) return '<span class="stock low">Ya tienes todo el stock en tu carrito</span>';
  if (r <= 5) return `<span class="stock low">Quedan ${fmtQty(p, r)}</span>`;
  return `<span class="stock ok">Stock: ${fmtQty(p, r)}</span>`;
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
    (!q || p.nombre.toLowerCase().includes(q) || catName(p.cat).toLowerCase().includes(q)));
  $('#resultCount').textContent = `${list.length} producto${list.length === 1 ? '' : 's'}`;
  $('#catalogo-grid').innerHTML = list.length ? list.map(p => {
    const per = p.unidad === 'm' ? ' / metro' : '';
    return `<article class="product-card" style="--cat:${catColor(p.cat)}" aria-labelledby="prod-${p.id}">
      <div class="product-card__art">${art(p)}</div>
      <span class="product-card__cat">${catName(p.cat)}${p.desc ? ' · ' + p.desc : ''}</span>
      <h3 id="prod-${p.id}">${p.nombre}</h3>
      <p class="product-card__precio">${money(p.precio)}<small>${per}</small></p>
      <p>${stockBadge(p)}</p>
      <button type="button" class="btn btn--sm" data-add="${p.id}" ${remaining(p) <= 0 ? 'disabled' : ''} aria-label="Agregar ${p.nombre} al carrito">${p.unidad === 'm' ? 'Agregar 1 m' : 'Agregar al carrito'}</button>
    </article>`;
  }).join('') : '<p class="empty">No encontramos productos con ese filtro. Prueba con otra palabra o categoría.</p>';
}

export function initCatalog() {
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
  $('#catalogo-grid').addEventListener('click', e => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    const p = byId(b.dataset.add);
    if (addToCart(p.id, 1)) toast(`${p.nombre} agregado al carrito.`);
  });
}
