/* admin.js — panel de administración conectado a la base de datos (solo cuentas con rol ADMIN).
 * Ventas, inventario, historial y notificaciones se leen y guardan con la API (/api/admin/...).
 * El diseño, los gráficos y los reportes son los mismos del panel de demostración. */
import { $, money, toast } from './utils.js';
import { getCurrentUser, sesionVencida } from './auth.js';
import { recargarProductos, renderCatalog } from './productos.js';
import { getPanelAdmin, guardarObservacion, moverStock, crearProducto, registrarNotificacion } from './api.js';

let sales = [];
let inventory = [];
let restocks = [];
let notifications = [];
let opciones = { unidades: [], categorias: [] };
let authenticatedUser = null;
let cargando = false;
let ultimoReporte = null;   // datos del reporte en pantalla, para exportarlo a PDF

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function localDate(value) {
  return new Date(value).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' });
}

function localDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const cantidad = value => (Number.isInteger(Number(value)) ? String(Number(value)) : Number(value).toFixed(1));

function setStatus(message, kind = '') {
  const status = $('#adminStatus');
  status.textContent = message;
  status.className = `admin-status${kind ? ` ${kind}` : ''}`;
}

function hasAdminAccess(user = authenticatedUser) {
  return user?.rol === 'ADMIN';   // el rol lo asigna el servidor; no hay credenciales en el front
}

/** Muestra el error de la API; si la sesión venció, cierra el panel. */
function manejarError(error, target) {
  if (error.status === 401 || error.status === 403) {
    sesionVencida();
    showView(false);
    toast(error.message);
    return;
  }
  if (target) {
    target.className = 'admin-status bad';
    target.textContent = error.message;
  } else {
    setStatus(error.message, 'bad');
  }
}

/** Los cambios de stock también se ven en el catálogo de la tienda. */
function refrescarTienda() {
  recargarProductos().then(renderCatalog).catch(() => {});
}

function isLowStock(product) {
  return Number(product.stock) <= Number(product.lowAt);
}

function renderMetrics() {
  const now = new Date();
  const activeSales = sales.filter(sale => sale.status.toLocaleLowerCase() !== 'cancelada');
  const today = activeSales.filter(sale => {
    const date = new Date(sale.date);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  });
  const thisMonth = activeSales.filter(sale => {
    const date = new Date(sale.date);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });
  const income = records => records.reduce((sum, sale) => sum + Number(sale.total), 0);
  $('#metricTodaySales').textContent = String(today.length);
  $('#metricTodayIncome').textContent = `${money(income(today))} en ventas`;
  $('#metricMonthSales').textContent = String(thisMonth.length);
  $('#metricMonthIncome').textContent = `${money(income(thisMonth))} en ventas`;
  $('#metricProducts').textContent = String(inventory.length);
  const low = inventory.filter(isLowStock).length;
  $('#metricLowStock').textContent = `${low} producto${low === 1 ? '' : 's'} con stock bajo`;
  renderStockChart();
}

function renderSales() {
  $('#salesCount').textContent = `${sales.length} venta${sales.length === 1 ? '' : 's'} registrada${sales.length === 1 ? '' : 's'}`;
  const rows = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date));
  $('#salesRows').innerHTML = rows.length ? rows.map(sale => `
    <tr>
      <td><strong>${escapeHTML(sale.id)}</strong><span class="table-meta">${escapeHTML(localDate(sale.date))}</span><span class="table-meta">${escapeHTML(sale.cliente)}</span></td>
      <td>${sale.lines.map(line => `<span class="sale-line">${escapeHTML(line.name)} × ${escapeHTML(cantidad(line.quantity))} ${escapeHTML(line.unit)} <span class="table-meta">${money(line.amount)}</span></span>`).join('')}</td>
      <td class="amount">${money(sale.total)}</td>
      <td><span class="status-pill">${escapeHTML(sale.status)}</span></td>
      <td><form class="note-form" data-sale-id="${escapeHTML(sale.id)}">
        <label class="sr" for="note-${escapeHTML(sale.id)}">Observación de ${escapeHTML(sale.id)}</label>
        <textarea id="note-${escapeHTML(sale.id)}" name="note" rows="2" maxlength="300" placeholder="Agregar observación">${escapeHTML(sale.note)}</textarea>
        <button class="btn btn--sm" type="submit">Guardar</button>
      </form></td>
    </tr>`).join('') : '<tr><td colspan="5" class="empty-cell">Todavía no hay ventas registradas.</td></tr>';
}

