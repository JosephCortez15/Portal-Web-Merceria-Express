/* admin.js — panel local de demostración, independiente de la API de la tienda */
import { $, money } from './utils.js';
import { getCurrentUser } from './auth.js';

const KEYS = {
  sales: 'me.admin.sales.v1',
  stock: 'me.admin.stock.v1',
  notifications: 'me.admin.notifications.v1'
};
const ADMIN_EMAIL = 'admin@merceriaexpress.test';

const DEMO_PRODUCTS = [
  { id: 'hilo-algodon', name: 'Hilo de algodón 100 g', stock: 34, unit: 'u', lowAt: 8 },
  { id: 'tela-popelina', name: 'Tela popelina estampada', stock: 4, unit: 'm', lowAt: 6 },
  { id: 'botones-madera', name: 'Botones de madera (12 u.)', stock: 21, unit: 'paq.', lowAt: 5 },
  { id: 'cierre-metalico', name: 'Cierre metálico 20 cm', stock: 13, unit: 'u', lowAt: 5 },
  { id: 'tijera-costura', name: 'Tijera de costura', stock: 3, unit: 'u', lowAt: 4 },
  { id: 'cinta-metrica', name: 'Cinta métrica 150 cm', stock: 17, unit: 'u', lowAt: 5 }
];

const ago = days => new Date(Date.now() - days * 86400000).toISOString();
const DEMO_SALES = [
  { id: 'ME-DEMO-1058', date: ago(0), total: 128.5, status: 'Entregada', note: 'Entrega completada en tienda.', lines: [{ name: 'Hilo de algodón 100 g', quantity: 2, unit: 'u', amount: 37 }, { name: 'Tela popelina estampada', quantity: 1.5, unit: 'm', amount: 67.5 }] },
  { id: 'ME-DEMO-1057', date: ago(1), total: 84, status: 'Preparando', note: '', lines: [{ name: 'Botones de madera (12 u.)', quantity: 2, unit: 'paq.', amount: 19 }, { name: 'Cierre metálico 20 cm', quantity: 5, unit: 'u', amount: 65 }] },
  { id: 'ME-DEMO-1056', date: ago(3), total: 246.8, status: 'Pendiente', note: 'Confirmar horario de recojo.', lines: [{ name: 'Tijera de costura', quantity: 1, unit: 'u', amount: 92 }, { name: 'Tela popelina estampada', quantity: 2.8, unit: 'm', amount: 126 }, { name: 'Hilo de algodón 100 g', quantity: 1, unit: 'u', amount: 18.5 }] },
  { id: 'ME-DEMO-1055', date: ago(10), total: 56.5, status: 'Entregada', note: '', lines: [{ name: 'Cinta métrica 150 cm', quantity: 1, unit: 'u', amount: 16 }, { name: 'Botones de madera (12 u.)', quantity: 3, unit: 'paq.', amount: 28.5 }] },
  { id: 'ME-DEMO-1054', date: ago(20), total: 312, status: 'Entregada', note: 'Compra para taller de costura.', lines: [{ name: 'Tela popelina estampada', quantity: 6, unit: 'm', amount: 270 }, { name: 'Hilo de algodón 100 g', quantity: 2, unit: 'u', amount: 37 }] },
  { id: 'ME-DEMO-1053', date: ago(45), total: 179.5, status: 'Cancelada', note: 'Cancelación de demostración.', lines: [{ name: 'Tijera de costura', quantity: 1, unit: 'u', amount: 92 }, { name: 'Cierre metálico 20 cm', quantity: 5, unit: 'u', amount: 65 }] },
  { id: 'ME-DEMO-1052', date: ago(130), total: 98, status: 'Entregada', note: '', lines: [{ name: 'Hilo de algodón 100 g', quantity: 3, unit: 'u', amount: 55.5 }, { name: 'Cinta métrica 150 cm', quantity: 2, unit: 'u', amount: 32 }] },
  { id: 'ME-DEMO-1051', date: ago(270), total: 425, status: 'Entregada', note: 'Pedido de temporada.', lines: [{ name: 'Tela popelina estampada', quantity: 8, unit: 'm', amount: 360 }, { name: 'Botones de madera (12 u.)', quantity: 4, unit: 'paq.', amount: 38 }] }
];

let sales = [];
let inventory = [];
let restocks = [];
let notifications = [];
let authenticatedUser = null;

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

function readCollection(key, demoData) {
  const stored = localStorage.getItem(key);
  if (stored === null) {
    localStorage.setItem(key, JSON.stringify(demoData));
    return demoData;
  }
  const parsed = JSON.parse(stored);
  if (!Array.isArray(parsed)) throw new Error(`Los datos locales de ${key} no tienen un formato válido.`);
  return parsed;
}

