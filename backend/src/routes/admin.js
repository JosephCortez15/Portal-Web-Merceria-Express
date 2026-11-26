/* admin.js — rutas del panel de administración. SOLO usuarios con rol ADMIN.
 * Devuelve los datos con la MISMA forma que usaba el panel de demostración del front
 * (sales, inventory, restocks, notifications), así el diseño y los gráficos no cambian.
 */
import express from 'express';
import { pool, enTransaccion } from '../db.js';
import { ruta, ErrorApi } from '../errores.js';
import { requiereSesion } from '../sesion.js';
import { r2 } from '../services/totales.js';

const router = express.Router();

/* Todas las rutas de este archivo exigen sesión + rol ADMIN */
const soloAdmin = (req, _res, next) => {
  if (req.usuario?.rol !== 'ADMIN') return next(new ErrorApi(403, 'SOLO_ADMIN', 'Esta sección es solo para administradores.'));
  next();
};
const admin = [requiereSesion, soloAdmin];

const ESTADOS = { PENDIENTE: 'Pendiente', PAGADO: 'Pagada', ENVIADO: 'Enviada', ENTREGADO: 'Entregada', CANCELADO: 'Cancelada' };
const TIPOS = { ENTRADA: 'Entrada', SALIDA_VENTA: 'Venta', AJUSTE_POS: 'Aumento de stock', AJUSTE_NEG: 'Reducción de stock', DEVOLUCION: 'Devolución' };
const UNIDAD = `CASE WHEN u.abreviatura = 'M' THEN 'm' ELSE u.nombre_unidad END`;
const texto = v => (typeof v === 'string' ? v.trim() : '');

/* ---------- Ventas (últimas 1000) ---------- */
async function leerVentas(db) {
  const { rows } = await db.query(
    `SELECT p.numero_orden_publico AS id, p.fecha_creacion AS date, p.total_pagar AS total,
            p.estado_pedido AS estado, COALESCE(p.observacion_admin, '') AS note,
            p.nombre_contacto AS cliente,
            (SELECT json_agg(json_build_object('name', d.nombre_producto_historico, 'quantity', d.cantidad_comprada,
                                               'unit', ${UNIDAD}, 'amount', d.subtotal_linea) ORDER BY d.id_detalle)
               FROM pedidos_detalle d
               JOIN productos pr      ON pr.id_producto = d.id_producto
               JOIN unidades_medida u ON u.id_unidad    = pr.id_unidad
              WHERE d.id_pedido = p.id_pedido) AS lines
       FROM pedidos_cabecera p
      ORDER BY p.fecha_creacion DESC
      LIMIT 1000`);
  return rows.map(r => ({
    id: r.id, date: new Date(r.date).toISOString(), total: Number(r.total),
    status: ESTADOS[r.estado] || r.estado, note: r.note, cliente: r.cliente,
    lines: (r.lines || []).map(l => ({ ...l, quantity: Number(l.quantity), amount: Number(l.amount) }))
  }));
}

/* ---------- Inventario real + historial del kardex (últimos 300 movimientos) ---------- */
async function leerInventario(db) {
  const { rows: inventory } = await db.query(
    `SELECT p.id_producto AS id, p.nombre_producto AS name, p.stock_actual AS stock, ${UNIDAD} AS unit,
            p.stock_minimo AS "lowAt", c.nombre AS categoria, p.precio_unitario AS precio
       FROM productos p
       JOIN unidades_medida u ON u.id_unidad    = p.id_unidad
       JOIN categorias c      ON c.id_categoria = p.id_categoria
      WHERE p.activo
      ORDER BY p.id_producto`);
  const { rows: movs } = await db.query(
    `SELECT k.id_movimiento AS id, k.fecha_movimiento AS date, k.tipo_movimiento AS tipo, k.motivo_descripcion AS motivo,
            k.id_producto AS "productId", p.nombre_producto AS "productName", k.cantidad_movida AS quantity,
            ${UNIDAD} AS unit, k.stock_resultante AS "stockAfter"
       FROM kardex_inventario k
       JOIN productos p       ON p.id_producto = k.id_producto
       JOIN unidades_medida u ON u.id_unidad   = p.id_unidad
      ORDER BY k.fecha_movimiento DESC, k.id_movimiento DESC
      LIMIT 300`);
  const num = v => (v === null ? null : Number(v));
  return {
    inventory: inventory.map(p => ({ ...p, stock: num(p.stock), lowAt: num(p.lowAt), precio: num(p.precio) })),
    restocks: movs.map(m => ({
      id: m.id, date: new Date(m.date).toISOString(), productId: m.productId, productName: m.productName,
      type: m.motivo && /^(Alta|Inventario)/.test(m.motivo) ? m.motivo : (TIPOS[m.tipo] || m.tipo),
      direction: ['SALIDA_VENTA', 'AJUSTE_NEG'].includes(m.tipo) ? 'remove' : 'add',
      quantity: num(m.quantity), unit: m.unit, stockAfter: num(m.stockAfter)
    }))
  };
}

