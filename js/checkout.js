/* checkout.js — RF-04: pago simulado con validación HTML5 nativa; el pedido y el recibo los genera el backend */
import { $, $$, r2, money, toast, validateForm } from './utils.js';
import { byId, recargarProductos } from './productos.js';
import { state, save, refresh, showView, available, CFG } from './carrito.js';
import { getCurrentUser, requireCheckoutAuth, renderSales, sesionVencida } from './auth.js';
import { crearPedido } from './api.js';

let lastReceipt = null;

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

const qty = l => (l.unidad === 'm' ? Number(l.cantidad).toFixed(1) + ' m' : String(l.cantidad));
const fecha = iso => new Date(iso).toLocaleString('es-BO', { dateStyle: 'long', timeStyle: 'short' });

/** Cuerpo de POST /api/pedidos. Nombre y correo salen de la cuenta; NO se envía número de tarjeta, vencimiento ni CVV. */
function datosPedido(form) {
  const f = Object.fromEntries(new FormData(form));
  return {
    cliente: { tel: f.tel, dir: f.dir },
    items: Object.entries(state.cart).map(([id, cantidad]) => ({ id: +id, cantidad })),
    cupon: state.coupon?.codigo || null,
    pago: { metodo: 'TARJETA_SIMULADA', ultimos4: String(f.card).replace(/\D/g, '').slice(-4) }
  };
}

/* El recibo se pinta con la respuesta del servidor (número de orden, fecha y totales oficiales) */
function receiptHTML(r) {
  const c = r.cliente;
  return `<h3>Mercería Express</h3>
    <div class="meta"><span>Recibo ${escapeHTML(r.numero)}</span><span>${fecha(r.fecha)}</span></div>
    <p><b>${escapeHTML(c.nombre)}</b><br>${escapeHTML(c.email)} · ${escapeHTML(c.tel)}<br>${escapeHTML(c.dir)}</p>
    <div class="table-scroll"><table><thead><tr><th>Producto</th><th>Cant.</th><th>Importe</th></tr></thead><tbody>
    ${r.lineas.map(l => `<tr><td>${escapeHTML(l.nombre)}</td><td>${qty(l)}</td><td>${money(l.importe)}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="rt"><span>Subtotal</span><span>${money(r.subtotal)}</span>
    ${r.descuento ? `<span>Descuento ${escapeHTML(r.cupon?.codigo)}${r.cupon?.porcentaje ? ` (${r.cupon.porcentaje} %)` : ''}</span><span>− ${money(r.descuento)}</span>` : ''}
    <span>IVA (${Math.round(CFG.iva * 100)} %)</span><span>${money(r.iva)}</span><span>Envío</span><span>${money(r.envio)}</span>
    <span class="tot">Total pagado</span><span class="tot">${money(r.total)}</span></div>
    <p class="meta"><span>Tarjeta terminada en ${escapeHTML(r.ultimos4)} (simulada)</span></p>
    <p class="gracias">¡Gracias por tu compra!</p>`;
}

function receiptText(r) {
  return [
    `Mercería Express — Recibo ${r.numero}`, fecha(r.fecha), `Cliente: ${r.cliente.nombre}`, '',
    ...r.lineas.map(l => `${l.nombre} x ${qty(l)} = ${money(l.importe)}`), '',
    `Subtotal: ${money(r.subtotal)}`,
    r.descuento ? `Descuento ${r.cupon?.codigo}: -${money(r.descuento)}` : null,
    `IVA: ${money(r.iva)}`, `Envío: ${money(r.envio)}`, `TOTAL: ${money(r.total)}`
  ].filter(x => x !== null).join('\n');
}

/** Stock actualizado desde la BD y carrito ajustado a lo disponible. */
async function sincronizarStock() {
  await recargarProductos();
  for (const [id, q] of Object.entries(state.cart)) {
    const p = byId(id);
    const max = p ? available(p) : 0;
    if (max <= 0) delete state.cart[id];
    else if (q > max) state.cart[id] = r2(max);
  }
  save();
  refresh();
}

/** Muestra el error de la API (con los estilos que ya existen: mensajes de campo y toast). */
async function mostrarError(err) {
  const d = err.datos || {};
  if (err.status === 401) {                       // la sesión venció
    sesionVencida();
    requireCheckoutAuth();
    return;
  }
  if (err.status === 400 && d.detalles) {         // datos del formulario
    for (const [campo, texto] of Object.entries(d.detalles)) {
      const input = $('#' + campo), span = $('#' + campo + '-err');
      if (input) input.setAttribute('aria-invalid', 'true');
      if (span) span.textContent = texto;
    }
  }
  if (err.status === 409 && Array.isArray(d.detalles)) {   // sin stock: se ajusta el carrito
    await sincronizarStock().catch(() => {});
    toast('Sin stock suficiente: ' + d.detalles.map(x =>
      x.motivo === 'SIN_STOCK' ? `${x.nombre} (quedan ${x.disponible})` : (x.nombre || 'un producto')).join(', ') + '. Ajustamos tu carrito.');
    return;
  }
  if (d.error && d.error.startsWith('CUPON')) {   // el cupón venció, se agotó o ya lo usaste
    state.coupon = null; save(); refresh();
  }
  toast(err.message);
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

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!getCurrentUser()) { requireCheckoutAuth(); return; }
    if (!validateForm(form)) return;
    const btn = form.querySelector('[type=submit]');
    const textoBoton = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Procesando…';
    try {
      lastReceipt = await crearPedido(datosPedido(form));
      $('#receipt').innerHTML = receiptHTML(lastReceipt);
      state.cart = {}; state.coupon = null; save();
      form.reset();
      $$('#payForm [aria-invalid]').forEach(i => i.removeAttribute('aria-invalid'));
      const user = getCurrentUser();              // vuelve a llenar nombre y correo de la cuenta
      $('#nombre').value = user.nombre;
      $('#email').value = user.email;
      await sincronizarStock().catch(() => refresh());
      renderSales();                              // "Mi cuenta" muestra la compra nueva
      showView('receipt');
      toast(`Pedido ${lastReceipt.numero} registrado.`);
    } catch (err) {
      await mostrarError(err);
    } finally {
      btn.disabled = false;
      btn.textContent = textoBoton;
    }
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