function setStatus(message, kind = '') {
  const status = $('#adminStatus');
  status.textContent = message;
  status.className = `admin-status${kind ? ` ${kind}` : ''}`;
}

function hasAdminAccess(user = authenticatedUser) {
  return user?.localDemo === true &&
    user?.email?.trim().toLowerCase() === ADMIN_EMAIL &&
    user?.rol === 'ADMIN';
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
  $('#metricTodayIncome').textContent = `${money(income(today))} en ventas de muestra`;
  $('#metricMonthSales').textContent = String(thisMonth.length);
  $('#metricMonthIncome').textContent = `${money(income(thisMonth))} en ventas de muestra`;
  $('#metricProducts').textContent = String(inventory.length);
  const low = inventory.filter(isLowStock).length;
  $('#metricLowStock').textContent = `${low} producto${low === 1 ? '' : 's'} con stock bajo`;
}

function renderSales() {
  $('#salesCount').textContent = `${sales.length} ventas de demostración`;
  const rows = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date));
  $('#salesRows').innerHTML = rows.length ? rows.map(sale => `
    <tr>
      <td><strong>${escapeHTML(sale.id)}</strong><span class="table-meta">${escapeHTML(localDate(sale.date))}</span></td>
      <td>${sale.lines.map(line => `<span class="sale-line">${escapeHTML(line.name)} × ${escapeHTML(line.quantity)} ${escapeHTML(line.unit)} <span class="table-meta">${money(line.amount)}</span></span>`).join('')}</td>
      <td class="amount">${money(sale.total)}</td>
      <td><span class="status-pill">${escapeHTML(sale.status)}</span></td>
      <td><form class="note-form" data-sale-id="${escapeHTML(sale.id)}">
        <label class="sr" for="note-${escapeHTML(sale.id)}">Observación de ${escapeHTML(sale.id)}</label>
        <textarea id="note-${escapeHTML(sale.id)}" name="note" rows="2" maxlength="300" placeholder="Agregar observación">${escapeHTML(sale.note)}</textarea>
        <button class="btn btn--sm" type="submit">Guardar</button>
      </form></td>
    </tr>`).join('') : '<tr><td colspan="5" class="empty-cell">No hay ventas en el registro local.</td></tr>';
}

function renderInventory() {
  const select = $('#restockProduct');
  const selected = select.value;
  select.innerHTML = inventory.map(product =>
    `<option value="${escapeHTML(product.id)}">${escapeHTML(product.name)} (${escapeHTML(product.stock)} ${escapeHTML(product.unit)})</option>`
  ).join('');
  if (inventory.some(product => product.id === selected)) select.value = selected;
  $('#inventoryRows').innerHTML = inventory.length ? inventory.map(product => `
    <tr><td>${escapeHTML(product.name)}</td><td>${escapeHTML(product.stock)} ${escapeHTML(product.unit)}</td>
      <td><span class="stock ${isLowStock(product) ? 'low' : 'ok'}">${isLowStock(product) ? 'Stock bajo' : 'Disponible'}</span></td></tr>`
  ).join('') : '<tr><td colspan="3" class="empty-cell">No hay productos en el inventario de muestra.</td></tr>';
  $('#metricProducts').textContent = String(inventory.length);
  const low = inventory.filter(isLowStock).length;
  $('#metricLowStock').textContent = `${low} producto${low === 1 ? '' : 's'} con stock bajo`;
}

function renderRestocks() {
  const rows = [...restocks].sort((a, b) => new Date(b.date) - new Date(a.date));
  $('#restockRows').innerHTML = rows.length ? rows.map(entry => `
    <tr><td>${escapeHTML(localDate(entry.date))}</td><td>${escapeHTML(entry.type || 'Reposición')} · ${escapeHTML(entry.productName)}</td>
      <td class="${entry.direction === 'remove' ? 'movement-negative' : 'movement-positive'}">${entry.direction === 'remove' ? '−' : '+'}${escapeHTML(entry.quantity)} ${escapeHTML(entry.unit)}</td><td>${escapeHTML(entry.stockAfter)} ${escapeHTML(entry.unit)}</td></tr>`
  ).join('') : '<tr><td colspan="4" class="empty-cell">Aún no se registraron reposiciones.</td></tr>';
}