function renderInventory() {
  const select = $('#restockProduct');
  const selected = select.value;
  select.innerHTML = inventory.map(product =>
    `<option value="${escapeHTML(product.id)}">${escapeHTML(product.name)} (${escapeHTML(cantidad(product.stock))} ${escapeHTML(product.unit)})</option>`
  ).join('');
  if (inventory.some(product => String(product.id) === selected)) select.value = selected;
  $('#inventoryRows').innerHTML = inventory.length ? inventory.map(product => `
    <tr><td>${escapeHTML(product.name)}</td><td>${escapeHTML(cantidad(product.stock))} ${escapeHTML(product.unit)}</td>
      <td><span class="stock ${isLowStock(product) ? 'low' : 'ok'}">${isLowStock(product) ? 'Stock bajo' : 'Disponible'}</span></td></tr>`
  ).join('') : '<tr><td colspan="3" class="empty-cell">No hay productos en el inventario.</td></tr>';
  $('#metricProducts').textContent = String(inventory.length);
  const low = inventory.filter(isLowStock).length;
  $('#metricLowStock').textContent = `${low} producto${low === 1 ? '' : 's'} con stock bajo`;
}

function renderRestocks() {
  const rows = [...restocks].sort((a, b) => new Date(b.date) - new Date(a.date));
  $('#restockRows').innerHTML = rows.length ? rows.map(entry => `
    <tr><td>${escapeHTML(localDate(entry.date))}</td><td>${escapeHTML(entry.type || 'Reposición')} · ${escapeHTML(entry.productName)}</td>
      <td class="${entry.direction === 'remove' ? 'movement-negative' : 'movement-positive'}">${entry.direction === 'remove' ? '−' : '+'}${escapeHTML(cantidad(entry.quantity))} ${escapeHTML(entry.unit)}</td><td>${escapeHTML(cantidad(entry.stockAfter))} ${escapeHTML(entry.unit)}</td></tr>`
  ).join('') : '<tr><td colspan="4" class="empty-cell">Aún no hay movimientos de inventario.</td></tr>';
}

function renderNotifications() {
  const rows = [...notifications].sort((a, b) => new Date(b.date) - new Date(a.date));
  $('#notificationRows').innerHTML = rows.length ? rows.map(item => `
    <tr><td>${escapeHTML(localDate(item.date))}</td><td>${escapeHTML(item.to)}</td>
      <td class="notification-content">${escapeHTML(item.message)}</td>
      <td><span class="status-pill status-pill--local">${escapeHTML(item.status)}</span></td></tr>`
  ).join('') : '<tr><td colspan="4" class="empty-cell">No hay notificaciones registradas.</td></tr>';
}

