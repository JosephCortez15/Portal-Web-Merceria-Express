/* auth.js — registro, inicio y cierre de sesión (RF-05) */
import express from 'express';
import { pool, enTransaccion } from '../db.js';
import { ruta, ErrorApi } from '../errores.js';
import { requiereSesion, usuarioPublico } from '../sesion.js';
import {
  hashContrasena, verificarContrasena, hashSenuelo, nuevoToken, hashToken, DURACION_SESION_DIAS
} from '../services/seguridad.js';

const router = express.Router();
const MAX_INTENTOS = 5, MINUTOS_BLOQUEO = 15;

const texto = v => (typeof v === 'string' ? v.trim() : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Crea la sesión y devuelve el token (solo esta vez viaja en claro). */
async function abrirSesion(db, idUsuario, userAgent) {
  const token = nuevoToken();
  await db.query(
    `INSERT INTO sesiones (id_usuario, token_hash, expira_en, user_agent)
     VALUES ($1, $2, now() + ($3 || ' days')::interval, $4)`,
    [idUsuario, hashToken(token), String(DURACION_SESION_DIAS), String(userAgent || '').slice(0, 255)]);
  await db.query('UPDATE usuarios SET ultimo_acceso = now(), intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id_usuario = $1', [idUsuario]);
  return token;
}

async function datosUsuario(db, idUsuario) {
  const { rows } = await db.query(
    `SELECT u.id_usuario, u.correo_electronico AS email, r.nombre_rol AS rol, c.nombres, c.apellidos, c.telefono
       FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol
       LEFT JOIN perfil_cliente c ON c.id_usuario = u.id_usuario
      WHERE u.id_usuario = $1`, [idUsuario]);
  return usuarioPublico(rows[0]);
}

/* ---------- POST /api/auth/registro  { nombre, email, password } ---------- */
router.post('/auth/registro', ruta(async (req, res) => {
  const nombre = texto(req.body?.nombre);
  const email = texto(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const errores = {};
  if (nombre.length < 3 || nombre.length > 100) errores.registerName = 'Escribe al menos 3 caracteres.';
  if (!EMAIL.test(email) || email.length > 100) errores.registerEmail = 'Correo no válido.';
  if (password.length < 8 || password.length > 128) errores.registerPassword = 'La contraseña debe tener entre 8 y 128 caracteres.';
  if (Object.keys(errores).length) throw new ErrorApi(400, 'DATOS_INVALIDOS', 'Revisa los datos del formulario.', errores);

  const hash = await hashContrasena(password);   // la contraseña en claro no sale de esta función
  const resultado = await enTransaccion(async db => {
    const existe = await db.query('SELECT 1 FROM usuarios WHERE correo_electronico = $1', [email]);
    if (existe.rows.length) throw new ErrorApi(409, 'CORREO_EXISTE', 'Ya existe una cuenta con ese correo.');
    const { rows } = await db.query(
      `INSERT INTO usuarios (id_rol, correo_electronico, contrasena_hash)
       VALUES ((SELECT id_rol FROM roles WHERE nombre_rol = 'CLIENTE'), $1, $2) RETURNING id_usuario`, [email, hash]);
    const id = rows[0].id_usuario;
    await db.query('INSERT INTO perfil_cliente (id_usuario, nombres) VALUES ($1, $2)', [id, nombre]);
    const token = await abrirSesion(db, id, req.headers['user-agent']);
    return { token, usuario: await datosUsuario(db, id) };
  });
  res.status(201).json(resultado);
}));

/* ---------- POST /api/auth/login  { email, password } ---------- */
router.post('/auth/login', ruta(async (req, res) => {
  const email = texto(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const incorrecto = new ErrorApi(401, 'CREDENCIALES', 'Correo o contraseña incorrectos.');
  if (!email || !password) throw incorrecto;

  const { rows } = await pool.query(
    `SELECT id_usuario, contrasena_hash, intentos_fallidos, activo,
            bloqueado_hasta > now() AS bloqueado,
            CEIL(EXTRACT(EPOCH FROM (bloqueado_hasta - now())) / 60) AS minutos
       FROM usuarios WHERE correo_electronico = $1`, [email]);
  const u = rows[0];

  if (!u) { await verificarContrasena(password, await hashSenuelo()); throw incorrecto; }
  if (u.bloqueado) {
    throw new ErrorApi(429, 'CUENTA_BLOQUEADA', `Demasiados intentos. Intenta de nuevo en ${u.minutos} minuto(s).`);
  }
  const ok = u.activo && await verificarContrasena(password, u.contrasena_hash);
  if (!ok) {
    const intentos = u.intentos_fallidos + 1;
    if (intentos >= MAX_INTENTOS) {
      // 5 intentos fallidos seguidos: bloqueo temporal y el contador vuelve a 0
      await pool.query(
        `UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = now() + ($2 || ' minutes')::interval
          WHERE id_usuario = $1`, [u.id_usuario, String(MINUTOS_BLOQUEO)]);
    } else {
      await pool.query('UPDATE usuarios SET intentos_fallidos = $2 WHERE id_usuario = $1', [u.id_usuario, intentos]);
    }
    throw incorrecto;
  }
  const token = await abrirSesion(pool, u.id_usuario, req.headers['user-agent']);
  res.json({ token, usuario: await datosUsuario(pool, u.id_usuario) });
}));

/* ---------- POST /api/auth/logout ---------- */
router.post('/auth/logout', requiereSesion, ruta(async (req, res) => {
  await pool.query('UPDATE sesiones SET revocada = true WHERE id_sesion = $1', [req.usuario.id_sesion]);
  res.json({ ok: true });
}));

/* ---------- GET /api/auth/yo  (¿quién soy?, para restaurar la sesión al recargar) ---------- */
router.get('/auth/yo', requiereSesion, ruta(async (req, res) => {
  res.json({ usuario: usuarioPublico(req.usuario) });
}));

export default router;
