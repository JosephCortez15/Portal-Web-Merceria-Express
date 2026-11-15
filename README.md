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
│   └── auth.js         # RF-05
└── assets/
    ├── images/
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

Se puede crear una cuenta e iniciar sesión desde el botón **Iniciar sesión**. El checkout requiere una sesión activa y las compras quedan asociadas al usuario; el historial está disponible en **Mi cuenta**. Las cuentas, la sesión y las ventas se guardan en `localStorage` del navegador actual, así que no se comparten entre dispositivos ni navegadores y pueden borrarse al limpiar los datos del sitio. Las contraseñas se guardan como derivaciones PBKDF2, y no se conserva el número completo de tarjeta ni el CVV.

Esta función es solo para la demostración front-end: no hay servidor, base de datos central ni autenticación real. Para producción se requiere un backend con almacenamiento seguro, gestión de sesiones y procesamiento de pagos integrado.

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
