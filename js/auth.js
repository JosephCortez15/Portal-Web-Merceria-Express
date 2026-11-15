/* auth.js — cuentas de demostración e historial local de compras */
import { $, money, store, toast, validateForm } from './utils.js';
import { openCart, showView } from './carrito.js';

const ACCOUNT_KEY = 'me.accounts';
const SALES_KEY = 'me.sales';
const SESSION_KEY = 'me.session';
const PBKDF2_ITERATIONS = 210000;
let checkoutPending = false;

const accounts = () => store.get(ACCOUNT_KEY, []);

export function getCurrentUser() {
  const id = store.get(SESSION_KEY, null);
  return accounts().find(account => account.id === id) || null;
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}

async function passwordHash(password, salt) {
  if (!crypto.subtle) throw new Error('El navegador no permite proteger contraseñas en este contexto. Abre el sitio con HTTPS o localhost.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt,
    iterations: PBKDF2_ITERATIONS,
    hash: 'SHA-256'
  }, key, 256);
  return new Uint8Array(bits);
}

function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i];
  return difference === 0;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function renderSales(user) {
  const sales = store.get(SALES_KEY, []).filter(sale => sale.userId === user.id);
  $('#salesHistory').innerHTML = sales.length
    ? `<ul class="sales-list">${sales.slice().reverse().map(sale => `
        <li><div><b>${escapeHTML(sale.num)}</b><span>${escapeHTML(sale.fecha)}</span>
          <span>${sale.lines.map(line => `${escapeHTML(line.name)} × ${escapeHTML(line.quantity)}`).join(', ')}</span></div>
          <b>${money(sale.total)}</b></li>`).join('')}</ul>`
    : '<p class="placeholder-result">Todavía no tienes compras registradas.</p>';
}

function updateAccountUI() {
  const user = getCurrentUser();
  $('#accountBtn').textContent = user ? 'Mi cuenta' : 'Iniciar sesión';
  $('#accountForms').hidden = Boolean(user);
  $('#accountProfile').hidden = !user;
  $('#nombre').readOnly = Boolean(user);
  $('#email').readOnly = Boolean(user);
  if (user) {
    $('#accountGreeting').textContent = `Hola, ${user.name}`;
    $('#accountEmail').textContent = user.email;
    renderSales(user);
    $('#nombre').value = user.name;
    $('#email').value = user.email;
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

export function recordSale(sale) {
  const user = getCurrentUser();
  if (!user) throw new Error('Se requiere una cuenta activa para registrar la venta.');
  const sales = store.get(SALES_KEY, []);
  sales.push({ ...sale, userId: user.id });
  store.set(SALES_KEY, sales);
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
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email')).trim().toLowerCase();
    const password = String(data.get('password'));
    const user = accounts().find(account => account.email === email);
    if (!user) {
      showAuthError('Correo o contraseña incorrectos.');
      return;
    }

    try {
      const actual = await passwordHash(password, base64ToBytes(user.salt));
      if (!sameBytes(actual, base64ToBytes(user.passwordHash))) {
        showAuthError('Correo o contraseña incorrectos.');
        return;
      }
      store.set(SESSION_KEY, user.id);
      updateAccountUI();
      event.currentTarget.reset();
      if (checkoutPending) {
        checkoutPending = false;
        openCart('pay');
      } else {
        showUserAccount();
      }
      toast(`Bienvenido, ${user.name}.`);
    } catch (error) {
      showAuthError(error.message || 'No se pudo iniciar sesión.');
    }
  });

  $('#registerForm').addEventListener('submit', async event => {
    event.preventDefault();
    clearStatus();
    if (!validateForm(event.currentTarget)) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email')).trim().toLowerCase();
    const userAccounts = accounts();
    if (userAccounts.some(account => account.email === email)) {
      showAuthError('Ya existe una cuenta con ese correo.', '#registerMsg');
      return;
    }

    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const hash = await passwordHash(String(data.get('password')), salt);
      const user = {
        id: crypto.randomUUID(),
        name: String(data.get('name')).trim(),
        email,
        salt: bytesToBase64(salt),
        passwordHash: bytesToBase64(hash),
        createdAt: new Date().toISOString()
      };
      userAccounts.push(user);
      store.set(ACCOUNT_KEY, userAccounts);
      store.set(SESSION_KEY, user.id);
      updateAccountUI();
      event.currentTarget.reset();
      if (checkoutPending) {
        checkoutPending = false;
        openCart('pay');
      } else {
        showUserAccount();
      }
      toast('Cuenta creada correctamente.');
    } catch (error) {
      showAuthError(error.message || 'No se pudo crear la cuenta.', '#registerMsg');
    }
  });

  $('#logoutBtn').addEventListener('click', () => {
    store.del(SESSION_KEY);
    updateAccountUI();
    setAuthMode('login');
    showView('account');
    toast('Sesión cerrada.');
  });
  $('#accountContinue').addEventListener('click', () => showView('cart'));
  updateAccountUI();
}
