-- =====================================================================
--  Mercería Express — 02_datos_iniciales.sql
--  Datos de arranque: los mismos que hoy están escritos en el JS del front.
--  El stock inicial entra por el KARDEX (movimiento ENTRADA), así el
--  historial de inventario cuadra desde el primer día.
-- =====================================================================
BEGIN;

INSERT INTO roles (nombre_rol) VALUES ('ADMIN'), ('CLIENTE');

INSERT INTO configuracion_sistema (clave_configuracion, valor_numerico, valor_texto, descripcion) VALUES
 ('IVA_PORCENTAJE',          13,   NULL, 'IVA aplicado sobre (subtotal - descuento)'),
 ('COSTO_ENVIO',             20,   NULL, 'Costo de envío en Bs'),
 ('ENVIO_GRATIS_DESDE',      250,  NULL, 'Envío gratis si (subtotal - descuento) >= este monto'),
 ('CALC_MARGEN_DESPERDICIO', 0.10, NULL, 'Margen de desperdicio de tela (10 %)'),
 ('CALC_COSTURA_M',          0.05, NULL, 'Margen de costura por lado en metros'),
 ('CALC_PASADAS_HILO',       3,    NULL, 'Pasadas de hilo por perímetro'),
 ('CALC_EXTRA_HILO',         0.15, NULL, 'Extra de hilo (15 %)'),
 ('CALC_REDONDEO_TELA_M',    0.50, NULL, 'Los metros de tela se redondean hacia arriba a este paso'),
 ('CALC_ANCHOS_TELA',        NULL, '1.40,1.50,1.60', 'Anchos de tela ofrecidos en la calculadora');

INSERT INTO categorias (nombre, slug, color_hex, descripcion) VALUES
 ('Hilos',           'hilos',        'var(--c-pink)',   'Hilos de poliéster y algodón'),
 ('Botones',         'botones',      'var(--c-yellow)', 'Botones por bolsa'),
 ('Cierres',         'cierres',      'var(--c-orange)', 'Cierres por pieza'),
 ('Telas por metro', 'telas',        'var(--c-cyan)',   'Telas vendidas por metro'),
 ('Herramientas',    'herramientas', 'var(--c-green)',  'Herramientas de costura');

INSERT INTO unidades_medida (nombre_unidad, abreviatura) VALUES
 ('carrete','CAR'), ('bolsa','BOL'), ('pieza','PZA'), ('metro','M'), ('set','SET'), ('caja','CAJ');

-- Productos con los MISMOS ids del front (101…505) y stock inicial en 0
CREATE TEMP TABLE _carga (id int, id_categoria int, id_unidad int, sku varchar, nombre varchar, precio decimal,
  color char(7), presentacion varchar, paso decimal, ancho decimal, hilo decimal, visual jsonb, stock decimal) ON COMMIT DROP;
