/* pedidos.js — POST /api/pedidos (checkout) y GET /api/pedidos/:numero (recibo)
 *
 * Requiere sesión iniciada (el front exige cuenta para comprar).
 * El front envía SOLO: teléfono y dirección, ids + cantidades, código de cupón y los últimos 4 dígitos.
 * Nombre y correo salen de la cuenta. Precios, descuento, IVA, envío y total se calculan aquí.
 */
import express from 'express';
import { pool, enTransaccion } from '../db.js';
import { ruta, ErrorApi } from '../errores.js';
import { requiereSesion } from '../sesion.js';
import { leerConfiguracion } from '../services/configuracion.js';
import { calcularTotales, r2 } from '../services/totales.js';
import { validarCupon } from '../services/cupones.js';

const router = express.Router();
const texto = v => (typeof v === 'string' ? v.trim() : '');

/* ---------- Validación del cuerpo (mismas reglas que el HTML del front) ---------- */
function validarCuerpo(body, usuario) {
  const b = body || {};
  const c = b.cliente || {};
  const cliente = {
    nombre: usuario.nombre || texto(c.nombre),
    email: usuario.email,
    tel: texto(c.tel),
    dir: texto(c.dir),
    ciudad: texto(c.ciudad) || null,
    nit: texto(c.nit) || null,
    razonSocial: texto(c.razonSocial) || null
  };
  const errores = {};
  if (cliente.nombre.length < 3 || cliente.nombre.length > 150) errores.nombre = 'Escribe al menos 3 caracteres.';
  if (!/^[67]\d{7}$/.test(cliente.tel)) errores.tel = '8 dígitos, empieza con 6 o 7.';
  if (cliente.dir.length < 6) errores.dir = 'Escribe al menos 6 caracteres.';
  if (cliente.ciudad && cliente.ciudad.length > 50) errores.ciudad = 'Máximo 50 caracteres.';
  if (cliente.nit && !/^[0-9A-Za-z-]{4,30}$/.test(cliente.nit)) errores.nit = 'NIT/CI no válido.';
  if (cliente.razonSocial && cliente.razonSocial.length > 100) errores.razonSocial = 'Máximo 100 caracteres.';

  const items = new Map();
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > 100) {
    errores.items = 'El carrito está vacío o es demasiado grande.';
  } else {
    for (const it of b.items) {
      const id = Number(it?.id), q = Number(it?.cantidad);
      if (!Number.isInteger(id) || !(q > 0) || q > 1000) { errores.items = 'Hay un producto o cantidad no válida.'; break; }
      items.set(id, r2((items.get(id) || 0) + q));
    }
  }

  const ultimos4 = texto(b.pago?.ultimos4);
  if (!/^\d{4}$/.test(ultimos4)) errores.card = 'Faltan los últimos 4 dígitos de la tarjeta.';

  if (Object.keys(errores).length) throw new ErrorApi(400, 'DATOS_INVALIDOS', 'Revisa los datos del formulario.', errores);
  return { cliente, items, cupon: texto(b.cupon) || null, ultimos4 };
}

/* ---------- Número de orden público: ME-AAAAMMDD-0001 (hora de Bolivia) ---------- */
function numeroOrden(id, fecha = new Date()) {
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(fecha).replaceAll('-', '');
  return `ME-${dia}-${String(id).padStart(4, '0')}`;
}