/** Llena los selects del formulario de alta con las unidades y categorías de la base. */
function renderOpciones() {
  const unidad = $('#newProductUnit'), categoria = $('#newProductCategory');
  if (opciones.unidades.length && unidad) {
    unidad.innerHTML = opciones.unidades.map(u => `<option value="${escapeHTML(u.id)}">${escapeHTML(u.nombre)}</option>`).join('');
  }
  if (opciones.categorias.length && categoria) {
    categoria.innerHTML = opciones.categorias.map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.nombre)}</option>`).join('');
  }
}

function getReportRange(period, dateValue) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const selected = new Date(year, month - 1, day);
  const start = new Date(selected);
  const end = new Date(selected);
  if (period === 'week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    end.setDate(start.getDate() + 6);
  } else if (period === 'month') {
    start.setDate(1);
    end.setMonth(start.getMonth() + 1, 0);
  } else if (period === 'year') {
    start.setMonth(0, 1);
    end.setMonth(11, 31);
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getChartBuckets(period, start) {
  if (period === 'day') {
    return Array.from({ length: 24 }, (_, hour) => {
      const date = new Date(start);
      date.setHours(hour, 0, 0, 0);
      return { start: date, label: `${String(hour).padStart(2, '0')}:00`, short: `${hour}h`, revenue: 0, count: 0 };
    });
  }
  if (period === 'year') {
    return Array.from({ length: 12 }, (_, month) => {
      const date = new Date(start.getFullYear(), month, 1);
      return { start: date, label: date.toLocaleDateString('es-BO', { month: 'long', year: 'numeric' }), short: date.toLocaleDateString('es-BO', { month: 'short' }), revenue: 0, count: 0 };
    });
  }
  const count = period === 'week' ? 7 : new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      start: date,
      label: date.toLocaleDateString('es-BO', { dateStyle: 'full' }),
      short: period === 'week'
        ? date.toLocaleDateString('es-BO', { weekday: 'short' })
        : String(date.getDate()),
      revenue: 0,
      count: 0
    };
  });
}

function getBucketIndex(period, date, rangeStart) {
  if (period === 'day') return date.getHours();
  if (period === 'year') return date.getMonth();
  const saleDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const firstDay = Date.UTC(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate());
  return Math.floor((saleDay - firstDay) / 86400000);
}

function renderSalesChart(period, rangeStart, matches, rangeLabel) {
  const chart = $('#salesChart');
  const activeSales = matches.filter(sale => sale.status.toLocaleLowerCase() !== 'cancelada');
  const buckets = getChartBuckets(period, rangeStart);
  activeSales.forEach(sale => {
    const saleDate = new Date(sale.date);
    const index = getBucketIndex(period, saleDate, rangeStart);
    if (index >= 0 && index < buckets.length) {
      buckets[index].revenue += Number(sale.total);
      buckets[index].count += 1;
    }
  });

  const maxRevenue = Math.max(...buckets.map(bucket => bucket.revenue), 0);
  const plot = { left: 62, top: 18, width: 810, height: 184 };
  const slot = plot.width / buckets.length;
  const barWidth = Math.max(4, Math.min(24, slot * .64));
  const tickMax = maxRevenue > 0 ? Math.ceil(maxRevenue / 4 / 10) * 10 : 10;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = tickMax * (4 - index);
    const y = plot.top + index * plot.height / 4;
    return `<line x1="${plot.left}" y1="${y}" x2="${plot.left + plot.width}" y2="${y}" class="chart-grid"/><text x="${plot.left - 8}" y="${y + 4}" text-anchor="end" class="chart-axis">Bs ${Math.round(value)}</text>`;
  }).join('');
  const bars = buckets.map((bucket, index) => {
    const height = maxRevenue ? bucket.revenue / (tickMax * 4) * plot.height : 0;
    const x = plot.left + index * slot + (slot - barWidth) / 2;
    const y = plot.top + plot.height - height;
    const title = `${bucket.label}: ${bucket.count} venta${bucket.count === 1 ? '' : 's'}, ${money(bucket.revenue)}`;
    return `<g><title>${escapeHTML(title)}</title><rect x="${x}" y="${y}" width="${barWidth}" height="${height}" rx="3" class="chart-bar"/></g>`;
  }).join('');
  const labelStep = period === 'day' ? 3 : period === 'month' ? 3 : 1;
  const labels = buckets.map((bucket, index) => {
    if (index % labelStep !== 0 && index !== buckets.length - 1) return '';
    const x = plot.left + index * slot + slot / 2;
    return `<text x="${x}" y="${plot.top + plot.height + 24}" text-anchor="middle" class="chart-axis">${escapeHTML(bucket.short)}</text>`;
  }).join('');
  const total = buckets.reduce((sum, bucket) => sum + bucket.revenue, 0);
  const summary = maxRevenue
    ? `Gráfico de ingresos para ${rangeLabel}. ${activeSales.length} ${activeSales.length === 1 ? 'venta' : 'ventas'} no cancelada${activeSales.length === 1 ? '' : 's'}, ingresos totales ${money(total)}. Cada barra representa ${period === 'day' ? 'una hora' : period === 'year' ? 'un mes' : 'un día'}.`
    : `No hay ventas no canceladas para graficar en ${rangeLabel}.`;

  $('#salesChartTitle').textContent = `Ingresos ${period === 'day' ? 'por hora' : period === 'week' || period === 'month' ? 'por día' : 'por mes'}`;
  chart.setAttribute('aria-label', summary);
  $('#salesChartSummary').textContent = summary;
  chart.innerHTML = maxRevenue
    ? `<svg viewBox="0 0 900 246" role="presentation" focusable="false">${grid}${bars}${labels}<text x="${plot.left + plot.width / 2}" y="242" text-anchor="middle" class="chart-axis">Periodo</text></svg>`
    : '<p class="chart-empty">Sin ventas para mostrar en este periodo.</p>';
}

function renderStatusChart(matches, rangeLabel) {
  const chart = $('#statusChart');
  const grouped = new Map();
  matches.forEach(sale => {
    const label = String(sale.status || 'Sin estado');
    const key = label.trim().toLocaleLowerCase();
    const current = grouped.get(key) || { label, count: 0 };
    current.count += 1;
    grouped.set(key, current);
  });
  const statuses = [...grouped.values()];
  const total = statuses.reduce((sum, item) => sum + item.count, 0);
  const summary = total
    ? `Distribución de ${total} ${total === 1 ? 'venta' : 'ventas'} por estado para ${rangeLabel}: ${statuses.map(item => `${item.label}, ${item.count}`).join('; ')}.`
    : `No hay ventas registradas para mostrar por estado en ${rangeLabel}.`;
  $('#statusChartSummary').textContent = summary;
  chart.setAttribute('aria-label', summary);
  if (!total) {
    chart.innerHTML = '<p class="chart-empty">Sin ventas para mostrar en este periodo.</p>';
    return;
  }
  const circumference = 2 * Math.PI * 48;
  let offset = 0;
  const segments = statuses.map((item, index) => {
    const length = item.count / total * circumference;
    const circle = `<circle class="donut-segment donut-segment--${index % 5}" cx="70" cy="70" r="48" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 70 70)"><title>${escapeHTML(item.label)}: ${item.count}</title></circle>`;
    offset += length;
    return circle;
  }).join('');
  const legend = statuses.map((item, index) =>
    `<li><i class="donut-segment--${index % 5}" aria-hidden="true"></i>${escapeHTML(item.label)}: <strong>${item.count}</strong></li>`
  ).join('');
  chart.innerHTML = `<div class="donut-layout"><svg viewBox="0 0 140 140" aria-hidden="true"><circle class="donut-track" cx="70" cy="70" r="48"/>${segments}<text class="donut-total" x="70" y="67">${total}</text><text class="donut-caption" x="70" y="84">ventas</text></svg><ul class="chart-legend">${legend}</ul></div>`;
}

