/* cupones.js — busca y valida un cupón de descuento */
import { ErrorApi } from '../errores.js';

/**
 * Devuelve el cupón si es válido; si no, lanza ErrorApi 422 con el motivo.
 * @param subtotal   para verificar monto_minimo_compra (opcional)
 * @param bloquear   true dentro de una compra (SELECT … FOR UPDATE para contar bien los usos)
 * @param idCliente  para verificar limite_por_usuario (opcional)
 */
export async function validarCupon(db, codigo, { subtotal = null, bloquear = false, idCliente = null } = {}) {
  const cod = String(codigo || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{1,20}$/.test(cod)) throw new ErrorApi(422, 'CUPON_INVALIDO', 'Cupón no válido.');

  const { rows } = await db.query(
    `SELECT id_cupon, codigo_cupon, tipo_descuento, valor_descuento, monto_minimo_compra,
            limite_usos_total, limite_por_usuario, usos_actuales AS usos, activo,
            now() BETWEEN fecha_inicio AND fecha_fin AS vigente
       FROM cupones_descuento WHERE codigo_cupon = $1 ${bloquear ? 'FOR UPDATE' : ''}`,
    [cod]
  );
  const c = rows[0];
  if (!c || !c.activo) throw new ErrorApi(422, 'CUPON_INVALIDO', 'Cupón no válido.');
  if (!c.vigente) throw new ErrorApi(422, 'CUPON_VENCIDO', 'El cupón no está vigente.');
  if (c.limite_usos_total != null && c.usos >= c.limite_usos_total)
    throw new ErrorApi(422, 'CUPON_AGOTADO', 'El cupón ya alcanzó su límite de usos.');
  if (subtotal != null && c.monto_minimo_compra != null && subtotal < c.monto_minimo_compra)
    throw new ErrorApi(422, 'CUPON_MINIMO', `El cupón requiere una compra mínima de Bs ${Number(c.monto_minimo_compra).toFixed(2)}.`);
  if (idCliente && c.limite_por_usuario != null) {
    const usados = (await db.query(
      'SELECT count(*)::int AS n FROM cupones_uso WHERE id_cupon = $1 AND id_cliente = $2', [c.id_cupon, idCliente])).rows[0].n;
    if (usados >= c.limite_por_usuario) throw new ErrorApi(422, 'CUPON_YA_USADO', 'Ya usaste este cupón en una compra anterior.');
  }

  return {
    id: c.id_cupon,
    codigo: c.codigo_cupon,
    tipo: c.tipo_descuento,
    valor: c.valor_descuento,
    porcentaje: c.tipo_descuento === 'PORCENTAJE' ? c.valor_descuento : null
  };
}
