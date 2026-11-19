-- =====================================================================
--  Mercería Express — 01_esquema.sql
-- =====================================================================
BEGIN;

-- ---------------------------------------------------------------------
-- Utilidad: actualiza la columna actualizado_en en cada UPDATE
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_actualizar_fecha() RETURNS trigger AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- =====================================================================
--  1. USUARIOS, ROLES Y SESIONES
-- =====================================================================
CREATE TABLE roles (
  id_rol      serial      PRIMARY KEY,
  nombre_rol  varchar(50) NOT NULL UNIQUE                 -- ADMIN, CLIENTE
);

CREATE TABLE usuarios (
  id_usuario          serial       PRIMARY KEY,
  id_rol              int          NOT NULL REFERENCES roles(id_rol),
  correo_electronico  varchar(100) NOT NULL,
  contrasena_hash     varchar(255) NOT NULL,
  fecha_registro      timestamptz  NOT NULL DEFAULT now(),
  ultimo_acceso       timestamptz,
  intentos_fallidos   int          NOT NULL DEFAULT 0,
  bloqueado_hasta     timestamptz,                         -- bloqueo temporal tras 5 intentos fallidos
  activo              boolean      NOT NULL DEFAULT true,
  CONSTRAINT ck_usuarios_correo CHECK (correo_electronico = lower(correo_electronico)
                                       AND correo_electronico ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  CONSTRAINT ck_usuarios_hash   CHECK (contrasena_hash ~ '^scrypt\$[0-9]+\$[0-9]+\$[0-9]+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$')
);
CREATE UNIQUE INDEX uq_usuarios_correo ON usuarios (correo_electronico);

CREATE TABLE sesiones (
  id_sesion   serial      PRIMARY KEY,
  id_usuario  int         NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  token_hash  char(64)    NOT NULL UNIQUE,                 -- SHA-256 en hexadecimal
  creada_en   timestamptz NOT NULL DEFAULT now(),
  expira_en   timestamptz NOT NULL,
  revocada    boolean     NOT NULL DEFAULT false,
  user_agent  varchar(255)
);
CREATE INDEX ix_sesiones_usuario ON sesiones (id_usuario);

CREATE TABLE perfil_cliente (
  id_cliente      serial       PRIMARY KEY,
  id_usuario      int          NOT NULL UNIQUE REFERENCES usuarios(id_usuario) ON DELETE CASCADE,  -- 1 a 1
  nombres         varchar(100) NOT NULL,
  apellidos       varchar(100),
  telefono        varchar(20),
  nit_facturacion varchar(30),
  razon_social    varchar(100),
  actualizado_en  timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT ck_perfil_tel CHECK (telefono IS NULL OR telefono ~ '^[67][0-9]{7}$')
);
CREATE TRIGGER trg_perfil_fecha BEFORE UPDATE ON perfil_cliente
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_fecha();

CREATE TABLE direcciones_envio (
  id_direccion  serial       PRIMARY KEY,
  id_cliente    int          NOT NULL REFERENCES perfil_cliente(id_cliente) ON DELETE CASCADE,
  etiqueta      varchar(50),                               -- Casa, Trabajo…
  direccion_c   text         NOT NULL,
  ciudad        varchar(50),
  referencia    varchar(255),
  es_principal  boolean      NOT NULL DEFAULT false
);
-- Solo una dirección principal por cliente
CREATE UNIQUE INDEX uq_direccion_principal ON direcciones_envio (id_cliente) WHERE es_principal;

-- =====================================================================
--  2. CATÁLOGO E INVENTARIO
-- =====================================================================
CREATE TABLE categorias (
  id_categoria serial       PRIMARY KEY,
  nombre       varchar(50)  NOT NULL,
  slug         varchar(30)  NOT NULL UNIQUE,               -- id que usa el front: 'hilos', 'telas'…
  color_hex    varchar(30),                                -- color del filtro
  descripcion  varchar(255),
  activo       boolean      NOT NULL DEFAULT true
);

CREATE TABLE unidades_medida (
  id_unidad     serial      PRIMARY KEY,
  nombre_unidad varchar(50) NOT NULL,
  abreviatura   varchar(10) NOT NULL UNIQUE
);

CREATE TABLE productos (
  id_producto        serial        PRIMARY KEY,
  id_categoria       int           NOT NULL REFERENCES categorias(id_categoria),
  id_unidad          int           NOT NULL REFERENCES unidades_medida(id_unidad),
  codigo_sku         varchar(50)   NOT NULL UNIQUE,
  nombre_producto    varchar(100)  NOT NULL,
  descripcion        text,
  precio_unitario    decimal(10,2) NOT NULL CHECK (precio_unitario > 0),
  stock_actual       decimal(10,2) NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  stock_minimo       decimal(10,2) NOT NULL DEFAULT 5,
  color_hex          char(7)       CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  presentacion       varchar(50),                          -- '200 m'
  incremento_venta   decimal(10,2) NOT NULL DEFAULT 1 CHECK (incremento_venta > 0),  -- 0.5 en telas
  ancho_tela_m       decimal(4,2),                         -- solo telas
  contenido_hilo_m   decimal(10,2),                        -- solo hilos
  atributos_visuales jsonb,                                -- patron / holes / tool (dibujo SVG del front)
  imagen_url         varchar(255),
  activo             boolean       NOT NULL DEFAULT true,
  creado_en          timestamptz   NOT NULL DEFAULT now(),
  actualizado_en     timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX ix_productos_categoria ON productos (id_categoria);
CREATE TRIGGER trg_productos_fecha BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_fecha();

-- Reservada para variantes futuras (talla/color de un mismo producto). El front actual no la usa.
CREATE TABLE variaciones_producto (
  id_variacion     serial        PRIMARY KEY,
  id_producto      int           NOT NULL REFERENCES productos(id_producto) ON DELETE CASCADE,
  color            varchar(50),
  tamano           varchar(50),
  stock_especifico decimal(10,2) CHECK (stock_especifico IS NULL OR stock_especifico >= 0)
);

CREATE TABLE reglas_calculo_materiales (
  id_regla                    serial       PRIMARY KEY,
  tipo_prenda                 varchar(100) NOT NULL UNIQUE,  -- Cojín, Falda, Delantal
  largo_m                     decimal(4,2) NOT NULL CHECK (largo_m > 0),
  ancho_m                     decimal(4,2) NOT NULL CHECK (ancho_m > 0),
  piezas                      int          NOT NULL CHECK (piezas BETWEEN 1 AND 50),
  factor_multiplicador_tela   decimal(8,4),                  -- opcional (no lo usa la fórmula del front)
  metros_hilo_base            decimal(5,2),                  -- opcional
  id_producto_tela_recomendad int REFERENCES productos(id_producto),
  id_producto_hilo_recomendad int REFERENCES productos(id_producto)
);

-- =====================================================================
--  3. LISTA DE DESEADOS (RF-06)
-- =====================================================================
CREATE TABLE lista_deseados (
  id_cliente     int         NOT NULL REFERENCES perfil_cliente(id_cliente) ON DELETE CASCADE,
  id_producto    int         NOT NULL REFERENCES productos(id_producto) ON DELETE CASCADE,
  fecha_agregado timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id_cliente, id_producto)
);

-- =====================================================================
--  4. CUPONES
-- =====================================================================
CREATE TABLE cupones_descuento (
  id_cupon            serial        PRIMARY KEY,
  codigo_cupon        varchar(20)   NOT NULL UNIQUE CHECK (codigo_cupon ~ '^[A-Z0-9]{1,20}$'),
  tipo_descuento      varchar(20)   NOT NULL CHECK (tipo_descuento IN ('PORCENTAJE', 'MONTO_FIJO')),
  valor_descuento     decimal(10,2) NOT NULL,
  monto_minimo_compra decimal(10,2),
  fecha_inicio        timestamptz   NOT NULL,
  fecha_fin           timestamptz   NOT NULL,
  limite_usos_total   int,                                  -- NULL = sin límite
  limite_por_usuario  int,                                  -- NULL = sin límite (BIENVENIDA5 = 1)
  usos_actuales       int           NOT NULL DEFAULT 0,
  activo              boolean       NOT NULL DEFAULT true,
  CONSTRAINT ck_cupon_valor  CHECK (valor_descuento > 0 AND (tipo_descuento <> 'PORCENTAJE' OR valor_descuento <= 100)),
  CONSTRAINT ck_cupon_fechas CHECK (fecha_fin > fecha_inicio)
);

-- =====================================================================
--  5. PEDIDOS Y PAGOS
-- =====================================================================
CREATE TABLE pedidos_cabecera (
  id_pedido                serial        PRIMARY KEY,
  numero_orden_publico     varchar(20)   NOT NULL UNIQUE,  -- ME-AAAAMMDD-0001
  id_cliente               int           NOT NULL REFERENCES perfil_cliente(id_cliente),
  id_direccion_envio       int           REFERENCES direcciones_envio(id_direccion),
  id_cupon_aplicado        int           REFERENCES cupones_descuento(id_cupon),
  fecha_creacion           timestamptz   NOT NULL DEFAULT now(),
  -- Copia de los datos de entrega tal como se usaron en la compra
  nombre_contacto          varchar(150)  NOT NULL,
  email_contacto           varchar(100)  NOT NULL,
  telefono_contacto        varchar(20)   NOT NULL,
  direccion_entrega        text          NOT NULL,
  ciudad_entrega           varchar(50),
  nit_facturacion          varchar(30),
  razon_social             varchar(100),
  -- Copia del cupón y montos
  codigo_cupon_usado       varchar(20),
  porcentaje_descuento     decimal(5,2),
  subtotal_bruto           decimal(10,2) NOT NULL CHECK (subtotal_bruto >= 0),
  monto_descuento_aplicado decimal(10,2) NOT NULL DEFAULT 0 CHECK (monto_descuento_aplicado >= 0),
  monto_iva_calculado      decimal(10,2) NOT NULL CHECK (monto_iva_calculado >= 0),
  costo_envio              decimal(10,2) NOT NULL CHECK (costo_envio >= 0),
  total_pagar              decimal(10,2) NOT NULL,
  estado_pedido            varchar(30)   NOT NULL DEFAULT 'PENDIENTE'
                           CHECK (estado_pedido IN ('PENDIENTE', 'PAGADO', 'ENVIADO', 'ENTREGADO', 'CANCELADO')),
  CONSTRAINT ck_pedido_total CHECK (total_pagar = subtotal_bruto - monto_descuento_aplicado + monto_iva_calculado + costo_envio)
);
CREATE INDEX ix_pedidos_cliente ON pedidos_cabecera (id_cliente, fecha_creacion DESC);

CREATE TABLE pedidos_detalle (
  id_detalle                serial        PRIMARY KEY,
  id_pedido                 int           NOT NULL REFERENCES pedidos_cabecera(id_pedido) ON DELETE CASCADE,
  id_producto               int           NOT NULL REFERENCES productos(id_producto),
  id_variacion              int           REFERENCES variaciones_producto(id_variacion),
  nombre_producto_historico varchar(100)  NOT NULL,          -- por si luego cambian el nombre
  cantidad_comprada         decimal(10,2) NOT NULL CHECK (cantidad_comprada > 0),
  precio_unitario_historico decimal(10,2) NOT NULL CHECK (precio_unitario_historico > 0),
  subtotal_linea            decimal(10,2) NOT NULL
);
CREATE INDEX ix_detalle_pedido ON pedidos_detalle (id_pedido);

CREATE TABLE historial_estados_pedido (
  id_historial    serial      PRIMARY KEY,
  id_pedido       int         NOT NULL REFERENCES pedidos_cabecera(id_pedido) ON DELETE CASCADE,
  estado_anterior varchar(30),
  estado_nuevo    varchar(30) NOT NULL,
  fecha_cambio    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cupones_uso (
  id_uso     serial      PRIMARY KEY,
  id_cupon   int         NOT NULL REFERENCES cupones_descuento(id_cupon),
  id_cliente int         NOT NULL REFERENCES perfil_cliente(id_cliente),
  id_pedido  int         NOT NULL UNIQUE REFERENCES pedidos_cabecera(id_pedido) ON DELETE CASCADE,
  fecha_uso  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_cupones_uso ON cupones_uso (id_cupon, id_cliente);

CREATE TABLE transacciones_pago (
  id_transaccion          serial        PRIMARY KEY,
  id_pedido               int           NOT NULL REFERENCES pedidos_cabecera(id_pedido) ON DELETE CASCADE,
  metodo_pago             varchar(50)   NOT NULL,
  monto_pagado            decimal(10,2) NOT NULL,
  fecha_pago              timestamptz   NOT NULL DEFAULT now(),
  codigo_referencia_banco varchar(100),
  ultimos_4_digitos       char(4)       CHECK (ultimos_4_digitos ~ '^[0-9]{4}$'),  -- NUNCA el número completo ni el CVV
  estado_pago             varchar(20)   NOT NULL CHECK (estado_pago IN ('PENDIENTE', 'APROBADO', 'RECHAZADO'))
);

CREATE TABLE kardex_inventario (
  id_movimiento      serial        PRIMARY KEY,
  id_producto        int           NOT NULL REFERENCES productos(id_producto),
  id_pedido          int           REFERENCES pedidos_cabecera(id_pedido),
  tipo_movimiento    varchar(20)   NOT NULL CHECK (tipo_movimiento IN ('ENTRADA', 'SALIDA_VENTA', 'AJUSTE_POS', 'AJUSTE_NEG', 'DEVOLUCION')),
  cantidad_movida    decimal(10,2) NOT NULL CHECK (cantidad_movida > 0),
  stock_resultante   decimal(10,2),
  fecha_movimiento   timestamptz   NOT NULL DEFAULT now(),
  motivo_descripcion varchar(255)
);
CREATE INDEX ix_kardex_producto ON kardex_inventario (id_producto, fecha_movimiento DESC);

-- =====================================================================
--  6. CONFIGURACIÓN
-- =====================================================================
CREATE TABLE configuracion_sistema (
  clave_configuracion varchar(50)   PRIMARY KEY,
  valor_numerico      decimal(10,2),
  valor_texto         varchar(255),
  descripcion         varchar(255)
);

-- =====================================================================
--  7. TRIGGERS DE NEGOCIO
-- =====================================================================
-- Cada movimiento del kardex actualiza el stock (una sola fuente de verdad).
-- Si una salida dejaría el stock en negativo, el CHECK de productos la rechaza.
CREATE FUNCTION fn_kardex_actualiza_stock() RETURNS trigger AS $$
DECLARE nuevo decimal(10,2);
BEGIN
  UPDATE productos
     SET stock_actual = stock_actual +
         CASE WHEN NEW.tipo_movimiento IN ('ENTRADA', 'AJUSTE_POS', 'DEVOLUCION')
              THEN NEW.cantidad_movida ELSE -NEW.cantidad_movida END
   WHERE id_producto = NEW.id_producto
  RETURNING stock_actual INTO nuevo;
  NEW.stock_resultante := nuevo;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kardex_stock BEFORE INSERT ON kardex_inventario
  FOR EACH ROW EXECUTE FUNCTION fn_kardex_actualiza_stock();

-- Guarda cada cambio de estado del pedido (PAGADO → ENVIADO → ENTREGADO…)
CREATE FUNCTION fn_registrar_estado_pedido() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.estado_pedido IS DISTINCT FROM OLD.estado_pedido THEN
    INSERT INTO historial_estados_pedido (id_pedido, estado_anterior, estado_nuevo)
    VALUES (NEW.id_pedido, CASE WHEN TG_OP = 'UPDATE' THEN OLD.estado_pedido END, NEW.estado_pedido);
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pedido_estado AFTER INSERT OR UPDATE OF estado_pedido ON pedidos_cabecera
  FOR EACH ROW EXECUTE FUNCTION fn_registrar_estado_pedido();

-- =====================================================================
--  8. VISTAS PARA REPORTES (útiles en pgAdmin)
-- =====================================================================
CREATE VIEW v_pedidos_resumen AS
SELECT p.numero_orden_publico, p.fecha_creacion, u.correo_electronico AS cuenta,
       p.nombre_contacto, p.total_pagar, p.estado_pedido, p.codigo_cupon_usado,
       (SELECT count(*) FROM pedidos_detalle d WHERE d.id_pedido = p.id_pedido) AS lineas
  FROM pedidos_cabecera p
  JOIN perfil_cliente c ON c.id_cliente = p.id_cliente
  JOIN usuarios u       ON u.id_usuario = c.id_usuario;

CREATE VIEW v_ventas_por_producto AS
SELECT pr.id_producto, pr.nombre_producto, cat.nombre AS categoria,
       COALESCE(sum(d.cantidad_comprada), 0) AS unidades_vendidas,
       COALESCE(sum(d.subtotal_linea), 0)    AS ingresos_bs,
       pr.stock_actual
  FROM productos pr
  JOIN categorias cat ON cat.id_categoria = pr.id_categoria
  LEFT JOIN pedidos_detalle d ON d.id_producto = pr.id_producto
 GROUP BY pr.id_producto, pr.nombre_producto, cat.nombre, pr.stock_actual;

COMMIT;
