/* cuenta.js — historial de compras y lista de deseados del usuario con sesión */
import express from 'express';
import { pool } from '../db.js';
import { ruta, ErrorApi } from '../errores.js';
import { requiereSesion } from '../sesion.js';

const router = express.Router();

/** Algunas cuentas (por ejemplo ADMIN) pueden no tener perfil de cliente. */
function idCliente(req) {
  if (!req.usuario.id_cliente) throw new ErrorApi(403, 'SIN_PERFIL', 'Esta cuenta no tiene perfil de cliente.');
  return req.usuario.id_cliente;
}

/* ---------- GET /api/cuenta/pedidos — historial para "Mi cuenta" ---------- */
router.get('/cuenta/pedidos', requiereSesion, ruta(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.numero_orden_publico AS numero, p.fecha_creacion AS fecha, p.total_pagar AS total, p.estado_pedido AS estado,
            (SELECT json_agg(json_build_object('nombre', d.nombre_producto_historico,
                                               'cantidad', d.cantidad_comprada) ORDER BY d.id_detalle)
               FROM pedidos_detalle d WHERE d.id_pedido = p.id_pedido) AS lineas
       FROM pedidos_cabecera p
      WHERE p.id_cliente = $1
      ORDER BY p.fecha_creacion DESC
      LIMIT 50`, [idCliente(req)]);
  res.json(rows.map(r => ({ ...r, fecha: new Date(r.fecha).toISOString() })));
}));

/* ---------- Lista de deseados (RF-06) ---------- */
async function listaIds(idC) {
  const { rows } = await pool.query(
    'SELECT id_producto FROM lista_deseados WHERE id_cliente = $1 ORDER BY fecha_agregado', [idC]);
  return rows.map(r => r.id_producto);
}

const idProducto = req => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new ErrorApi(400, 'ID_INVALIDO', 'Id de producto no válido.');
  return id;
};

router.get('/deseados', requiereSesion, ruta(async (req, res) => {
  res.json(await listaIds(idCliente(req)));
}));

router.put('/deseados/:id', requiereSesion, ruta(async (req, res) => {
  const idC = idCliente(req);
  await pool.query(
    `INSERT INTO lista_deseados (id_cliente, id_producto)
     SELECT $1, id_producto FROM productos WHERE id_producto = $2 AND activo
     ON CONFLICT DO NOTHING`, [idC, idProducto(req)]);
  res.json(await listaIds(idC));
}));

router.delete('/deseados/:id', requiereSesion, ruta(async (req, res) => {
  const idC = idCliente(req);
  await pool.query('DELETE FROM lista_deseados WHERE id_cliente = $1 AND id_producto = $2', [idC, idProducto(req)]);
  res.json(await listaIds(idC));
}));

/** Une los deseados guardados en el navegador (antes de iniciar sesión) con los de la cuenta. */
router.post('/deseados/sincronizar', requiereSesion, ruta(async (req, res) => {
  const idC = idCliente(req);
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger).slice(0, 200) : [];
  if (ids.length) {
    await pool.query(
      `INSERT INTO lista_deseados (id_cliente, id_producto)
       SELECT $1, id_producto FROM productos WHERE id_producto = ANY($2::int[]) AND activo
       ON CONFLICT DO NOTHING`, [idC, ids]);
  }
  res.json(await listaIds(idC));
}));

export default router;
