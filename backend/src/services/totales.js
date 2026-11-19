/* totales.js — misma fórmula que js/carrito.js del front, pero calculada en el servidor */

export const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * @param lineas  [{ precio, cantidad }]
 * @param cupon   { tipo: 'PORCENTAJE'|'MONTO_FIJO', valor } o null
 * @param cfg     { iva, envio, envioGratis }
 */
export function calcularTotales(lineas, cupon, cfg) {
  const subtotal = r2(lineas.reduce((s, l) => s + l.precio * l.cantidad, 0));
  let descuento = 0;
  if (cupon) {
    descuento = cupon.tipo === 'PORCENTAJE'
      ? r2(subtotal * cupon.valor / 100)
      : r2(Math.min(cupon.valor, subtotal));
  }
  const base = r2(subtotal - descuento);
  const iva = r2(base * cfg.iva);
  const envio = lineas.length ? (base >= cfg.envioGratis ? 0 : cfg.envio) : 0;
  return { subtotal, descuento, iva, envio, total: r2(base + iva + envio) };
}