INSERT INTO _carga VALUES
 (101, (SELECT id_categoria FROM categorias WHERE slug='hilos'), (SELECT id_unidad FROM unidades_medida WHERE abreviatura='CAR'), 'HIL-101', 'Hilo de poliéster rojo', 8.5, '#D6443F', '200 m', 1, NULL, 200, NULL, 24),
 (102, (SELECT id_categoria FROM categorias WHERE slug='hilos'), (SELECT id_unidad FROM unidades_medida WHERE abreviatura='CAR'), 'HIL-102', 'Hilo de algodón azul', 9, '#3F6190', '200 m', 1, NULL, 200, NULL, 18),
 (103, (SELECT id_categoria FROM categorias WHERE slug='hilos'), (SELECT id_unidad FROM unidades_medida WHERE abreviatura='CAR'), 'HIL-103', 'Hilo de poliéster verde', 8.5, '#4FA533', '200 m', 1, NULL, 200, NULL, 3),
 (104, (SELECT id_categoria FROM categorias WHERE slug='hilos'), (SELECT id_unidad FROM unidades_medida WHERE abreviatura='CAR'), 'HIL-104', 'Hilo mostaza', 8.5, '#F6CF4A', '200 m', 1, NULL, 200, NULL, 30),
 (105, (SELECT id_categoria FROM categorias WHERE slug='hilos'), (SELECT id_unidad FROM unidades_medida WHERE abreviatura='CAR'), 'HIL-105', 'Hilo rosa', 8.5, '#F08BB4', '200 m', 1, NULL, 200, NULL, 12),
 (106, (SELECT id_categoria FROM categorias WHERE slug='hilos'), (SELECT id_unidad FROM unidades_medida WHERE abreviatura='CAR'), 'HIL-106', 'Hilo naranja', 8.5, '#F29A3B', '200 m', 1, NULL, 200, NULL, 0),
 (201, (SELECT id_categoria FROM categorias WHERE slug='botones'), (SELECT id_unidad FROM unidades_medida WHERE abreviatura='BOL'), 'BOT-201', 'Botones de madera x12', 12, '#8B5A34', NULL, 1, NULL, NULL, '{"holes": 2}', 40),
 (202, (SELECT id_categoria FROM categorias WHERE slug='botones'), (SELECT id_unidad FROM unidades_medida WHERE abreviatura='BOL'), 'BOT-202', 'Botones rosa x10', 10, '#F08BB4', NULL, 1, NULL, NULL, '{"holes": 4}', 25),
 (203, (SELECT id_categoria FROM categorias WHERE slug='botones'), (SELECT id_unidad FROM unidades_medida WHERE abreviatura='BOL'), 'BOT-203', 'Botones cian x10', 10, '#4CC3E3', NULL, 1, NULL, NULL, '{"holes": 4}', 5),
 (204, (SELECT id_categoria FROM categorias WHERE slug='botones'), (SELECT id_unidad FROM unidades_medida WHERE abreviatura='BOL'), 'BOT-204', 'Botones mostaza x8', 9, '#F6CF4A', NULL, 1, NULL, NULL, '{"holes": 2}', 16),
 (301, (SELECT id_categoria FROM categorias WHERE slug='cierres'), (SELECT id_unidad FROM unidades_medida WHERE abreviatura='PZA'), 'CIE-301', 'Cierre rojo 20 cm', 6, '#D6443F', NULL, 1, NULL, NULL, NULL, 50),
 (302, (SELECT id_categoria FROM categorias WHERE slug='cierres'), (SELECT id_unidad FROM unidades_medida WHERE abreviatura='PZA'), 'CIE-302', 'Cierre azul 40 cm', 9, '#3F6190', NULL, 1, NULL, NULL, NULL, 22),
 (303, (SELECT id_categoria FROM categorias WHERE slug='cierres'), (SELECT id_unidad FROM unidades_medida WHERE abreviatura='PZA'), 'CIE-303', 'Cierre invisible 25 cm', 7.5, '#F2EEE2', NULL, 1, NULL, NULL, NULL, 14),
 (401, (SELECT id_categoria FROM categorias WHERE slug='telas'), (SELECT id_unidad FROM unidades_medida WHERE abreviatura='M'), 'TEL-401', 'Algodón a rayas cian', 32, '#4CC3E3', NULL, 0.5, 1.5, NULL, '{"patron": "rayas"}', 40),
 (402, (SELECT id_categoria FROM categorias WHERE slug='telas'), (SELECT id_unidad FROM unidades_medida WHERE abreviatura='M'), 'TEL-402', 'Popelina verde lisa', 28, '#6CC24A', NULL, 0.5, 1.5, NULL, '{"patron": "lisa"}', 25),
 (403, (SELECT id_categoria FROM categorias WHERE slug='telas'), (SELECT id_unidad FROM unidades_medida WHERE abreviatura='M'), 'TEL-403', 'Lunares sobre rosa', 35, '#F08BB4', NULL, 0.5, 1.5, NULL, '{"patron": "lunares"}', 18),
 (404, (SELECT id_categoria FROM categorias WHERE slug='telas'), (SELECT id_unidad FROM unidades_medida WHERE abreviatura='M'), 'TEL-404', 'Franela amarilla', 30, '#F6CF4A', NULL, 0.5, 1.5, NULL, '{"patron": "lisa"}', 6),
 (405, (SELECT id_categoria FROM categorias WHERE slug='telas'), (SELECT id_unidad FROM unidades_medida WHERE abreviatura='M'), 'TEL-405', 'Jean denim', 45, '#3F6190', NULL, 0.5, 1.5, NULL, '{"patron": "lisa"}', 30),
 (501, (SELECT id_categoria FROM categorias WHERE slug='herramientas'), (SELECT id_unidad FROM unidades_medida WHERE abreviatura='PZA'), 'HER-501', 'Tijeras de sastre', 65, '#F29A3B', NULL, 1, NULL, NULL, '{"tool": "tijeras"}', 9),
 (502, (SELECT id_categoria FROM categorias WHERE slug='herramientas'), (SELECT id_unidad FROM unidades_medida WHERE abreviatura='SET'), 'HER-502', 'Set de agujas', 15, '#4CC3E3', NULL, 1, NULL, NULL, '{"tool": "aguja"}', 35),
 (503, (SELECT id_categoria FROM categorias WHERE slug='herramientas'), (SELECT id_unidad FROM unidades_medida WHERE abreviatura='PZA'), 'HER-503', 'Cinta métrica', 12, '#F6CF4A', NULL, 1, NULL, NULL, '{"tool": "cinta"}', 28),
 (504, (SELECT id_categoria FROM categorias WHERE slug='herramientas'), (SELECT id_unidad FROM unidades_medida WHERE abreviatura='PZA'), 'HER-504', 'Dedal metálico', 8, '#B9C2CF', NULL, 1, NULL, NULL, '{"tool": "dedal"}', 2),
 (505, (SELECT id_categoria FROM categorias WHERE slug='herramientas'), (SELECT id_unidad FROM unidades_medida WHERE abreviatura='CAJ'), 'HER-505', 'Alfileres con cabeza', 10, '#F08BB4', NULL, 1, NULL, NULL, '{"tool": "alfiler"}', 44);

