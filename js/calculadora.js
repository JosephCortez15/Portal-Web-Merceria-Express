/* calculadora.js — RF-02: cálculo de metros de tela y carretes de hilo */
import { $, $$, r2, money, validateForm, toast } from './utils.js';
import { PRODUCTOS, byId } from './productos.js';
import { addToCart } from './carrito.js';

const CARRETE_M = 200;   // metros de hilo por carrete
const MARGEN = 0.10;     // desperdicio
const COSTURA = 0.05;    // 5 cm de costura por lado
let lastCalc = null;

export function renderCalcSelects() {
  const t = $('#telaSel').value, h = $('#hiloSel').value;
  $('#telaSel').innerHTML = PRODUCTOS.filter(p => p.cat === 'telas').map(p => `<option value="${p.id}">${p.nombre} · ${money(p.precio)}/m</option>`).join('');
  $('#hiloSel').innerHTML = PRODUCTOS.filter(p => p.cat === 'hilos').map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
  if (t) $('#telaSel').value = t;
  if (h) $('#hiloSel').value = h;
}

export function calcularMateriales(form) {
  const L = +form.largo.value, A = +form.ancho.value, n = +form.piezas.value, W = +form.anchoTela.value;
  const area = (L + COSTURA * 2) * (A + COSTURA * 2) * n;
  const metros = Math.ceil((area / W) * (1 + MARGEN) * 2) / 2;      // redondeo a 0.5 m
  const hiloM = 2 * (L + A) * n * 3 * 1.15;                         // perímetro x 3 pasadas + 15 %
  const carretes = Math.max(1, Math.ceil(hiloM / CARRETE_M));
  const tela = byId(form.telaSel.value), hilo = byId(form.hiloSel.value);
  return {
    L, A, n, W, area: r2(area), metros, hiloM: Math.round(hiloM), carretes, tela, hilo,
    costo: r2(metros * tela.precio + carretes * hilo.precio),
    ancha: Math.min(L, A) + COSTURA * 2 > W
  };
}

function paintCalc(c) {
  const pct = Math.min(100, (c.metros / 6) * 100);
  $('#calcOut').innerHTML = `
    <div class="result" id="resultBox">
      <div class="big">
        <div class="m"><b>${c.metros.toFixed(1)} m</b><span>de tela</span></div>
        <div class="h"><b>${c.carretes}</b><span>carrete${c.carretes > 1 ? 's' : ''} de hilo</span></div>
      </div>
      <div><div class="tape-wrap"><div class="tape" style="width:${pct}%" aria-hidden="true"></div></div>
        <div class="tape-label"><span>0 m</span><span>${c.metros.toFixed(1)} m de ${c.W.toFixed(2)} m de ancho</span><span>6 m</span></div></div>
      <dl>
        <dt>Área con costura (${c.n} pieza${c.n > 1 ? 's' : ''})</dt><dd>${c.area.toFixed(2)} m²</dd>
        <dt>Hilo estimado</dt><dd>${c.hiloM} m</dd>
        <dt>${c.tela.nombre}</dt><dd>${money(c.metros * c.tela.precio)}</dd>
        <dt>${c.hilo.nombre}</dt><dd>${money(c.carretes * c.hilo.precio)}</dd>
        <dt><b>Costo estimado</b></dt><dd>${money(c.costo)}</dd>
      </dl>
      ${c.ancha ? '<p class="note-warn">La pieza es más ancha que la tela. Elige una tela más ancha o reduce las medidas.</p>' : ''}
      <p class="hint">Incluye 5 cm de costura por lado y 10 % de margen. Los metros se redondean a 0.5 m.</p>
      <button class="btn btn--pink" type="button" id="calcAdd" ${c.ancha ? 'disabled' : ''}>Agregar al carrito</button>
    </div>`;
}

const PLACEHOLDER = '<p class="placeholder-result">Presiona “Calcular” para ver cuánto necesitas.</p>';

export function initCalculadora() {
  const form = $('#calcForm');
  renderCalcSelects();

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!validateForm(form)) {
      lastCalc = null;
      $('#calcOut').innerHTML = '<p class="placeholder-result">Corrige los campos marcados en rojo para calcular.</p>';
      return;
    }
    lastCalc = calcularMateriales(form);
    paintCalc(lastCalc);
  });

  /* Si el usuario cambia un dato, el resultado anterior queda atenuado y no se puede agregar */
  form.addEventListener('input', () => {
    const r = $('#resultBox');
    if (!r) return;
    r.dataset.stale = 'true';
    const b = $('#calcAdd');
    if (b) b.disabled = true;
  });

  form.addEventListener('reset', () => setTimeout(() => {
    lastCalc = null;
    $$('#calcForm [aria-invalid]').forEach(i => i.removeAttribute('aria-invalid'));
    $$('#calcForm .err').forEach(s => { s.textContent = ''; });
    $('#calcOut').innerHTML = PLACEHOLDER;
  }));

  $('.presets').addEventListener('click', e => {
    const b = e.target.closest('[data-l]');
    if (!b) return;
    form.largo.value = b.dataset.l;
    form.ancho.value = b.dataset.a;
    form.piezas.value = b.dataset.n;
    form.requestSubmit();
  });

  $('#calcOut').addEventListener('click', e => {
    if (!e.target.closest('#calcAdd') || !lastCalc) return;
    const c = lastCalc;
    const a = addToCart(c.tela.id, c.metros);
    const b = addToCart(c.hilo.id, c.carretes);
    if (a || b) toast(`Agregado: ${a.toFixed(1)} m de ${c.tela.nombre} y ${b} carrete${b === 1 ? '' : 's'}.`);
    if (a && a < c.metros) toast(`Solo había ${a.toFixed(1)} m de ${c.tela.nombre} disponibles.`);
  });

  form.requestSubmit();   // arranca con el ejemplo de la HU-01
}