function renderProductChart(matches, rangeLabel) {
  const chart = $('#productsChart');
  const totals = new Map();
  matches.filter(sale => sale.status.toLocaleLowerCase() !== 'cancelada').forEach(sale => {
    (sale.lines || []).forEach(line => {
      const name = String(line.name || 'Producto sin nombre');
      const amount = Number(line.amount);
      if (Number.isFinite(amount) && amount > 0) totals.set(name, (totals.get(name) || 0) + amount);
    });
  });
  const products = [...totals].map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  const maxRevenue = Math.max(...products.map(item => item.revenue), 0);
  const summary = products.length
    ? `Ingresos por producto para ${rangeLabel}: ${products.map(item => `${item.name}, ${money(item.revenue)}`).join('; ')}. Se muestran hasta seis productos.`
    : `No hay productos de ventas no canceladas para mostrar en ${rangeLabel}.`;
  $('#productsChartSummary').textContent = summary;
  chart.setAttribute('aria-label', summary);
  chart.innerHTML = products.length ? products.map(item => {
    const width = item.revenue / maxRevenue * 100;
    return `<div class="horizontal-chart__row"><span class="horizontal-chart__name" title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</span><span class="horizontal-chart__track"><span class="horizontal-chart__bar" style="width:${width}%"></span></span><strong class="horizontal-chart__value">${money(item.revenue)}</strong></div>`;
  }).join('') : '<p class="chart-empty">Sin ventas para mostrar en este periodo.</p>';
}

function renderOrdersTrendChart(period, rangeStart, matches, rangeLabel) {
  const chart = $('#ordersTrendChart');
  const activeSales = matches.filter(sale => sale.status.toLocaleLowerCase() !== 'cancelada');
  const buckets = getChartBuckets(period, rangeStart);
  activeSales.forEach(sale => {
    const index = getBucketIndex(period, new Date(sale.date), rangeStart);
    if (index >= 0 && index < buckets.length) buckets[index].count += 1;
  });
  const maxCount = Math.max(...buckets.map(bucket => bucket.count), 0);
  const summary = maxCount
    ? `Cantidad de ventas no canceladas para ${rangeLabel}. Total: ${activeSales.length}. Cada punto representa ${period === 'day' ? 'una hora' : period === 'year' ? 'un mes' : 'un día'}.`
    : `No hay ventas no canceladas para mostrar en ${rangeLabel}.`;
  $('#ordersTrendChartSummary').textContent = summary;
  chart.setAttribute('aria-label', summary);
  if (!maxCount) {
    chart.innerHTML = '<p class="chart-empty">Sin ventas para mostrar en este periodo.</p>';
    return;
  }
  const plot = { left: 48, top: 16, width: 820, height: 150 };
  const tickMax = Math.max(1, Math.ceil(maxCount / 4));
  const y = value => plot.top + plot.height - value / (tickMax * 4) * plot.height;
  const x = index => plot.left + (index + .5) * plot.width / buckets.length;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = tickMax * (4 - index);
    const lineY = plot.top + index * plot.height / 4;
    return `<line x1="${plot.left}" y1="${lineY}" x2="${plot.left + plot.width}" y2="${lineY}" class="chart-grid"/><text x="${plot.left - 8}" y="${lineY + 4}" text-anchor="end" class="chart-axis">${value}</text>`;
  }).join('');
  const points = buckets.map((bucket, index) => `${x(index)},${y(bucket.count)}`).join(' ');
  const labelStep = period === 'day' ? 3 : period === 'month' ? 3 : 1;
  const labels = buckets.map((bucket, index) => {
    if (index % labelStep !== 0 && index !== buckets.length - 1) return '';
    return `<text x="${x(index)}" y="${plot.top + plot.height + 24}" text-anchor="middle" class="chart-axis">${escapeHTML(bucket.short)}</text>`;
  }).join('');
  const dots = buckets.map((bucket, index) => bucket.count
    ? `<circle cx="${x(index)}" cy="${y(bucket.count)}" r="3.5" class="chart-point"><title>${escapeHTML(bucket.label)}: ${bucket.count} ${bucket.count === 1 ? 'venta' : 'ventas'}</title></circle>`
    : '').join('');
  chart.innerHTML = `<svg viewBox="0 0 900 212" role="presentation" focusable="false">${grid}<polyline points="${points}" class="chart-line"/>${dots}${labels}<text x="${plot.left + plot.width / 2}" y="208" text-anchor="middle" class="chart-axis">Periodo</text></svg>`;
}

