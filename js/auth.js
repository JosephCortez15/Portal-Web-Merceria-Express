/* auth.js — cuentas con el backend: registro, inicio de sesión e historial de compras (RF-05)
 * La contraseña viaja al servidor (por HTTPS al publicar) y allí se guarda solo como hash scrypt.
 * En el navegador queda únicamente el token de sesión, nunca la contraseña. */
import { $, money, toast, validateForm } from './utils.js';
import { openCart, showView } from './carrito.js';
import { getToken, setToken, registrar, iniciarSesion, cerrarSesion, getUsuarioActual, getMisPedidos } from './api.js';
import { sincronizarConCuenta, limpiarDeseadosLocales } from './deseados.js';

let checkoutPending = false;
let currentUser = null;   // { id, nombre, email, telefono, rol } que devuelve la API

export function getCurrentUser() {
  return currentUser;
}

/** Al cargar la página: si hay token guardado, pregunta al servidor quién es el usuario. */
export async function restaurarSesion() {
  if (!getToken()) return;
  try {
    currentUser = (await getUsuarioActual()).usuario;
    await sincronizarConCuenta().catch(() => {});
  } catch {
    currentUser = null;   // token vencido o servidor caído: se pedirá iniciar sesión
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

const fechaCorta = iso => new Date(iso).toLocaleString('es-BO', { dateStyle: 'long', timeStyle: 'short' });
const cantidad = q => (Number.isInteger(q) ? String(q) : q.toFixed(1));

/** Pinta el historial de compras guardado en la base de datos. */
export async function renderSales() {
  if (!currentUser) return;
  $('#salesHistory').innerHTML = '<p class="placeholder-result">Cargando tus compras…</p>';
  try {
    const sales = await getMisPedidos();
    $('#salesHistory').innerHTML = sales.length
      ? `<ul class="sales-list">${sales.map(sale => `
          <li><div><b>${escapeHTML(sale.numero)}</b><span>${escapeHTML(fechaCorta(sale.fecha))}</span>
            <span>${(sale.lineas || []).map(line => `${escapeHTML(line.nombre)} × ${escapeHTML(cantidad(line.cantidad))}`).join(', ')}</span></div>
            <b>${money(sale.total)}</b></li>`).join('')}</ul>`
      : '<p class="placeholder-result">Todavía no tienes compras registradas.</p>';
  } catch (error) {
    $('#salesHistory').innerHTML = `<p class="placeholder-result">${escapeHTML(error.message)}</p>`;
  }
}

function updateAccountUI() {
  const user = getCurrentUser();
  $('#accountBtn').textContent = user ? 'Mi cuenta' : 'Iniciar sesión';
  $('#accountForms').hidden = Boolean(user);
  $('#accountProfile').hidden = !user;
  $('#nombre').readOnly = Boolean(user);
  $('#email').readOnly = Boolean(user);
  if (user) {
    $('#accountGreeting').textContent = `Hola, ${user.nombre}`;
    $('#accountEmail').textContent = user.email;
    renderSales();
    $('#nombre').value = user.nombre;
    $('#email').value = user.email;
    if (user.telefono && !$('#tel').value) $('#tel').value = user.telefono;
  } else {
    $('#nombre').value = '';
    $('#email').value = '';
  }
}

function clearStatus() {
  $('#accountMsg').textContent = '';
  $('#registerMsg').textContent = '';
}

function setAuthMode(mode) {
  const registering = mode === 'register';
  clearStatus();
  $('#loginForm').hidden = registering;
  $('#registerForm').hidden = !registering;
  $('#authTitle').textContent = registering ? 'Crea tu cuenta' : 'Qué bueno verte';
  $('#authDescription').textContent = registering
    ? 'Regístrate y guarda tus compras para volver a tus ideas cuando quieras.'
    : 'Inicia sesión para guardar tus compras y seguir creando.';
}

function showAuthError(message, target = '#accountMsg') {
  const status = $(target);
  status.className = 'coupon-msg bad';
  status.textContent = message;
}

function showUserAccount() {
  updateAccountUI();
  showView('account');
}

/** El servidor respondió 401 (sesión vencida): se olvida el usuario en esta pestaña. */
export function sesionVencida() {
  currentUser = null;
  updateAccountUI();
}

export function requireAuth() {
  if (getCurrentUser()) return true;
  openCart('account');
  toast('Inicia sesión o crea una cuenta para usar el carrito.');
  return false;
}

export function requireCheckoutAuth() {
  if (getCurrentUser()) return true;
  checkoutPending = true;
  openCart('account');
  toast('Inicia sesión o crea una cuenta para continuar con el pago.');
  return false;
}

/** Después de iniciar sesión o registrarse: deseados de la cuenta y vuelta al flujo donde estaba. */
async function despuesDeEntrar(form, mensaje) {
  updateAccountUI();
  form.reset();
  await sincronizarConCuenta().catch(() => {});
  if (checkoutPending) {
    checkoutPending = false;
    openCart('pay');
  } else {
    showUserAccount();
  }
  toast(mensaje);
}

export function initAuth() {
  $('#accountBtn').addEventListener('click', () => openCart('account'));
  $('#showRegister').addEventListener('click', () => {
    setAuthMode('register');
    $('#registerName').focus();
  });
  $('#showLogin').addEventListener('click', () => {
    setAuthMode('login');
    $('#loginEmail').focus();
  });
  $('#confirmPassword').addEventListener('input', () => {
    const confirmation = $('#confirmPassword');
    confirmation.setCustomValidity(confirmation.value === $('#registerPassword').value ? '' : 'Las contraseñas no coinciden.');
  });
  $('#registerPassword').addEventListener('input', () => {
    const confirmation = $('#confirmPassword');
    if (confirmation.value) confirmation.setCustomValidity(confirmation.value === $('#registerPassword').value ? '' : 'Las contraseñas no coinciden.');
  });

  $('#loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    clearStatus();
    if (!validateForm(event.currentTarget)) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const boton = form.querySelector('[type=submit]');
    boton.disabled = true;
    try {
      const r = await iniciarSesion(String(data.get('email')).trim(), String(data.get('password')));
      setToken(r.token);
      currentUser = r.usuario;
      await despuesDeEntrar(form, `Bienvenido, ${r.usuario.nombre}.`);
    } catch (error) {
      showAuthError(error.message || 'No se pudo iniciar sesión.');
    } finally {
      boton.disabled = false;
    }
  });

  $('#registerForm').addEventListener('submit', async event => {
    event.preventDefault();
    clearStatus();
    if (!validateForm(event.currentTarget)) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const boton = form.querySelector('[type=submit]');
    boton.disabled = true;
    try {
      const r = await registrar(String(data.get('name')).trim(), String(data.get('email')).trim(), String(data.get('password')));
      setToken(r.token);
      currentUser = r.usuario;
      await despuesDeEntrar(form, 'Cuenta creada correctamente.');
    } catch (error) {
      showAuthError(error.message || 'No se pudo crear la cuenta.', '#registerMsg');
    } finally {
      boton.disabled = false;
    }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    await cerrarSesion().catch(() => {});   // invalida el token en el servidor
    setToken(null);
    currentUser = null;
    limpiarDeseadosLocales();
    updateAccountUI();
    setAuthMode('login');
    showView('account');
    toast('Sesión cerrada.');
  });
  $('#accountContinue').addEventListener('click', () => showView('cart'));
  updateAccountUI();
}
