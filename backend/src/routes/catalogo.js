/* catalogo.js — categorías, productos, configuración y ejemplos de la calculadora */
import express from 'express';
import { pool } from '../db.js';
import { ruta, ErrorApi } from '../errores.js';
import { leerConfiguracion } from '../services/configuracion.js';

const router = express.Router();

/* Devuelve cada producto con los MISMOS nombres de campo que usa js/productos.js del front */
const SQL_PRODUCTOS = `
  SELECT p.id_producto        AS id,
         c.slug               AS cat,
         p.nombre_producto    AS nombre,
         p.precio_unitario    AS precio,
         p.stock_actual       AS stock,
         CASE WHEN u.abreviatura = 'M' THEN 'm' ELSE u.nombre_unidad END AS unidad,
         p.color_hex          AS color,
         p.presentacion       AS "desc",
         p.incremento_venta   AS step,
         p.ancho_tela_m       AS ancho,
         p.contenido_hilo_m   AS "metrosCarrete",
         p.imagen_url         AS imagen,
         p.atributos_visuales AS visual
    FROM productos p
    JOIN categorias c      ON c.id_categoria = p.id_categoria
    JOIN unidades_medida u ON u.id_unidad    = p.id_unidad
   WHERE p.activo IS NOT FALSE AND c.activo IS NOT FALSE`;

/** Une atributos_visuales (patron, holes, tool) al objeto y quita campos vacíos. */
function aFront(row) {
  const { visual, ...p } = row;
  if (visual) Object.assign(p, typeof visual === 'string' ? JSON.parse(visual) : visual);
  for (const k of Object.keys(p)) if (p[k] === null) delete p[k];
  return p;
}

router.get('/categorias', ruta(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT slug AS id, nombre, color_hex AS color
       FROM categorias WHERE activo IS NOT FALSE ORDER BY id_categoria`
  );
  res.json(rows);
}));

router.get('/productos', ruta(async (req, res) => {
  const params = [];
  let sql = SQL_PRODUCTOS;
  if (req.query.cat && req.query.cat !== 'todo') {
    params.push(String(req.query.cat));
    sql += ' AND c.slug = $1';
  }
  const { rows } = await pool.query(sql + ' ORDER BY p.id_producto', params);
  res.json(rows.map(aFront));
}));

router.get('/productos/:id', ruta(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new ErrorApi(400, 'ID_INVALIDO', 'Id de producto no válido.');
  const { rows } = await pool.query(SQL_PRODUCTOS + ' AND p.id_producto = $1', [id]);
  if (!rows.length) throw new ErrorApi(404, 'NO_ENCONTRADO', 'Producto no encontrado.');
  res.json(aFront(rows[0]));
}));

router.get('/configuracion', ruta(async (_req, res) => {
  res.json(await leerConfiguracion(pool));
}));

router.get('/calculadora/presets', ruta(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT tipo_prenda AS nombre, largo_m AS largo, ancho_m AS ancho, piezas,
            id_producto_tela_recomendad AS "telaId", id_producto_hilo_recomendad AS "hiloId"
       FROM reglas_calculo_materiales
      WHERE largo_m IS NOT NULL AND ancho_m IS NOT NULL AND piezas IS NOT NULL
      ORDER BY id_regla`
  );
  res.json(rows);
}));

export default router;
