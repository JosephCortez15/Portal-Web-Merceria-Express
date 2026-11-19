/* errores.js — error con código HTTP para responder al front con un mensaje claro */
export class ErrorApi extends Error {
  constructor(status, codigo, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

/** Envuelve un handler async para que sus errores lleguen al middleware de errores. */
export const ruta = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