function renderNotifications() {
  const rows = [...notifications].sort((a, b) => new Date(b.date) - new Date(a.date));
  $('#notificationRows').innerHTML = rows.length ? rows.map(item => `
    <tr><td>${escapeHTML(localDate(item.date))}</td><td>${escapeHTML(item.to)}</td>
      <td class="notification-content">${escapeHTML(item.message)}</td>
      <td><span class="status-pill status-pill--local">${escapeHTML(item.status)}</span></td></tr>`
  ).join('') : '<tr><td colspan="4" class="empty-cell">No hay notificaciones de prueba registradas.</td></tr>';
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

function renderSalesChart(period, rangeStart, matches, rangeLabel) {
  const chart = $('#salesChart');
  const activeSales = matches.filter(sale => sale.status.toLocaleLowerCase() !== 'cancelada');
  const buckets = getChartBuckets(period, rangeStart);
  activeSales.forEach(sale => {
    const saleDate = new Date(sale.date);
    let index;
    if (period === 'day') index = saleDate.getHours();
    else if (period === 'year') index = saleDate.getMonth();
    else {
      const saleDay = Date.UTC(saleDate.getFullYear(), saleDate.getMonth(), saleDate.getDate());
      const firstDay = Date.UTC(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate());
      index = Math.floor((saleDay - firstDay) / 86400000);
    }
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
  $('#reportResults').innerHTML = `
    <article><span>Ventas no canceladas</span><strong>${activeSales.length}</strong></article>
    <article><span>Ingresos de demostración</span><strong>${money(revenue)}</strong></article>
    <p>${activeSales.length ? `Ingresos basados en ${activeSales.length} venta${activeSales.length === 1 ? '' : 's'} no cancelada${activeSales.length === 1 ? '' : 's'} de demostración.` : 'No hay ventas no canceladas en este periodo. Los resultados son Bs 0,00.'} ${matches.length > activeSales.length ? 'Las ventas canceladas no se incluyen en el ingreso.' : ''}</p>`;
}

function refreshDashboard() {
  renderMetrics();
  renderSales();
  renderInventory();
  renderRestocks();
  renderNotifications();
  renderReport();
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
    refreshDashboard();
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
  sales = readCollection(KEYS.sales, DEMO_SALES);
  const storedStock = localStorage.getItem(KEYS.stock);
  if (storedStock === null) {
    inventory = DEMO_PRODUCTS;
    restocks = [];
    localStorage.setItem(KEYS.stock, JSON.stringify({ inventory, restocks }));
  } else {
    const parsedStock = JSON.parse(storedStock);
    if (!parsedStock || !Array.isArray(parsedStock.inventory) || !Array.isArray(parsedStock.restocks)) {
      throw new Error('El inventario local no tiene un formato válido.');
    }
    inventory = parsedStock.inventory;
    restocks = parsedStock.restocks;
  }
  notifications = readCollection(KEYS.notifications, []);
  $('#adminToggle').hidden = !hasAdminAccess();

  $('#reportDate').value = localDateInput(new Date());

  $('#reportForm').addEventListener('submit', event => {
    event.preventDefault();
    renderReport();
  });
  $('#reportPeriod').addEventListener('change', renderReport);
  $('#reportDate').addEventListener('change', renderReport);

  $('#salesRows').addEventListener('submit', event => {
    const form = event.target.closest('.note-form');
    if (!form) return;
    event.preventDefault();
    if (!hasAdminAccess()) return;
    const sale = sales.find(item => item.id === form.dataset.saleId);
    if (!sale) {
      setStatus('No se encontró esa venta en el registro local.', 'bad');
      return;
    }
    const nextSales = sales.map(item => item.id === sale.id
      ? { ...item, note: new FormData(form).get('note').toString().trim() }
      : item);
    try {
      localStorage.setItem(KEYS.sales, JSON.stringify(nextSales));
      sales = nextSales;
      renderSales();
      setStatus(`Observación de ${sale.id} guardada localmente.`, 'ok');
    } catch (error) {
      setStatus(`No se pudo guardar la observación: ${error.message}`, 'bad');
    }
  });

  $('#restockForm').addEventListener('submit', event => {
    event.preventDefault();
    if (!hasAdminAccess()) return;
    const error = $('#restockError');
    error.textContent = '';
    const quantityInput = $('#restockQuantity');
    const quantity = Number(quantityInput.value);
    const product = inventory.find(item => item.id === $('#restockProduct').value);
    if (!product) {
      error.textContent = 'Selecciona un producto válido.';
      return;
    }
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      error.textContent = 'Ingresa una cantidad entera mayor que cero.';
      quantityInput.focus();
      return;
    }
    const direction = $('#stockAction').value;
    if (direction === 'remove' && quantity > Number(product.stock)) {
      error.textContent = `No puedes reducir ${quantity}: el stock disponible es ${product.stock} ${product.unit}.`;
      quantityInput.focus();
      return;
    }
    const stockAfter = Number(product.stock) + (direction === 'add' ? quantity : -quantity);
    if (!Number.isSafeInteger(stockAfter)) {
      error.textContent = 'La cantidad supera el límite permitido.';
      quantityInput.focus();
      return;
    }
    const nextInventory = inventory.map(item => item.id === product.id ? { ...item, stock: stockAfter } : item);
    const entry = {
      id: `REP-${Date.now()}`,
      date: new Date().toISOString(),
      type: direction === 'add' ? 'Aumento de stock' : 'Reducción de stock',
      direction,
      productId: product.id,
      productName: product.name,
      quantity,
      unit: product.unit,
      stockAfter
    };
    const nextRestocks = [...restocks, entry];
    try {
      localStorage.setItem(KEYS.stock, JSON.stringify({ inventory: nextInventory, restocks: nextRestocks }));
      inventory = nextInventory;
      restocks = nextRestocks;
      event.currentTarget.reset();
      refreshDashboard();
      error.className = 'admin-status ok';
      error.textContent = `${direction === 'add' ? 'Stock aumentado' : 'Stock reducido'}: ${product.name} ahora tiene ${stockAfter} ${product.unit}.`;
    } catch (saveError) {
      error.className = 'admin-status bad';
      error.textContent = `No se pudo guardar la reposición local: ${saveError.message}`;
    }
  });

  $('#newProductForm').addEventListener('submit', event => {
    event.preventDefault();
    if (!hasAdminAccess()) return;
    const form = event.currentTarget;
    const status = $('#newProductStatus');
    status.className = 'admin-status';
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const name = data.get('name').toString().trim();
    const stock = Number(data.get('stock'));
    const lowAt = Number(data.get('lowAt'));
    if (!name) {
      status.className = 'admin-status bad';
      status.textContent = 'Escribe un nombre de producto válido.';
      return;
    }
    if (!Number.isSafeInteger(stock) || stock < 0 || !Number.isSafeInteger(lowAt) || lowAt < 0) {
      status.className = 'admin-status bad';
      status.textContent = 'El stock y el umbral deben ser números enteros iguales o mayores que cero.';
      return;
    }
    if (inventory.some(product => product.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      status.className = 'admin-status bad';
      status.textContent = 'Ya existe un producto con ese nombre.';
      return;
    }
    const unit = data.get('unit').toString();
    const product = {
      id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      stock,
      unit,
      lowAt
    };
    const nextInventory = [...inventory, product];
    const nextRestocks = [...restocks, {
      id: `ALTA-${Date.now()}`,
      date: new Date().toISOString(),
      type: 'Alta de producto',
      direction: 'add',
      productId: product.id,
      productName: product.name,
      quantity: stock,
      unit,
      stockAfter: stock
    }];
    try {
      localStorage.setItem(KEYS.stock, JSON.stringify({ inventory: nextInventory, restocks: nextRestocks }));
      inventory = nextInventory;
      restocks = nextRestocks;
      form.reset();
      $('#newProductStock').value = '0';
      $('#newProductLowAt').value = '5';
      refreshDashboard();
      status.className = 'admin-status ok';
      status.textContent = `${name} agregado al inventario local con stock inicial ${stock} ${unit}`;
    } catch (error) {
      status.className = 'admin-status bad';
      status.textContent = `No se pudo guardar el producto: ${error.message}`;
    }
  });

  $('#notificationForm').addEventListener('submit', event => {
    event.preventDefault();
    if (!hasAdminAccess()) return;
    const form = event.currentTarget;
    const status = $('#notificationStatus');
    status.className = 'admin-status';
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const entry = {
      id: `NOTIF-${Date.now()}`,
      date: new Date().toISOString(),
      to: data.get('to').toString().trim(),
      message: data.get('message').toString().trim(),
      status: 'Simulación local: no enviado'
    };
    const nextNotifications = [...notifications, entry];
    try {
      localStorage.setItem(KEYS.notifications, JSON.stringify(nextNotifications));
      notifications = nextNotifications;
      form.reset();
      $('#notificationTo').value = 'admin@merceriaexpress.test';
      renderNotifications();
      status.className = 'admin-status ok';
      status.textContent = 'Notificación de prueba registrada localmente. No se envió ningún correo.';
    } catch (error) {
      status.className = 'admin-status bad';
      status.textContent = `No se pudo guardar la notificación local: ${error.message}`;
    }
  });

  refreshDashboard();
}

try {
  initAdmin();
} catch (error) {
  console.error('No se pudo iniciar el panel local de administración.', error);
  setStatus(`No se pudo cargar el panel: ${error.message}`, 'bad');
}
