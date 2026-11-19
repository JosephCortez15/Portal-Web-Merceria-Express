/* db.js — conexión a PostgreSQL */
import pg from 'pg';

// Los campos decimal/numeric llegan como texto por defecto; los convertimos a número
pg.types.setTypeParser(1700, v => (v === null ? null : parseFloat(v)));

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

/** Ejecuta fn(client) dentro de una transacción (BEGIN / COMMIT / ROLLBACK). */
export async function enTransaccion(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
