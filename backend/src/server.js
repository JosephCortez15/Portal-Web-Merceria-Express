/* server.js — punto de entrada de la API de Mercería Express */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './db.js';
import { ErrorApi } from './errores.js';
import catalogo from './routes/catalogo.js';
import cupones from './routes/cupones.js';
import pedidos from './routes/pedidos.js';
import auth from './routes/auth.js';
import cuenta from './routes/cuenta.js';

const app = express();
const origenes = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({ origin: origenes.length ? origenes : true }));
app.use(express.json({ limit: '50kb' }));
app.disable('x-powered-by');

app.get('/api/salud', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});

app.use('/api', catalogo);
app.use('/api', cupones);
app.use('/api', pedidos);
app.use('/api', auth);
app.use('/api', cuenta);

app.use('/api', (_req, res) => res.status(404).json({ error: 'NO_ENCONTRADO', mensaje: 'Ruta no encontrada.' }));

/* Errores: mensajes claros para el front, sin mostrar detalles internos */
app.use((err, _req, res, _next) => {
  if (err instanceof ErrorApi) {
    return res.status(err.status).json({ error: err.codigo, mensaje: err.message, detalles: err.detalles });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON_INVALIDO', mensaje: 'El cuerpo no es JSON válido.' });
  }
  console.error(err);
  res.status(500).json({ error: 'ERROR_INTERNO', mensaje: 'Ocurrió un error en el servidor. Intenta de nuevo.' });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`API Mercería Express en http://localhost:${PORT}/api`));