/* ---------- Recibo con la forma que pinta el front ---------- */
async function armarRecibo(db, idPedido) {
  const cab = (await db.query(
    `SELECT p.numero_orden_publico AS numero, p.fecha_creacion AS fecha, p.estado_pedido AS estado,
            p.nombre_contacto AS nombre, p.email_contacto AS email, p.telefono_contacto AS tel,
            p.direccion_entrega AS dir, p.ciudad_entrega AS ciudad, p.nit_facturacion AS nit, p.razon_social AS "razonSocial",
            p.codigo_cupon_usado AS cupon, p.porcentaje_descuento AS porcentaje,
            p.subtotal_bruto AS subtotal, p.monto_descuento_aplicado AS descuento,
            p.monto_iva_calculado AS iva, p.costo_envio AS envio, p.total_pagar AS total,
            (SELECT t.ultimos_4_digitos FROM transacciones_pago t WHERE t.id_pedido = p.id_pedido
              ORDER BY t.id_transaccion DESC LIMIT 1) AS ultimos4
       FROM pedidos_cabecera p WHERE p.id_pedido = $1`, [idPedido])).rows[0];

  const { rows: lineas } = await db.query(
    `SELECT d.id_producto AS id, d.nombre_producto_historico AS nombre,
            CASE WHEN u.abreviatura = 'M' THEN 'm' ELSE u.nombre_unidad END AS unidad,
            d.cantidad_comprada AS cantidad, d.precio_unitario_historico AS precio, d.subtotal_linea AS importe
       FROM pedidos_detalle d
       JOIN productos pr      ON pr.id_producto = d.id_producto
       JOIN unidades_medida u ON u.id_unidad    = pr.id_unidad
      WHERE d.id_pedido = $1 ORDER BY d.id_detalle`, [idPedido]);

  return {
    numero: cab.numero, fecha: new Date(cab.fecha).toISOString(), estado: cab.estado,
    cliente: { nombre: cab.nombre, email: cab.email, tel: cab.tel, dir: cab.dir, ciudad: cab.ciudad, nit: cab.nit, razonSocial: cab.razonSocial },
    lineas,
    cupon: cab.cupon ? { codigo: cab.cupon, porcentaje: cab.porcentaje } : null,
    subtotal: cab.subtotal, descuento: cab.descuento, iva: cab.iva, envio: cab.envio, total: cab.total,
    ultimos4: cab.ultimos4
  };
}

