/* api.js — única puerta de comunicación con el backend (Node.js + Express + PostgreSQL) */
import { store } from './utils.js';

// En tu PC usa el backend local; publicada en GitHub Pages usa el de Render
export const API_URL = ['localhost', '127.0.0.1'].includes(location.hostname)
  ? 'http://localhost:3000/api'
  : 'https://merceria-express-api.onrender.com/api';

/* El token de sesión lo entrega el servidor al iniciar sesión. La contraseña NUNCA se guarda en el navegador. */
const TOKEN_KEY = 'me.token';
export const getToken = () => store.get(TOKEN_KEY, null);
export const setToken = t => (t ? store.set(TOKEN_KEY, t) : store.del(TOKEN_KEY));

/** Error con el código HTTP y los datos que devolvió la API ({ error, mensaje, detalles }). */
export class ApiError extends Error {
  constructor(status, datos) {
    super(datos?.mensaje || 'No se pudo conectar con el servidor.');
    this.status = status;
    this.datos = datos || {};
  }
}

async function pedir(ruta, { method = 'GET', body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(API_URL + ruta, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, { error: 'SIN_CONEXION', mensaje: 'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.' });
  }
  const datos = await res.json().catch(() => null);
  if (res.status === 401 && token) setToken(null);   // sesión vencida o cerrada en otro lado
  if (!res.ok) throw new ApiError(res.status, datos);
  return datos;
}

/* Catálogo y configuración */
export const getCategorias = () => pedir('/categorias');
export const getProductos = () => pedir('/productos');
export const getConfiguracion = () => pedir('/configuracion');

/* Cupones y pedidos */
export const validarCupon = (codigo, subtotal) => pedir('/cupones/validar', { method: 'POST', body: { codigo, subtotal } });
export const crearPedido = datos => pedir('/pedidos', { method: 'POST', body: datos });

/* Cuentas (RF-05) */
export const registrar = (nombre, email, password) => pedir('/auth/registro', { method: 'POST', body: { nombre, email, password } });
export const iniciarSesion = (email, password) => pedir('/auth/login', { method: 'POST', body: { email, password } });
export const cerrarSesion = () => pedir('/auth/logout', { method: 'POST' });
export const getUsuarioActual = () => pedir('/auth/yo');
export const getMisPedidos = () => pedir('/cuenta/pedidos');

/* Lista de deseados (RF-06) */
export const sincronizarDeseados = ids => pedir('/deseados/sincronizar', { method: 'POST', body: { ids } });
export const agregarDeseado = id => pedir(`/deseados/${id}`, { method: 'PUT' });
export const quitarDeseado = id => pedir(`/deseados/${id}`, { method: 'DELETE' });

/* Panel de administración (solo cuentas con rol ADMIN) */
export const getPanelAdmin = () => pedir('/admin/panel');
export const guardarObservacion = (numero, note) => pedir(`/admin/ventas/${encodeURIComponent(numero)}/observacion`, { method: 'PATCH', body: { note } });
export const moverStock = (productId, direction, quantity) => pedir('/admin/inventario/movimiento', { method: 'POST', body: { productId, direction, quantity } });
export const crearProducto = datos => pedir('/admin/productos', { method: 'POST', body: datos });
export const registrarNotificacion = (to, message) => pedir('/admin/notificaciones', { method: 'POST', body: { to, message } });
