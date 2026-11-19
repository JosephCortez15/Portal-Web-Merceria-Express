/* configuracion.js — lee configuracion_sistema y la entrega con nombres que entiende el front */

const DEFECTO = {
  IVA_PORCENTAJE: 13,
  COSTO_ENVIO: 20,
  ENVIO_GRATIS_DESDE: 250,
  CALC_MARGEN_DESPERDICIO: 0.10,
  CALC_COSTURA_M: 0.05,
  CALC_PASADAS_HILO: 3,
  CALC_EXTRA_HILO: 0.15,
  CALC_REDONDEO_TELA_M: 0.5,
  CALC_ANCHOS_TELA: '1.40,1.50,1.60'
};

export async function leerConfiguracion(db) {
  const { rows } = await db.query(
    'SELECT clave_configuracion AS clave, valor_numerico AS num, valor_texto AS txt FROM configuracion_sistema'
  );
  const c = { ...DEFECTO };
  for (const r of rows) c[r.clave] = r.num ?? r.txt;

  return {
    iva: c.IVA_PORCENTAJE / 100,          // 0.13
    envio: c.COSTO_ENVIO,                 // 20
    envioGratis: c.ENVIO_GRATIS_DESDE,    // 250
    calc: {
      margen: c.CALC_MARGEN_DESPERDICIO,
      costura: c.CALC_COSTURA_M,
      pasadas: c.CALC_PASADAS_HILO,
      extraHilo: c.CALC_EXTRA_HILO,
      redondeoTela: c.CALC_REDONDEO_TELA_M,
      anchosTela: String(c.CALC_ANCHOS_TELA).split(',').map(Number).filter(n => n > 0)
    }
  };
}