/* ---------- POST /api/pedidos ---------- */
router.post('/pedidos', requiereSesion, ruta(async (req, res) => {
  const idCliente = req.usuario.id_cliente;
  if (!idCliente) throw new ErrorApi(403, 'SIN_PERFIL', 'Esta cuenta no tiene perfil de cliente.');
  const datos = validarCuerpo(req.body, { nombre: [req.usuario.nombres, req.usuario.apellidos].filter(Boolean).join(' '), email: req.usuario.email });

  const recibo = await enTransaccion(async db => {
    const cfg = await leerConfiguracion(db);

    // 1) Bloquea las filas de los productos para que dos compras no vendan el mismo stock
    const { rows: prods } = await db.query(
      `SELECT id_producto AS id, nombre_producto AS nombre, precio_unitario AS precio,
              stock_actual AS stock, incremento_venta AS paso, activo
         FROM productos WHERE id_producto = ANY($1::int[]) FOR UPDATE`, [[...datos.items.keys()]]);
    const porId = new Map(prods.map(p => [p.id, p]));

    // 2) Verifica existencia, paso de venta (0.5 m en telas) y stock
    const problemas = [], lineas = [];
    for (const [id, cantidad] of datos.items) {
      const p = porId.get(id);
      if (!p || !p.activo) { problemas.push({ id, motivo: 'NO_DISPONIBLE' }); continue; }
      const pasos = cantidad / p.paso;
      if (Math.abs(pasos - Math.round(pasos)) > 1e-9) { problemas.push({ id, nombre: p.nombre, motivo: 'CANTIDAD_INVALIDA', paso: p.paso }); continue; }
      if (cantidad > p.stock) { problemas.push({ id, nombre: p.nombre, motivo: 'SIN_STOCK', disponible: p.stock, pedido: cantidad }); continue; }
      lineas.push({ id, nombre: p.nombre, precio: p.precio, cantidad });
    }
    if (problemas.length) throw new ErrorApi(409, 'STOCK_INSUFICIENTE', 'Algunos productos ya no tienen stock suficiente.', problemas);

    // 3) Cupón (bloqueado para contar bien los usos) y totales
    const subtotalPrevio = r2(lineas.reduce((s, l) => s + l.precio * l.cantidad, 0));
    const cupon = datos.cupon
      ? await validarCupon(db, datos.cupon, { subtotal: subtotalPrevio, bloquear: true, idCliente })
      : null;
    const t = calcularTotales(lineas, cupon, cfg);

    // 4) Cabecera (el trigger registra el estado en historial_estados_pedido)
    const id = (await db.query(`SELECT nextval(pg_get_serial_sequence('pedidos_cabecera','id_pedido')) AS id`)).rows[0].id;
    const numero = numeroOrden(id);
    const c = datos.cliente;
    await db.query(
      `INSERT INTO pedidos_cabecera (id_pedido, numero_orden_publico, id_cliente, id_cupon_aplicado,
         nombre_contacto, email_contacto, telefono_contacto, direccion_entrega, ciudad_entrega, nit_facturacion, razon_social,
         codigo_cupon_usado, porcentaje_descuento,
         subtotal_bruto, monto_descuento_aplicado, monto_iva_calculado, costo_envio, total_pagar, estado_pedido)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'PAGADO')`,
      [id, numero, idCliente, cupon?.id ?? null, c.nombre, c.email, c.tel, c.dir, c.ciudad, c.nit, c.razonSocial,
       cupon?.codigo ?? null, cupon?.porcentaje ?? null, t.subtotal, t.descuento, t.iva, t.envio, t.total]);

    // 5) Detalle + salida de inventario (el trigger del kardex descuenta productos.stock_actual)
    for (const l of lineas) {
      await db.query(
        `INSERT INTO pedidos_detalle (id_pedido, id_producto, nombre_producto_historico, cantidad_comprada, precio_unitario_historico, subtotal_linea)
         VALUES ($1,$2,$3,$4,$5,$6)`, [id, l.id, l.nombre, l.cantidad, l.precio, r2(l.precio * l.cantidad)]);
      await db.query(
        `INSERT INTO kardex_inventario (id_producto, id_pedido, tipo_movimiento, cantidad_movida, motivo_descripcion)
         VALUES ($1,$2,'SALIDA_VENTA',$3,$4)`, [l.id, id, l.cantidad, `Venta ${numero}`]);
    }

    // 6) Pago simulado (solo últimos 4 dígitos) y uso del cupón
    await db.query(
      `INSERT INTO transacciones_pago (id_pedido, metodo_pago, monto_pagado, ultimos_4_digitos, codigo_referencia_banco, estado_pago)
       VALUES ($1,'TARJETA_SIMULADA',$2,$3,$4,'APROBADO')`, [id, t.total, datos.ultimos4, `SIM-${numero}`]);
    if (cupon) {
      await db.query('UPDATE cupones_descuento SET usos_actuales = usos_actuales + 1 WHERE id_cupon = $1', [cupon.id]);
      await db.query('INSERT INTO cupones_uso (id_cupon, id_cliente, id_pedido) VALUES ($1,$2,$3)', [cupon.id, idCliente, id]);
    }

    // 7) Guarda el teléfono en el perfil si todavía no tenía uno
    await db.query('UPDATE perfil_cliente SET telefono = $2 WHERE id_cliente = $1 AND telefono IS NULL', [idCliente, c.tel]);

    return armarRecibo(db, id);
  });

  res.status(201).json(recibo);
}));

/* ---------- GET /api/pedidos/:numero — solo el dueño del pedido (o un ADMIN) ---------- */
router.get('/pedidos/:numero', requiereSesion, ruta(async (req, res) => {
  const numero = String(req.params.numero).toUpperCase();
  if (!/^ME-\d{8}-\d{4,}$/.test(numero)) throw new ErrorApi(400, 'DATOS_INVALIDOS', 'Número de orden no válido.');
  const { rows } = await pool.query(
    'SELECT id_pedido, id_cliente FROM pedidos_cabecera WHERE numero_orden_publico = $1', [numero]);
  const p = rows[0];
  if (!p || (p.id_cliente !== req.usuario.id_cliente && req.usuario.rol !== 'ADMIN')) {
    throw new ErrorApi(404, 'NO_ENCONTRADO', 'No encontramos ese pedido en tu cuenta.');
  }
  res.json(await armarRecibo(pool, p.id_pedido));
}));

export default router;
