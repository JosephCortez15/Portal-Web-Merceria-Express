/* carrito.js — RF-03: stock, cupones, totales (subtotal, IVA, envío), localStorage y CartModal */
import { $, $$, r2, money, store, toast, validateForm } from './utils.js';
import { byId, art, fmtQty } from './productos.js';

export const COUPONS = { COSTURA10: 10, LANA15: 15, BIENVENIDA5: 5 };
export const IVA = 0.13;
export const ENVIO = 20;
export const ENVIO_GRATIS = 250;

/* Estado compartido (otros módulos lo leen y lo modifican a través de estas funciones) */
export const state = { cart: {}, coupon: null, sold: {} };

let onChange = () => {};
export function setOnChange(fn) { onChange = fn; }

export const available = p => r2(p.stock - (state.sold[p.id] || 0));
export const remaining = p => r2(available(p) - (state.cart[p.id] || 0));
export const stepOf = p => p.step || 1;

export function save() {
  store.set('me.cart', state.cart);
  store.set('me.coupon', state.coupon);
  store.set('me.sold', state.sold);
}

export function refresh() { renderCart(); onChange(); }

export function addToCart(id, qty) {
  const p = byId(id);
  const add = Math.min(qty, remaining(p));
  if (add <= 0) { toast(`No hay más stock de ${p.nombre}.`); return 0; }
  state.cart[id] = r2((state.cart[id] || 0) + add);
  save(); refresh(); bump();
  return add;
}

export function setQty(id, q) {
  const p = byId(id);
  q = r2(q);
  if (q <= 0) delete state.cart[id]; else state.cart[id] = Math.min(q, available(p));
  save(); refresh();
}

export function totals() {
  const lines = Object.entries(state.cart).map(([id, q]) => ({ p: byId(id), q }));
  const subtotal = r2(lines.reduce((s, l) => s + l.p.precio * l.q, 0));
  const pct = state.coupon ? COUPONS[state.coupon] : 0;
  const descuento = r2(subtotal * pct / 100);
  const base = r2(subtotal - descuento);
  const iva = r2(base * IVA);
  const envio = lines.length ? (base >= ENVIO_GRATIS ? 0 : ENVIO) : 0;
  return { lines, subtotal, pct, descuento, iva, envio, total: r2(base + iva + envio) };
}

export function totalsHTML(t) {
  return `<dt>Subtotal</dt><dd>${money(t.subtotal)}</dd>
    ${t.pct ? `<dt class="disc">Descuento ${state.coupon} (${t.pct} %)</dt><dd class="disc">− ${money(t.descuento)}</dd>` : ''}
    <dt>IVA (13 %)</dt><dd>${money(t.iva)}</dd>
    <dt>Envío ${t.envio === 0 && t.lines.length ? '(gratis)' : ''}</dt><dd>${money(t.envio)}</dd>
    <dt class="total">Total</dt><dd class="total">${money(t.total)}</dd>`;
}

export function bump() {
  const b = $('#cartCount');
  b.classList.remove('bump');
  void b.offsetWidth;
  b.classList.add('bump');
}

export function renderCart() {
  const t = totals();
  $('#cartCount').textContent = t.lines.length;
  $('#cartEmpty').hidden = t.lines.length > 0;
  $('#cartFull').hidden = t.lines.length === 0;
  $('#cartList').innerHTML = t.lines.map(({ p, q }) => `
    <li class="cart-item">
      <div class="mini">${art(p)}</div>
      <div><h3>${p.nombre}</h3><p class="meta">${money(p.precio)}${p.unidad === 'm' ? ' / m' : ' c/u'} · Subtotal ${money(p.precio * q)}</p></div>
      <div class="controls">
        <div class="qty" role="group" aria-label="Cantidad de ${p.nombre}">
          <button type="button" data-dec="${p.id}" aria-label="Quitar ${stepOf(p)} ${p.unidad === 'm' ? 'm' : 'unidad'}">−</button>
          <output>${fmtQty(p, q)}</output>
          <button type="button" data-inc="${p.id}" aria-label="Agregar ${stepOf(p)} ${p.unidad === 'm' ? 'm' : 'unidad'}" ${remaining(p) <= 0 ? 'disabled title="Sin más stock"' : ''}>+</button>
        </div>
        <button type="button" class="link-btn" data-del="${p.id}" aria-label="Eliminar ${p.nombre}">Eliminar</button>
      </div>
    </li>`).join('');
  $('#totals').innerHTML = totalsHTML(t);
  $('#payTotals').innerHTML = totalsHTML(t);

  const msg = $('#couponMsg');
  if (state.coupon) {
    msg.className = 'coupon-msg ok';
    msg.textContent = `Cupón ${state.coupon} aplicado: ${COUPONS[state.coupon]} % de descuento.`;
  } else if (!msg.classList.contains('bad')) {
    msg.textContent = '';
  }
  if (t.lines.length && t.envio > 0) {
    const falta = r2(ENVIO_GRATIS - (t.subtotal - t.descuento));
    $('#totals').insertAdjacentHTML('beforeend', `<dt class="hint" style="grid-column:1/-1">Te faltan ${money(falta)} para envío gratis.</dt>`);
  }
}

