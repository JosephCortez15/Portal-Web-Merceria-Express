-- =====================================================================
--  Mercería Express — reiniciar.sql
--  BORRA todas las tablas del proyecto para volver a crearlas desde cero.
--  Usar si ya se cargo una versión anterior en Neon y aún no
--  se tiene datos reales que conservar
-- =====================================================================
DROP VIEW  IF EXISTS v_ventas_por_producto, v_pedidos_resumen CASCADE;
DROP TABLE IF EXISTS
  notificaciones,
  historial_estados_pedido, cupones_uso, lista_deseados, transacciones_pago,
  kardex_inventario, pedidos_detalle, pedidos_cabecera, reglas_calculo_materiales,
  variaciones_producto, productos, unidades_medida, categorias, cupones_descuento,
  direcciones_envio, perfil_cliente, sesiones, usuarios, roles, configuracion_sistema
CASCADE;
DROP FUNCTION IF EXISTS fn_kardex_actualiza_stock() CASCADE;
DROP FUNCTION IF EXISTS fn_registrar_estado_pedido() CASCADE;
DROP FUNCTION IF EXISTS fn_actualizar_fecha() CASCADE;