function renderStockChart() {
  const chart = $('#stockChart');
  const products = [...inventory].sort((a, b) => Number(b.stock) - Number(a.stock)).slice(0, 8);
  if (!products.length) {
    const summary = 'No hay productos en el inventario para graficar.';
    chart.setAttribute('aria-label', summary);
    chart.innerHTML = '<p class="chart-empty">No hay inventario para mostrar.</p>';
    $('#stockChartSummary').textContent = summary;
    return;
  }
  const max = Math.max(...products.flatMap(item => [Number(item.stock) || 0, Number(item.lowAt) || 0]), 1);
  const tickMax = Math.ceil(max / 4) * 4 || 4;
  const plot = { left: 55, top: 16, width: 810, height: 150 };
  const x = index => products.length === 1
    ? plot.left + plot.width / 2
    : plot.left + index * plot.width / (products.length - 1);
  const y = value => plot.top + plot.height - value / tickMax * plot.height;
  const values = products.map(item => Number(item.stock) || 0);
  const thresholds = products.map(item => Number(item.lowAt) || 0);
  const valuePoints = values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
  const thresholdPoints = thresholds.map((value, index) => `${x(index)},${y(value)}`).join(' ');
  const areaPoints = `${x(0)},${plot.top + plot.height} ${valuePoints} ${x(products.length - 1)},${plot.top + plot.height}`;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = tickMax * (4 - index) / 4;
    const lineY = plot.top + index * plot.height / 4;
    return `<line x1="${plot.left}" y1="${lineY}" x2="${plot.left + plot.width}" y2="${lineY}" class="chart-grid"/><text x="${plot.left - 8}" y="${lineY + 4}" text-anchor="end" class="chart-axis">${Math.round(value)}</text>`;
  }).join('');
  const labels = products.map((item, index) => {
    const label = String(item.name).length > 13 ? `${String(item.name).slice(0, 12)}…` : String(item.name);
    return `<text x="${x(index)}" y="${plot.top + plot.height + 22}" text-anchor="middle" class="chart-axis"><title>${escapeHTML(item.name)}</title>${escapeHTML(label)}</text>`;
  }).join('');
  const summary = `Existencias de los ${products.length} productos con mayor stock. La línea discontinua indica el umbral de alerta de cada producto.`;
  $('#stockChartSummary').textContent = summary;
  chart.setAttribute('aria-label', `${summary} ${products.map(item => `${item.name}: ${item.stock}, alerta en ${item.lowAt}`).join('; ')}.`);
  chart.innerHTML = `<svg viewBox="0 0 900 210" role="presentation" focusable="false">${grid}<polygon points="${areaPoints}" class="chart-area"/><polyline points="${valuePoints}" class="chart-line"/>${products.map((item, index) => `<circle cx="${x(index)}" cy="${y(values[index])}" r="3.5" class="chart-point"><title>${escapeHTML(item.name)}: ${values[index]} en existencia</title></circle>`).join('')}<polyline points="${thresholdPoints}" class="chart-threshold"/>${labels}<text x="${plot.left + plot.width / 2}" y="207" text-anchor="middle" class="chart-axis">Producto (línea discontinua: umbral de alerta)</text></svg>`;
}

function renderReport() {
  const period = $('#reportPeriod').value;
  const dateValue = $('#reportDate').value;
  if (!dateValue) return;
  const { start, end } = getReportRange(period, dateValue);
  const matches = sales.filter(sale => {
    const date = new Date(sale.date);
    return date >= start && date <= end;
  });
  const activeSales = matches.filter(sale => sale.status.toLocaleLowerCase() !== 'cancelada');
  const labels = { day: 'Día', week: 'Semana', month: 'Mes', year: 'Año' };
  const rangeLabel = start.toLocaleDateString('es-BO') === end.toLocaleDateString('es-BO')
    ? start.toLocaleDateString('es-BO', { dateStyle: 'long' })
    : `${start.toLocaleDateString('es-BO', { dateStyle: 'medium' })} – ${end.toLocaleDateString('es-BO', { dateStyle: 'medium' })}`;
  $('#reportRange').textContent = `${labels[period]} consultado: ${rangeLabel}`;
  const revenue = activeSales.reduce((sum, sale) => sum + Number(sale.total), 0);
  renderSalesChart(period, start, matches, rangeLabel);
  renderStatusChart(matches, rangeLabel);
  renderProductChart(matches, rangeLabel);
  renderOrdersTrendChart(period, start, matches, rangeLabel);
  renderStockChart();
  $('#reportResults').innerHTML = `
    <article><span>Ventas no canceladas</span><strong>${activeSales.length}</strong></article>
    <article><span>Ingresos</span><strong>${money(revenue)}</strong></article>
    <p>${activeSales.length ? `Ingresos basados en ${activeSales.length} venta${activeSales.length === 1 ? '' : 's'} no cancelada${activeSales.length === 1 ? '' : 's'}.` : 'No hay ventas no canceladas en este periodo. Los resultados son Bs 0,00.'} ${matches.length > activeSales.length ? 'Las ventas canceladas no se incluyen en el ingreso.' : ''}</p>`;
  ultimoReporte = { period, periodLabel: labels[period], rangeLabel, matches, activeSales, revenue, chartTitle: $('#salesChartTitle').textContent };
}

/* ---------- Exportar el reporte a PDF ----------
 * Arma un documento A4 con el resumen, el gráfico y el detalle de ventas del periodo
 * y abre el diálogo de impresión del navegador, donde se elige "Guardar como PDF".
 * No usa librerías externas ni cambia los estilos de la página. */
