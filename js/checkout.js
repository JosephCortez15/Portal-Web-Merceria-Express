/* checkout.js — RF-04: pago simulado con validación HTML5 nativa y recibo digital */
import { $, $$, r2, money, toast, validateForm } from './utils.js';
import { fmtQty } from './productos.js';
import { state, totals, save, refresh, showView } from './carrito.js';

let lastReceipt = null;

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function buildReceipt(data) {
  const t = totals(), d = new Date();
  const dateKey = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('');
  const num = 'ME-' + dateKey + '-' + String(Math.floor(1000 + Math.random() * 9000));
  return {
    num, cupon: state.coupon, t, cliente: data, ultimos: data.card.slice(-4),
    fecha: d.toLocaleString('es-BO', { dateStyle: 'long', timeStyle: 'short' })
  };
}

function receiptHTML(r) {
  const t = r.t;
  return `<h3>Mercería Express</h3>
    <div class="meta"><span>Recibo ${r.num}</span><span>${r.fecha}</span></div>
    <p><b>${escapeHTML(r.cliente.nombre)}</b><br>${escapeHTML(r.cliente.email)} · ${escapeHTML(r.cliente.tel)}<br>${escapeHTML(r.cliente.dir)}</p>
    <div class="table-scroll"><table><thead><tr><th>Producto</th><th>Cant.</th><th>Importe</th></tr></thead><tbody>
    ${t.lines.map(({ p, q }) => `<tr><td>${p.nombre}</td><td>${fmtQty(p, q)}</td><td>${money(p.precio * q)}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="rt"><span>Subtotal</span><span>${money(t.subtotal)}</span>
    ${t.pct ? `<span>Descuento ${r.cupon} (${t.pct} %)</span><span>− ${money(t.descuento)}</span>` : ''}
    <span>IVA (13 %)</span><span>${money(t.iva)}</span><span>Envío</span><span>${money(t.envio)}</span>
    <span class="tot">Total pagado</span><span class="tot">${money(t.total)}</span></div>
    <p class="meta"><span>Tarjeta terminada en ${r.ultimos} (simulada)</span></p>
    <p class="gracias">¡Gracias por tu compra!</p>`;
}

function receiptText(r) {
  const t = r.t;
  return [
    `Mercería Express — Recibo ${r.num}`, r.fecha, `Cliente: ${r.cliente.nombre}`, '',
    ...t.lines.map(({ p, q }) => `${p.nombre} x ${fmtQty(p, q)} = ${money(p.precio * q)}`), '',
    `Subtotal: ${money(t.subtotal)}`,
    t.pct ? `Descuento ${r.cupon}: -${money(t.descuento)}` : null,
    `IVA: ${money(t.iva)}`, `Envío: ${money(t.envio)}`, `TOTAL: ${money(t.total)}`
  ].filter(x => x !== null).join('\n');
}

export function initCheckout() {
  const form = $('#payForm');

  /* Máscaras de entrada */
  $('#card').addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})(?=.)/g, '$1 ');
  });
  $('#exp').addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
    e.target.value = v;
    e.target.setCustomValidity('');
    const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(v);
    if (m) {
      const now = new Date(), y = +m[2] + 2000, mo = +m[1];
      if (y < now.getFullYear() || (y === now.getFullYear() && mo < now.getMonth() + 1)) e.target.setCustomValidity('La tarjeta está vencida.');
    }
  });
  $('#cvv').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });
  $('#tel').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8); });

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validateForm(form)) return;
    lastReceipt = buildReceipt(Object.fromEntries(new FormData(form)));
    /* Descuenta del stock lo vendido */
    lastReceipt.t.lines.forEach(({ p, q }) => { state.sold[p.id] = r2((state.sold[p.id] || 0) + q); });
    $('#receipt').innerHTML = receiptHTML(lastReceipt);
    state.cart = {}; state.coupon = null; save();
    form.reset();
    $$('#payForm [aria-invalid]').forEach(i => i.removeAttribute('aria-invalid'));
    refresh();
    showView('receipt');
    toast('Pago simulado aprobado.');
  });

  $('#copyReceipt').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(receiptText(lastReceipt));
      toast('Recibo copiado.');
    } catch {
      const range = document.createRange();
      range.selectNodeContents($('#receipt'));
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      toast('Recibo seleccionado. Cópialo con Ctrl+C.');
    }
  });
}
