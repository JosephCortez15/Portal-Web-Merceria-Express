/* cupones.js — POST /api/cupones/validar  { codigo, subtotal? } */
import express from 'express';
import { pool } from '../db.js';
import { ruta, ErrorApi } from '../errores.js';
import { sesionOpcional } from '../sesion.js';
import { validarCupon } from '../services/cupones.js';

const router = express.Router();

router.post('/cupones/validar', sesionOpcional, ruta(async (req, res) => {
  const { codigo, subtotal } = req.body || {};
  try {
    const c = await validarCupon(pool, codigo, {
      subtotal: typeof subtotal === 'number' ? subtotal : null,
      idCliente: req.usuario?.id_cliente || null
    });
    res.json({ valido: true, codigo: c.codigo, tipo: c.tipo, valor: c.valor, porcentaje: c.porcentaje });
  } catch (err) {
    // Un cupón inválido no es un error del servidor: se responde 200 con valido:false
    if (err instanceof ErrorApi && err.status === 422) {
      return res.json({ valido: false, codigo: err.codigo, mensaje: err.message });
    }
    throw err;
  }
}));

export default router;