function reporteHTML(r) {
  const fila = s => `
    <tr class="${s.status.toLocaleLowerCase() === 'cancelada' ? 'cancelada' : ''}">
      <td>${escapeHTML(s.id)}</td><td>${escapeHTML(localDate(s.date))}</td><td>${escapeHTML(s.cliente)}</td>
      <td>${s.lines.map(l => `${escapeHTML(l.name)} × ${escapeHTML(cantidad(l.quantity))} ${escapeHTML(l.unit)}`).join('<br>')}</td>
      <td>${escapeHTML(s.status)}</td><td class="num">${money(s.total)}</td>
    </tr>`;
  const filas = [...r.matches].sort((a, b) => new Date(a.date) - new Date(b.date));
  const canceladas = r.matches.length - r.activeSales.length;
  const promedio = r.activeSales.length ? r.revenue / r.activeSales.length : 0;
  const grafico = $('#salesChart').querySelector('svg')?.outerHTML || '<p class="vacio">Sin ventas para graficar en este periodo.</p>';
  const ahora = new Date().toLocaleString('es-BO', { dateStyle: 'long', timeStyle: 'short' });
  /* Los otros 4 gráficos del panel (estado, productos, cantidad, existencias) se copian tal como se ven */
  const extra = ['statusChart', 'productsChart', 'ordersTrendChart', 'stockChart'].map(id => {
    const el = document.getElementById(id);
    const titulo = document.getElementById(`${id}Title`)?.textContent || '';
    return el ? `<section class="mini"><h3>${escapeHTML(titulo)}</h3>${el.innerHTML}</section>` : '';
  }).join('');
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Reporte de ventas - Mercería Express - ${escapeHTML(r.rangeLabel)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Nunito', 'Segoe UI', Arial, sans-serif; color: #2B2A3A; font-size: 10.5pt; }
  header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; border-bottom: 3px solid #3F6190; padding-bottom: 8px; margin-bottom: 14px; }
  .marca { font-weight: 800; color: #3A8527; font-size: 11pt; letter-spacing: .02em; }
  h1 { margin: 2px 0 0; font-size: 18pt; color: #3F6190; }
  .meta { text-align: right; font-size: 9pt; color: #586079; line-height: 1.5; }
  .resumen { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 0 0 14px; }
  .resumen div { border: 1px solid #B5C8DB; border-radius: 8px; padding: 7px 9px; }
  .resumen span { display: block; font-size: 8.5pt; color: #586079; }
  .resumen strong { font-size: 13pt; }
  h2 { font-size: 12pt; margin: 14px 0 6px; color: #2B2A3A; }
  svg { width: 100%; height: auto; display: block; }
  .chart-grid { stroke: #B5C8DB; stroke-width: 1; stroke-dasharray: 4 5; }
  .chart-axis { fill: #586079; font-size: 12px; font-family: inherit; }
  .chart-bar { fill: #3F6190; }
  .graficos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; page-break-inside: avoid; }
  .mini { border: 1px solid #D5DFEA; border-radius: 8px; padding: 6px 8px; page-break-inside: avoid; }
  h3 { font-size: 10pt; margin: 0 0 4px; }
  .chart-line { fill: none; stroke: #F08BB4; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
  .chart-area { fill: rgba(76,195,227,.35); }
  .chart-point { fill: #F08BB4; stroke: #fff; stroke-width: 2; }
  .chart-threshold { fill: none; stroke: #F29A3B; stroke-width: 2; stroke-dasharray: 5 4; }
  .chart-empty { color: #586079; font-style: italic; font-size: 9pt; }
  .donut-layout { display: flex; align-items: center; justify-content: center; gap: 12px; }
  .donut-layout svg { width: 120px; height: 120px; flex: none; }
  .donut-track { fill: none; stroke: #B5C8DB; stroke-width: 18; }
  .donut-segment { fill: none; stroke-width: 18; }
  .donut-segment--0 { stroke: #6CC24A; } .donut-segment--1 { stroke: #4CC3E3; } .donut-segment--2 { stroke: #F29A3B; } .donut-segment--3 { stroke: #F08BB4; } .donut-segment--4 { stroke: #3F6190; }
  .donut-total { fill: #2B2A3A; font-size: 21px; font-weight: 700; text-anchor: middle; }
  .donut-caption { fill: #586079; font-size: 10px; text-anchor: middle; }
  .chart-legend { list-style: none; margin: 0; padding: 0; font-size: 8.5pt; color: #586079; }
  .chart-legend li { display: flex; align-items: center; gap: 5px; margin: 2px 0; }
  .chart-legend i { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
  .chart-legend .donut-segment--0 { background: #6CC24A; } .chart-legend .donut-segment--1 { background: #4CC3E3; } .chart-legend .donut-segment--2 { background: #F29A3B; } .chart-legend .donut-segment--3 { background: #F08BB4; } .chart-legend .donut-segment--4 { background: #3F6190; }
  .horizontal-chart__row { display: grid; grid-template-columns: 1fr 1.6fr auto; align-items: center; gap: 6px; font-size: 8.5pt; margin: 4px 0; }
  .horizontal-chart__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .horizontal-chart__track { height: 8px; border-radius: 99px; background: #D5DFEA; overflow: hidden; }
  .horizontal-chart__bar { display: block; height: 100%; background: #3F6190; border-radius: 99px; }
  .horizontal-chart__value { font-weight: 800; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; font-size: 8.8pt; }
  th { text-align: left; background: #EAF2F9; font-weight: 700; }
  th, td { padding: 5px 6px; border-bottom: 1px solid #D5DFEA; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  tr { page-break-inside: avoid; }
  tr.cancelada td { color: #8A90A2; }
  tfoot td { font-weight: 800; border-top: 2px solid #3F6190; border-bottom: 0; }
  .vacio { color: #586079; font-style: italic; }
  footer { margin-top: 16px; font-size: 8.5pt; color: #586079; border-top: 1px solid #D5DFEA; padding-top: 6px; }
</style></head><body>
<header>
  <div><div class="marca">MERCERÍA EXPRESS</div><h1>Reporte de ventas</h1></div>
  <div class="meta">${escapeHTML(r.periodLabel)}: <strong>${escapeHTML(r.rangeLabel)}</strong><br>Generado: ${escapeHTML(ahora)}<br>Por: ${escapeHTML(authenticatedUser?.email || '')}</div>
</header>
<section class="resumen">
  <div><span>Ventas no canceladas</span><strong>${r.activeSales.length}</strong></div>
  <div><span>Ingresos</span><strong>${money(r.revenue)}</strong></div>
  <div><span>Ticket promedio</span><strong>${money(promedio)}</strong></div>
  <div><span>Canceladas</span><strong>${canceladas}</strong></div>
</section>
<h2>${escapeHTML(r.chartTitle)}</h2>
${grafico}
<div class="graficos">${extra}</div>
<h2>Detalle de ventas</h2>
${filas.length ? `<table>
  <thead><tr><th>N.º de orden</th><th>Fecha</th><th>Cliente</th><th>Productos</th><th>Estado</th><th class="num">Total</th></tr></thead>
  <tbody>${filas.map(fila).join('')}</tbody>
  <tfoot><tr><td colspan="5">Ingresos del periodo (sin canceladas)</td><td class="num">${money(r.revenue)}</td></tr></tfoot>
</table>` : '<p class="vacio">No hay ventas registradas en este periodo.</p>'}
<footer>Mercería Express · Datos obtenidos de la base de datos de la tienda. Las ventas canceladas se muestran en gris y no suman en los ingresos.</footer>
</body></html>`;
}

function exportarPDF() {
  if (!hasAdminAccess()) return;
  renderReport();
  if (!ultimoReporte) { setStatus('Elige un periodo y una fecha antes de exportar.', 'bad'); return; }
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.title = 'Reporte para imprimir';
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.append(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(reporteHTML(ultimoReporte));
  doc.close();
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();          // en el diálogo: Destino → "Guardar como PDF"
    setTimeout(() => frame.remove(), 1000);
  }, 300);
  setStatus('Se abrió la ventana de impresión: elige "Guardar como PDF" como destino.', 'ok');
}

function refreshDashboard() {
  renderMetrics();
  renderSales();
  renderInventory();
  renderRestocks();
  renderNotifications();
  renderOpciones();
  renderReport();
}

/** Trae todo desde la base de datos (GET /api/admin/panel). */
async function cargarPanel() {
  if (cargando) return;
  cargando = true;
  setStatus('Cargando datos de la tienda…');
  try {
    const data = await getPanelAdmin();
    sales = data.sales;
    inventory = data.inventory;
    restocks = data.restocks;
    notifications = data.notifications;
    opciones = data.opciones || opciones;
    refreshDashboard();
    setStatus('');
  } catch (error) {
    manejarError(error);
  } finally {
    cargando = false;
  }
}

function showView(adminVisible) {
  if (adminVisible && !hasAdminAccess()) return;
  $('#storefrontView').hidden = adminVisible;
  $('#adminView').hidden = !adminVisible;
  $('#adminToggle').textContent = adminVisible ? 'Volver a tienda' : 'Administración';
  $('#adminToggle').setAttribute('aria-pressed', String(adminVisible));
  document.querySelectorAll('.main-nav, #accountBtn, #wishlistBtn, #cartBtn').forEach(element => {
    element.hidden = adminVisible;
  });
  document.body.classList.toggle('admin-mode', adminVisible);
  if (adminVisible) {
    $('#notificationTo').value = authenticatedUser?.email || '';
    cargarPanel();
    $('#admin-title').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

document.addEventListener('me:auth-change', event => {
  authenticatedUser = event.detail;
  const allowed = hasAdminAccess();
  $('#adminToggle').hidden = !allowed;
  if (!allowed && !$('#adminView').hidden) showView(false);
});

document.addEventListener('me:admin-login', () => {
  if (hasAdminAccess()) showView(true);
});

$('#adminToggle').addEventListener('click', () => {
  if (!hasAdminAccess()) return;
  showView($('#adminView').hidden);
});
document.querySelector('.brand').addEventListener('click', event => {
  if (!$('#adminView').hidden) {
    event.preventDefault();
    showView(false);
  }
});

function initAdmin() {
  authenticatedUser = getCurrentUser();
  ['me.admin.sales.v1', 'me.admin.stock.v1', 'me.admin.notifications.v1']
    .forEach(key => localStorage.removeItem(key));   // datos del antiguo panel de demostración
  $('#adminToggle').hidden = !hasAdminAccess();

  $('#reportDate').value = localDateInput(new Date());

  $('#reportForm').addEventListener('submit', event => {
    event.preventDefault();
    renderReport();
  });
  $('#reportPeriod').addEventListener('change', renderReport);
  $('#reportDate').addEventListener('change', renderReport);
  $('#exportPdf')?.addEventListener('click', exportarPDF);

  $('#salesRows').addEventListener('submit', async event => {
    const form = event.target.closest('.note-form');
    if (!form) return;
    event.preventDefault();
    if (!hasAdminAccess()) return;
    const id = form.dataset.saleId;
    const note = new FormData(form).get('note').toString().trim();
    const boton = form.querySelector('[type=submit]');
    boton.disabled = true;
    try {
      await guardarObservacion(id, note);
      sales = sales.map(item => item.id === id ? { ...item, note } : item);
      setStatus(`Observación de ${id} guardada.`, 'ok');
    } catch (error) {
      manejarError(error);
    } finally {
      boton.disabled = false;
    }
  });

  $('#restockForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!hasAdminAccess()) return;
    const form = event.currentTarget;
    const error = $('#restockError');
    error.className = 'admin-status';
    error.textContent = '';
    const quantityInput = $('#restockQuantity');
    const quantity = Number(quantityInput.value);
    const product = inventory.find(item => String(item.id) === $('#restockProduct').value);
    if (!product) {
      error.textContent = 'Selecciona un producto válido.';
      return;
    }
    if (!(quantity > 0)) {
      error.textContent = 'Ingresa una cantidad mayor que cero.';
      quantityInput.focus();
      return;
    }
    const direction = $('#stockAction').value;
    if (direction === 'remove' && quantity > Number(product.stock)) {
      error.textContent = `No puedes reducir ${quantity}: el stock disponible es ${cantidad(product.stock)} ${product.unit}.`;
      quantityInput.focus();
      return;
    }
    const boton = form.querySelector('[type=submit]');
    boton.disabled = true;
    try {
      const r = await moverStock(product.id, direction, quantity);
      inventory = r.inventory;
      restocks = r.restocks;
      form.reset();
      refreshDashboard();
      refrescarTienda();
      error.className = 'admin-status ok';
      error.textContent = `${direction === 'add' ? 'Stock aumentado' : 'Stock reducido'}: ${r.name} ahora tiene ${cantidad(r.stockAfter)} ${r.unit}.`;
    } catch (saveError) {
      manejarError(saveError, error);
    } finally {
      boton.disabled = false;
    }
  });

  $('#newProductForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!hasAdminAccess()) return;
    const form = event.currentTarget;
    const status = $('#newProductStatus');
    status.className = 'admin-status';
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const datos = {
      name: data.get('name').toString().trim(),
      unit: data.get('unit').toString(),
      categoria: data.get('categoria')?.toString() || '',
      precio: Number(data.get('precio')),
      stock: Number(data.get('stock')),
      lowAt: Number(data.get('lowAt'))
    };
    const boton = form.querySelector('[type=submit]');
    boton.disabled = true;
    try {
      const r = await crearProducto(datos);
      inventory = r.inventory;
      restocks = r.restocks;
      form.reset();
      $('#newProductStock').value = '0';
      $('#newProductLowAt').value = '5';
      refreshDashboard();
      refrescarTienda();
      status.className = 'admin-status ok';
      status.textContent = `${r.name} agregado al catálogo con stock inicial ${datos.stock}.`;
    } catch (error) {
      manejarError(error, status);
    } finally {
      boton.disabled = false;
    }
  });

  $('#notificationForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!hasAdminAccess()) return;
    const form = event.currentTarget;
    const status = $('#notificationStatus');
    status.className = 'admin-status';
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const boton = form.querySelector('[type=submit]');
    boton.disabled = true;
    try {
      const r = await registrarNotificacion(data.get('to').toString().trim(), data.get('message').toString().trim());
      notifications = r.notifications;
      form.reset();
      $('#notificationTo').value = authenticatedUser?.email || '';
      renderNotifications();
      status.className = 'admin-status ok';
      status.textContent = 'Notificación registrada como simulada. No se envió ningún correo.';
    } catch (error) {
      manejarError(error, status);
    } finally {
      boton.disabled = false;
    }
  });
}

try {
  initAdmin();
} catch (error) {
  console.error('No se pudo iniciar el panel de administración.', error);
  setStatus(`No se pudo cargar el panel: ${error.message}`, 'bad');
}
