/* sesion.js — middleware que identifica al usuario por el token  Authorization: Bearer <token> */
import { pool } from './db.js';
import { ErrorApi } from './errores.js';
import { hashToken } from './services/seguridad.js';

async function buscarSesion(req) {
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,})$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const { rows } = await pool.query(
    `SELECT s.id_sesion, u.id_usuario, u.correo_electronico AS email, r.nombre_rol AS rol,
            c.id_cliente, c.nombres, c.apellidos, c.telefono
       FROM sesiones s
       JOIN usuarios u ON u.id_usuario = s.id_usuario
       JOIN roles r    ON r.id_rol     = u.id_rol
       LEFT JOIN perfil_cliente c ON c.id_usuario = u.id_usuario
      WHERE s.token_hash = $1 AND NOT s.revocada AND s.expira_en > now() AND u.activo`,
    [hashToken(m[1])]);
  return rows[0] || null;
}

/** Exige sesión iniciada (401 si no hay). */
export const requiereSesion = (req, _res, next) => {
  buscarSesion(req).then(u => {
    if (!u) return next(new ErrorApi(401, 'SIN_SESION', 'Tu sesión expiró. Inicia sesión de nuevo.'));
    req.usuario = u;
    next();
  }).catch(next);
};

/** Si hay sesión la carga en req.usuario; si no, sigue igual. */
export const sesionOpcional = (req, _res, next) => {
  buscarSesion(req).then(u => { req.usuario = u; next(); }).catch(next);
};

/** Forma pública del usuario (nunca incluye el hash de la contraseña). */
export const usuarioPublico = u => ({
  id: u.id_usuario,
  nombre: [u.nombres, u.apellidos].filter(Boolean).join(' '),
  email: u.email,
  telefono: u.telefono || null,
  rol: u.rol
});
