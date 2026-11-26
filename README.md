# Portal Web Mercería Express

Portal web de artículos de costura, hilos, telas y manualidades.
Proyecto Integrador Front-End — Tecnologías Web I (SIS-214), Universidad Católica Boliviana "San Pablo".

## Requerimientos cubiertos

| RF | Descripción | Archivo |
| --- | --- | --- |
| RF-01 | Catálogo categorizado (Hilos, Botones, Cierres, Telas por Metro, Herramientas) | `js/productos.js` |
| RF-02 | Calculadora de materiales (metros de tela e hilo) | `js/calculadora.js` |
| RF-03 | Carrito persistente: stock, cupones, subtotal, IVA y envío | `js/carrito.js` |
| RF-04 | Checkout simulado con validación HTML5 y recibo digital | `js/checkout.js` |
| RF-05 | Registro/inicio de sesión e historial de ventas por cuenta | `js/auth.js`, `js/checkout.js` |
| RF-06 | Lista de deseados persistente e independiente del carrito | `js/deseados.js`, `js/productos.js` |
| Administración | Dashboard local de demostración | `js/admin.js` |

## Estructura

```
merceria-express/
├── index.html
├── css/
│   ├── variables.css   # tokens de diseño (colores, fuentes, tema claro/oscuro)
│   ├── base.css        # reset, tipografía, accesibilidad
│   ├── layout.css      # header, hero, secciones, footer
│   ├── components.css  # botones, tarjetas, formularios, modal, responsive
│   └── styles.css      # unificador con @import
├── js/
│   ├── main.js         # punto de entrada
│   ├── utils.js        # utilidades y validación
│   ├── productos.js    # RF-01
│   ├── calculadora.js  # RF-02
│   ├── carrito.js      # RF-03
│   ├── checkout.js     # RF-04
│   ├── auth.js         # RF-05
│   ├── deseados.js     # RF-06
│   └── admin.js        # Panel de administración local
└── assets/
    ├── images/         # fotografía de marca y recorte cuadrado del logo
    └── icons/
```

## Cómo ejecutarlo en VS Code

El JavaScript usa módulos ES6 (`type="module"`), que **no funcionan abriendo el archivo con doble clic** (`file://`).
Usa un servidor local:

1. Instala la extensión **Live Server** en VS Code.
2. Clic derecho en `index.html` → **Open with Live Server**.

(Alternativa: `npx serve` o `python3 -m http.server` dentro de la carpeta.)

## Cupones de prueba

`COSTURA10` (10 %), `LANA15` (15 %), `BIENVENIDA5` (5 %).
Tarjeta de prueba: `4242 4242 4242 4242`, cualquier fecha futura y CVV de 3 dígitos. El pago es simulado.

## Cuentas y registro de ventas

Se puede crear una cuenta e iniciar sesión desde el botón **Iniciar sesión**. Es necesario iniciar sesión para agregar productos al carrito, completar el checkout y consultar los deseados; las compras quedan asociadas al usuario y su historial está disponible en **Mi cuenta**. Las cuentas, sesiones y pedidos regulares se gestionan mediante la API y la base de datos. El navegador conserva el token de sesión, no la contraseña. El pago es simulado y no se guarda el número completo de tarjeta ni el CVV.

## Lista de deseados

Inicia sesión para consultar **Mis deseados**, filtrar el catálogo por esa lista y marcar productos con el corazón. Sin sesión, al intentar abrir Deseados se solicita iniciar sesión y la lista no se muestra. Los deseados se sincronizan con la cuenta y son independientes del carrito: marcar o quitar un favorito no agrega ni elimina productos de la compra.

## Panel de administración de demostración

El administrador de pruebas es independiente de la base de datos. Credenciales locales: `admin@merceriaexpress.test` / `MerceriaDemo2026!`. Su sesión usa una clave separada de `localStorage`, no genera ni requiere un token de API y puede cerrarse desde **Mi cuenta**. El botón **Administración** aparece únicamente con esa sesión de prueba y **Volver a tienda** regresa al catálogo. El registro normal no concede privilegios administrativos. La navegación del panel lleva directamente a Resumen, Reportes, Ventas, Inventario, Productos y Notificaciones. Los reportes por día, semana, mes o año muestran cinco gráficos SVG: ingresos por periodo (barras verticales), ventas por estado (dona), ingresos por producto (barras horizontales), cantidad de ventas (línea) y existencias frente a umbrales de alerta (área).

Los datos están marcados como demostración y se guardan en `localStorage` de este navegador. El panel no depende de la API ni de la base de datos de la tienda; el inventario es independiente del catálogo del cliente. Las notificaciones nunca se envían: su estado indica explícitamente que son simulaciones locales.

## Subir a GitHub y publicar

```bash
git init
git add .
git commit -m "feat: portal Mercería Express"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/merceria-express.git
git push -u origin main
```

Luego, en GitHub: **Settings → Pages → Branch: main / (root) → Save**.
El sitio quedará en `https://TU-USUARIO.github.io/merceria-express/`.
