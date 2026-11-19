/* seguridad.js — contraseñas con scrypt y tokens de sesión (solo módulo crypto de Node, sin dependencias) */
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const N = 32768, R = 8, P = 1, LARGO = 64;           // parámetros de costo de scrypt
const MAXMEM = 128 * N * R * 2;

/**
 * Devuelve  scrypt$N$r$p$sal$hash  (sal aleatoria de 16 bytes).
 * Es irreversible: con este texto NO se puede obtener la contraseña original.
 */
export async function hashContrasena(contrasena) {
  const sal = crypto.randomBytes(16);
  const hash = await scrypt(contrasena.normalize('NFKC'), sal, LARGO, { N, r: R, p: P, maxmem: MAXMEM });
  return ['scrypt', N, R, P, sal.toString('base64'), hash.toString('base64')].join('$');
}

/** Compara en tiempo constante una contraseña con el hash guardado. */
export async function verificarContrasena(contrasena, guardado) {
  const [alg, n, r, p, salB64, hashB64] = String(guardado).split('$');
  if (alg !== 'scrypt') return false;
  const esperado = Buffer.from(hashB64, 'base64');
  const calculado = await scrypt(contrasena.normalize('NFKC'), Buffer.from(salB64, 'base64'), esperado.length,
    { N: +n, r: +r, p: +p, maxmem: 128 * +n * +r * 2 });
  return crypto.timingSafeEqual(esperado, calculado);
}

/* Hash "señuelo": cuando el correo no existe se verifica igual contra este,
   para que la respuesta tarde lo mismo y no revele qué correos están registrados. */
let senuelo = null;
export async function hashSenuelo() {
  senuelo ??= await hashContrasena(crypto.randomBytes(16).toString('hex'));
  return senuelo;
}

/** Token de sesión aleatorio (se entrega al navegador UNA vez). */
export const nuevoToken = () => crypto.randomBytes(32).toString('base64url');

/** En la BD solo se guarda el SHA-256 del token. */
export const hashToken = token => crypto.createHash('sha256').update(String(token)).digest('hex');

export const DURACION_SESION_DIAS = 7;