/* ---------- CartModal: carrito → pago → recibo ---------- */
const modal = () => $('#cartModal');

export function showView(v) {
  $('#viewCart').hidden = v !== 'cart';
  $('#viewPay').hidden = v !== 'pay';
  $('#viewReceipt').hidden = v !== 'receipt';
  $('#modalTitle').textContent = { cart: 'Tu carrito', pay: 'Pago', receipt: 'Recibo digital' }[v];
  $$('.steps li').forEach(li => {
    if (li.dataset.step === v) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
  });
  modal().scrollTop = 0;
}
export function openCart(v = 'cart') {
  renderCart();
  showView(v);
  if (!modal().open) modal().showModal();
}
export function closeCart() { modal().close(); }

export function initCarrito() {
  /* Recupera el estado guardado y descarta productos que ya no existen */
  state.cart = Object.fromEntries(Object.entries(store.get('me.cart', {})).filter(([id, q]) => byId(id) && q > 0));
  state.sold = store.get('me.sold', {});
  const c = store.get('me.coupon', null);
  state.coupon = c && COUPONS[c] ? c : null;

  $('#cartBtn').addEventListener('click', () => openCart('cart'));
  $('#closeModal').addEventListener('click', closeCart);
  modal().addEventListener('click', e => { if (e.target === modal()) closeCart(); });
  $$('[data-close-go]').forEach(b => b.addEventListener('click', () => { closeCart(); location.hash = b.dataset.closeGo.slice(1); }));

  $('#cartList').addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.inc) { const p = byId(t.dataset.inc); setQty(p.id, (state.cart[p.id] || 0) + stepOf(p)); }
    if (t.dataset.dec) { const p = byId(t.dataset.dec); setQty(p.id, (state.cart[p.id] || 0) - stepOf(p)); }
    if (t.dataset.del) setQty(t.dataset.del, 0);
  });

  $('#clearCart').addEventListener('click', () => {
    state.cart = {}; state.coupon = null; save();
    $('#couponMsg').textContent = '';
    refresh();
    toast('Carrito vaciado.');
  });

  $('#couponForm').addEventListener('submit', e => {
    e.preventDefault();
    const inp = $('#coupon'), msg = $('#couponMsg');
    if (!validateForm(e.target)) { msg.textContent = ''; return; }
    const code = inp.value.trim().toUpperCase();
    if (COUPONS[code]) {
      state.coupon = code; msg.className = 'coupon-msg ok'; save(); inp.value = ''; renderCart();
      toast(`Cupón ${code} aplicado.`);
    } else {
      state.coupon = null; save(); renderCart();
      msg.className = 'coupon-msg bad'; msg.textContent = 'Cupón no válido.';
      inp.setAttribute('aria-invalid', 'true');
    }
  });
  $('#coupon').addEventListener('input', () => {
    const m = $('#couponMsg');
    if (m.classList.contains('bad')) { m.textContent = ''; m.className = 'coupon-msg'; }
  });

  $('#toCheckout').addEventListener('click', () => {
    if (!Object.keys(state.cart).length) return;
    renderCart();
    showView('pay');
  });
  $('#backToCart').addEventListener('click', () => showView('cart'));
}