async function leerNotificaciones(db) {
  const { rows } = await db.query(
    `SELECT id_notificacion AS id, fecha AS date, destinatario AS "to", mensaje AS message, estado
       FROM notificaciones ORDER BY fecha DESC LIMIT 200`);
  return rows.map(n => ({
    ...n, date: new Date(n.date).toISOString(),
    status: n.estado === 'SIMULADA' ? 'Simulada: no enviada' : n.estado
  }));
}

/* GET /api/admin/panel — todo lo que el panel necesita en una sola llamada */
router.get('/admin/panel', ...admin, ruta(async (_req, res) => {
  const [sales, inv, notifications, opciones] = await Promise.all([
    leerVentas(pool), leerInventario(pool), leerNotificaciones(pool),
    pool.query(`SELECT json_build_object(
                  'unidades',   (SELECT json_agg(json_build_object('id', abreviatura, 'nombre', nombre_unidad) ORDER BY id_unidad) FROM unidades_medida),
                  'categorias', (SELECT json_agg(json_build_object('id', slug, 'nombre', nombre) ORDER BY id_categoria) FROM categorias WHERE activo)
                ) AS o`)
  ]);
  const o = opciones.rows[0].o;
  res.json({ sales, ...inv, notifications, opciones: typeof o === 'string' ? JSON.parse(o) : o });
}));

/* PATCH /api/admin/ventas/:numero/observacion  { note } */
router.patch('/admin/ventas/:numero/observacion', ...admin, ruta(async (req, res) => {
  const note = texto(req.body?.note);
  if (note.length > 300) throw new ErrorApi(400, 'DATOS_INVALIDOS', 'La observación admite hasta 300 caracteres.');
  const { rows } = await pool.query(
    `UPDATE pedidos_cabecera SET observacion_admin = NULLIF($2, '')
      WHERE numero_orden_publico = $1 RETURNING numero_orden_publico`, [String(req.params.numero).toUpperCase(), note]);
  if (!rows.length) throw new ErrorApi(404, 'NO_ENCONTRADO', 'No se encontró esa venta.');
  res.json({ ok: true, id: rows[0].numero_orden_publico, note });
}));

/* POST /api/admin/inventario/movimiento  { productId, direction: 'add'|'remove', quantity } */
router.post('/admin/inventario/movimiento', ...admin, ruta(async (req, res) => {
  const id = Number(req.body?.productId);
  const quantity = Number(req.body?.quantity);
  const direction = req.body?.direction;
  if (!Number.isInteger(id)) throw new ErrorApi(400, 'DATOS_INVALIDOS', 'Selecciona un producto válido.');
  if (!(quantity > 0) || quantity > 100000 || Math.round(quantity * 100) !== quantity * 100) {
    throw new ErrorApi(400, 'DATOS_INVALIDOS', 'Ingresa una cantidad mayor que cero.');
  }
  if (!['add', 'remove'].includes(direction)) throw new ErrorApi(400, 'DATOS_INVALIDOS', 'Movimiento no válido.');

  const resultado = await enTransaccion(async db => {
    const p = (await db.query(
      `SELECT p.nombre_producto AS name, p.stock_actual AS stock, ${UNIDAD} AS unit
         FROM productos p JOIN unidades_medida u ON u.id_unidad = p.id_unidad
        WHERE p.id_producto = $1 AND p.activo FOR UPDATE OF p`, [id])).rows[0];
    if (!p) throw new ErrorApi(404, 'NO_ENCONTRADO', 'Producto no encontrado.');
    if (direction === 'remove' && quantity > Number(p.stock)) {
      throw new ErrorApi(409, 'STOCK_INSUFICIENTE', `No puedes reducir ${quantity}: el stock disponible es ${Number(p.stock)} ${p.unit}.`);
    }
    const tipo = direction === 'add' ? 'AJUSTE_POS' : 'AJUSTE_NEG';
    const { rows } = await db.query(
      `INSERT INTO kardex_inventario (id_producto, tipo_movimiento, cantidad_movida, motivo_descripcion, id_usuario)
       VALUES ($1, $2, $3, $4, $5) RETURNING stock_resultante`,
      [id, tipo, quantity, `${TIPOS[tipo]} (panel)`, req.usuario.id_usuario]);
    return { name: p.name, unit: p.unit, stockAfter: Number(rows[0].stock_resultante) };
  });
  res.status(201).json({ ok: true, ...resultado, ...(await leerInventario(pool)) });
}));

