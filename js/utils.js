/* utils.js — utilidades compartidas: DOM, dinero, localStorage, toast y validación HTML5 */

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
export const money = n => 'Bs ' + r2(n).toFixed(2);

export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } }
};

/** Aclara (a > 0) u oscurece (a < 0) un color hex. */
export function shade(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = a < 0 ? 0 : 255, p = Math.abs(a);
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ---------- Validación (HTML5 nativa + retroalimentación visual) ---------- */
export function errMsg(el) {
  const v = el.validity;
  if (v.valueMissing) return 'Completa este campo.';
  if (v.typeMismatch) return 'Revisa el formato, por ejemplo nombre@correo.com.';
  if (v.patternMismatch) return el.dataset.msg || 'Formato no válido.';
  if (v.rangeUnderflow) return `El valor mínimo es ${el.min}.`;
  if (v.rangeOverflow) return `El valor máximo es ${el.max}.`;
  if (v.stepMismatch) return `Usa pasos de ${el.step}.`;
  if (v.tooShort) return `Escribe al menos ${el.minLength} caracteres.`;
  if (v.customError) return el.validationMessage;
  return 'Valor no válido.';
}

export function checkField(el) {
  const err = $('#' + el.id + '-err');
  const ok = el.checkValidity();
  el.setAttribute('aria-invalid', String(!ok));
  if (err) err.textContent = ok ? '' : errMsg(el);
  return ok;
}

export function validateForm(form) {
  let first = null;
  for (const el of form.elements) {
    if (!el.id || !el.willValidate || ['submit', 'reset', 'button'].includes(el.type)) continue;
    if (!checkField(el) && !first) first = el;
  }
  first?.focus();
  return !first;
}

/* Revalida en vivo los campos que ya estaban marcados como inválidos */
document.addEventListener('input', e => {
  if (e.target.matches?.('input,select') && e.target.getAttribute('aria-invalid') === 'true') checkField(e.target);
});
