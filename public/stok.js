let allStocks = [];
let stockStats = null;
const STOCK_SUMMARY_CACHE_KEY = 'inokas_stock_summary_v1';

document.addEventListener('DOMContentLoaded', async () => {
  setupStockUi();
  await refreshStocks(false);
});

function setupStockUi() {
  document.getElementById('stockSearch')?.addEventListener('input', renderStocksTable);
}

async function refreshStocks(force = false) {
  const tableBody = document.getElementById('stocksTableBody');
  const emptyState = document.getElementById('stocksEmptyState');
  if (!tableBody || !emptyState) return;

  if (!force) {
    const cached = readStockCache();
    if (cached) {
      allStocks = cached.data;
      stockStats = cached.stats;
      renderStockStats(allStocks, stockStats);
      renderStocksTable();
      return;
    }
  }

  tableBody.innerHTML = '';
  emptyState.style.display = 'block';
  emptyState.innerText = force ? 'Stok verisi yenileniyor...' : 'Stok verisi yükleniyor...';

  try {
    const response = await fetch('/api/stocks/summary');
    if (!response.ok) throw new Error('Stok verileri alınamadı');
    const payload = await response.json();
    allStocks = payload.data || [];
    stockStats = payload.stats || null;
    writeStockCache(allStocks, stockStats);

    renderStockStats(allStocks, stockStats);
    renderStocksTable();
  } catch (error) {
    console.error('Stok verisi hatası:', error);
    allStocks = [];
    emptyState.innerText = 'Stok verileri alınamadı.';
  }
}

function renderStocksTable() {
  const tableBody = document.getElementById('stocksTableBody');
  const emptyState = document.getElementById('stocksEmptyState');
  const search = (document.getElementById('stockSearch')?.value || '').trim().toLowerCase();
  if (!tableBody || !emptyState) return;

  const filtered = allStocks.filter((row) => {
    const name = String(row.product_name || '').toLowerCase();
    const sku = String(row.sku || '').toLowerCase();
    return !search || name.includes(search) || sku.includes(search);
  });

  tableBody.innerHTML = '';
  if (!filtered.length) {
    emptyState.style.display = 'block';
    emptyState.innerText = 'Gösterilecek stok kaydı bulunamadı.';
    return;
  }

  emptyState.style.display = 'none';
  filtered.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.product_name || '-'}</td>
      <td>${row.sku || '-'}</td>
      <td class="text-right">${formatQty(row.total_in)}</td>
      <td class="text-right">${formatQty(row.total_out)}</td>
      <td class="text-right"><strong>${formatQty(row.current_stock)}</strong></td>
      <td class="text-right">${formatUsdOrDash(row.in_unit_usd)}</td>
      <td class="text-right">${formatUsdOrDash(row.out_unit_usd)}</td>
      <td class="text-right"><strong>${formatUsdOrDash(row.stock_usd)}</strong></td>
    `;
    tableBody.appendChild(tr);
  });
}

function renderStockStats(rows, stats) {
  const fallback = rows.reduce((acc, row) => {
    acc.totalIn += Number(row.total_in || 0);
    acc.totalOut += Number(row.total_out || 0);
    acc.current += Number(row.current_stock || 0);
    return acc;
  }, { totalIn: 0, totalOut: 0, current: 0, stockUsd: 0, outUsd: 0 });

  document.getElementById('stat-product-count').innerText = String(rows.length);
  document.getElementById('stat-total-in').innerText = formatQty(stats?.total_in_qty ?? fallback.totalIn);
  document.getElementById('stat-total-out').innerText = formatQty(stats?.total_out_qty ?? fallback.totalOut);
  document.getElementById('stat-current').innerText = formatQty(stats?.current_qty ?? fallback.current);
  document.getElementById('stat-stock-usd').innerText = formatUsd(stats?.stock_usd ?? fallback.stockUsd);
  document.getElementById('stat-out-usd').innerText = formatUsd(stats?.total_out_usd ?? fallback.outUsd);
}

function formatQty(value) {
  return Number(value || 0).toLocaleString('tr-TR');
}

function formatUsd(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatUsdOrDash(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return formatUsd(value);
}

function readStockCache() {
  try {
    const raw = sessionStorage.getItem(STOCK_SUMMARY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.data)) return null;
    return {
      data: parsed.data,
      stats: parsed.stats || null
    };
  } catch (e) {
    console.warn('Stok cache okunamadı:', e);
    return null;
  }
}

function writeStockCache(data, stats) {
  try {
    sessionStorage.setItem(STOCK_SUMMARY_CACHE_KEY, JSON.stringify({ data, stats }));
  } catch (e) {
    console.warn('Stok cache yazılamadı:', e);
  }
}