/* POST /api/admin/productos  { name, unit, categoria, precio, stock, lowAt } — alta de producto */
router.post('/admin/productos', ...admin, ruta(async (req, res) => {
  const b = req.body || {};
  const name = texto(b.name), unit = texto(b.unit).toUpperCase(), categoria = texto(b.categoria);
  const precio = Number(b.precio), stock = Number(b.stock), lowAt = Number(b.lowAt);
  const errores = {};
  if (name.length < 3 || name.length > 80) errores.newProductName = 'Escribe un nombre de 3 a 80 caracteres.';
  if (!(precio > 0) || precio > 100000) errores.newProductPrice = 'Ingresa un precio mayor que cero.';
  if (!Number.isFinite(stock) || stock < 0 || stock > 100000) errores.newProductStock = 'El stock debe ser 0 o más.';
  if (!Number.isFinite(lowAt) || lowAt < 0 || lowAt > 100000) errores.newProductLowAt = 'El umbral debe ser 0 o más.';
  if (Object.keys(errores).length) throw new ErrorApi(400, 'DATOS_INVALIDOS', Object.values(errores)[0], errores);

  const creado = await enTransaccion(async db => {
    const cat = (await db.query('SELECT id_categoria FROM categorias WHERE slug = $1 AND activo', [categoria])).rows[0];
    const uni = (await db.query('SELECT id_unidad FROM unidades_medida WHERE abreviatura = $1', [unit])).rows[0];
    if (!cat) throw new ErrorApi(400, 'DATOS_INVALIDOS', 'Elige una categoría válida.');
    if (!uni) throw new ErrorApi(400, 'DATOS_INVALIDOS', 'Elige una unidad válida.');
    const repetido = await db.query('SELECT 1 FROM productos WHERE lower(nombre_producto) = lower($1)', [name]);
    if (repetido.rows.length) throw new ErrorApi(409, 'PRODUCTO_EXISTE', 'Ya existe un producto con ese nombre.');

    const id = (await db.query(`SELECT nextval(pg_get_serial_sequence('productos','id_producto')) AS id`)).rows[0].id;
    const esTela = categoria === 'telas', esHilo = categoria === 'hilos';
    await db.query(
      `INSERT INTO productos (id_producto, id_categoria, id_unidad, codigo_sku, nombre_producto, precio_unitario,
         stock_minimo, color_hex, incremento_venta, ancho_tela_m, contenido_hilo_m)
       VALUES ($1, $2, $3, $4, $5, $6, $7, '#9AA3AD', $8, $9, $10)`,
      [id, cat.id_categoria, uni.id_unidad, `ADM-${id}`, name, r2(precio), lowAt,
       esTela ? 0.5 : 1, esTela ? 1.5 : null, esHilo ? 200 : null]);
    if (stock > 0) {
      await db.query(
        `INSERT INTO kardex_inventario (id_producto, tipo_movimiento, cantidad_movida, motivo_descripcion, id_usuario)
         VALUES ($1, 'ENTRADA', $2, 'Alta de producto', $3)`, [id, stock, req.usuario.id_usuario]);
    }
    return { id: Number(id), name };
  });
  res.status(201).json({ ok: true, ...creado, ...(await leerInventario(pool)) });
}));

/* POST /api/admin/notificaciones  { to, message } — se registra como SIMULADA (no se envía) */
router.post('/admin/notificaciones', ...admin, ruta(async (req, res) => {
  const to = texto(req.body?.to).toLowerCase(), message = texto(req.body?.message);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to.length > 100) throw new ErrorApi(400, 'DATOS_INVALIDOS', 'Correo no válido.');
  if (!message || message.length > 500) throw new ErrorApi(400, 'DATOS_INVALIDOS', 'Escribe un mensaje de hasta 500 caracteres.');
  await pool.query('INSERT INTO notificaciones (id_usuario, destinatario, mensaje) VALUES ($1, $2, $3)',
    [req.usuario.id_usuario, to, message]);
  res.status(201).json({ ok: true, notifications: await leerNotificaciones(pool) });
}));

export default router;