INSERT INTO productos (id_producto, id_categoria, id_unidad, codigo_sku, nombre_producto, precio_unitario,
  color_hex, presentacion, incremento_venta, ancho_tela_m, contenido_hilo_m, atributos_visuales)
SELECT id, id_categoria, id_unidad, sku, nombre, precio, color, presentacion, paso, ancho, hilo, visual FROM _carga;
SELECT setval(pg_get_serial_sequence('productos', 'id_producto'), (SELECT max(id_producto) FROM productos));

-- Stock inicial como ENTRADA en el kardex (el trigger actualiza productos.stock_actual)
INSERT INTO kardex_inventario (id_producto, tipo_movimiento, cantidad_movida, motivo_descripcion)
SELECT id, 'ENTRADA', stock, 'Inventario inicial' FROM _carga WHERE stock > 0;

INSERT INTO cupones_descuento (codigo_cupon, tipo_descuento, valor_descuento, fecha_inicio, fecha_fin, limite_por_usuario) VALUES
 ('COSTURA10',   'PORCENTAJE', 10, '2026-01-01', '2027-12-31 23:59:59-04', NULL),
 ('LANA15',      'PORCENTAJE', 15, '2026-01-01', '2027-12-31 23:59:59-04', NULL),
 ('BIENVENIDA5', 'PORCENTAJE',  5, '2026-01-01', '2027-12-31 23:59:59-04', 1);   -- una vez por cliente

INSERT INTO reglas_calculo_materiales (tipo_prenda, largo_m, ancho_m, piezas,
  id_producto_tela_recomendad, id_producto_hilo_recomendad) VALUES
 ('Cojín',    0.45, 0.45, 2, 401, 102),
 ('Falda',    0.60, 1.20, 1, 405, 102),
 ('Delantal', 0.90, 0.70, 1, 402, 104);

COMMIT;
