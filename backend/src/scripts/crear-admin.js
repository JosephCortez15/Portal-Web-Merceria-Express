/* crear-admin.js — crea (o actualiza) un usuario ADMIN con la contraseña cifrada.
 * Uso:  npm run crear-admin -- admin@merceria.com "UnaClaveSegura123"
 * La contraseña se guarda solo como hash scrypt; no queda escrita en ningún archivo.
 */
import 'dotenv/config';
import { pool } from '../db.js';
import { hashContrasena } from '../services/seguridad.js';

const [email, clave] = process.argv.slice(2);
if (!email || !clave || clave.length < 8) {
  console.error('Uso: npm run crear-admin -- correo@dominio.com "contraseña de 8+ caracteres"');
  process.exit(1);
}

const hash = await hashContrasena(clave);
await pool.query(
  `INSERT INTO usuarios (id_rol, correo_electronico, contrasena_hash)
   VALUES ((SELECT id_rol FROM roles WHERE nombre_rol = 'ADMIN'), $1, $2)
   ON CONFLICT (correo_electronico) DO UPDATE
     SET contrasena_hash = EXCLUDED.contrasena_hash, id_rol = EXCLUDED.id_rol, activo = true`,
  [email.trim().toLowerCase(), hash]);
console.log(`Administrador ${email} listo.`);
await pool.end?.();
