--  Mercería Express — actualizacion_admin.sql
--  Agrega lo que necesita el PANEL DE ADMINISTRACIÓN conectado a la base.
--  NO borra nada: se ejecuta UNA vez sobre la base que ya tienes en Neon
--  (después de esquema.sql y datos_iniciales.sql). Si se ejecuta dos veces
--  no da error (IF NOT EXISTS).
BEGIN;

-- 1. Observación interna de cada venta (la escribe el administrador en el panel)
ALTER TABLE pedidos_cabecera ADD COLUMN IF NOT EXISTS observacion_admin varchar(300);

-- 2. Quién hizo cada movimiento de inventario (NULL = ventas y carga inicial)
ALTER TABLE kardex_inventario ADD COLUMN IF NOT EXISTS id_usuario int REFERENCES usuarios(id_usuario);

-- 3. Notificaciones del panel. Son SIMULADAS: se registran pero no se envían.
CREATE TABLE IF NOT EXISTS notificaciones (
  id_notificacion serial       PRIMARY KEY,
  id_usuario      int          NOT NULL REFERENCES usuarios(id_usuario),   -- administrador que la registró
  destinatario    varchar(100) NOT NULL CHECK (destinatario ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  mensaje         varchar(500) NOT NULL CHECK (length(trim(mensaje)) > 0),
  estado          varchar(20)  NOT NULL DEFAULT 'SIMULADA' CHECK (estado IN ('SIMULADA', 'ENVIADA', 'FALLIDA')),
  fecha           timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_notificaciones_fecha ON notificaciones (fecha DESC);

-- 4. Índice para los reportes por fecha
CREATE INDEX IF NOT EXISTS ix_pedidos_fecha ON pedidos_cabecera (fecha_creacion DESC);

COMMIT;
