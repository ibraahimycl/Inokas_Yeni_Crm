let analysisView = 'suppliers';
let allInvoices = [];

document.addEventListener('DOMContentLoaded', async () => {
  setupAnalysisUi();
  await fetchInvoicesForAnalysis();
  renderCompanyCards();
});

function setupAnalysisUi() {
  const tabSuppliers = document.getElementById('tabSuppliers');
  const tabCustomers = document.getElementById('tabCustomers');
  const searchInput = document.getElementById('companySearch');

  tabSuppliers?.addEventListener('click', () => switchAnalysisView('suppliers'));
  tabCustomers?.addEventListener('click', () => switchAnalysisView('customers'));
  searchInput?.addEventListener('input', renderCompanyCards);
  document.getElementById('btnCloseCompanyModal')?.addEventListener('click', closeCompanyModal);
  document.getElementById('companyDetailModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'companyDetailModal') closeCompanyModal();
  });
}

function switchAnalysisView(view) {
  analysisView = view;
  document.getElementById('tabSuppliers')?.classList.toggle('active', view === 'suppliers');
  document.getElementById('tabCustomers')?.classList.toggle('active', view === 'customers');
  renderCompanyCards();
}

async function fetchInvoicesForAnalysis() {
  const emptyState = document.getElementById('analysisEmptyState');
  if (emptyState) {
    emptyState.style.display = 'block';
    emptyState.innerText = 'Rapor verisi yükleniyor...';
  }

  try {
    const response = await fetch('/api/invoices');
    if (!response.ok) throw new Error('Faturalar çekilemedi');
    allInvoices = await response.json();
  } catch (error) {
    console.error('Cari analiz veri çekme hatası:', error);
    allInvoices = [];
    if (emptyState) {
      emptyState.style.display = 'block';
      emptyState.innerText = 'Veriler alınamadı. Lütfen sayfayı yenileyin.';
    }
  }
}

function renderCompanyCards() {
  const grid = document.getElementById('companyCardsGrid');
  const emptyState = document.getElementById('analysisEmptyState');
  const searchText = (document.getElementById('companySearch')?.value || '').trim().toLowerCase();
  if (!grid || !emptyState) return;

  const direction = analysisView === 'suppliers' ? 'INCOMING' : 'OUTGOING';
  const grouped = groupByCompany(allInvoices, direction);
  const cards = Object.values(grouped)
    .filter((c) => !searchText || c.name.toLowerCase().includes(searchText))
    .sort((a, b) => b.pendingTotalTl - a.pendingTotalTl);

  grid.innerHTML = '';
  if (!cards.length) {
    emptyState.style.display = 'block';
    emptyState.innerText = 'Bu görünümde gösterilecek firma bulunamadı.';
    return;
  }

  emptyState.style.display = 'none';
  cards.forEach((company) => grid.appendChild(createCompanyCard(company)));
}

function groupByCompany(invoices, direction) {
  const map = {};

  invoices
    .filter((inv) => inv.direction === direction)
    .forEach((inv) => {
      const name = inv.companies?.name || 'Bilinmeyen Firma';
      if (!map[name]) {
        map[name] = {
          name,
          invoiceCount: 0,
          pendingTotalTl: 0,
          currencyStats: {},
          invoices: []
        };
      }

      const bucket = map[name];
      const currency = normalizeCurrency(inv.currency);
      const totalTl = parseFloat(inv.total_amount_tl) || 0;
      const paidTl = Math.min(parseFloat(inv.paid_amount) || 0, totalTl);
      const pendingTl = Math.max(totalTl - paidTl, 0);

      const totalCur = getInvoiceCurrencyTotal(inv);
      const paidCur = totalTl > 0 ? (totalCur * (paidTl / totalTl)) : 0;
      const pendingCur = Math.max(totalCur - paidCur, 0);

      bucket.invoiceCount += 1;
      bucket.pendingTotalTl += pendingTl;
      bucket.invoices.push(inv);

      if (!bucket.currencyStats[currency]) {
        bucket.currencyStats[currency] = { pending: 0, paid: 0 };
      }
      bucket.currencyStats[currency].pending += pendingCur;
      bucket.currencyStats[currency].paid += paidCur;
    });

  return map;
}

function createCompanyCard(company) {
  const card = document.createElement('article');
  card.className = `company-card ${analysisView === 'suppliers' ? 'supplier' : 'customer'}`;

  const rows = Object.entries(company.currencyStats)
    .sort(([a], [b]) => a.localeCompare(b, 'tr'))
    .map(([currency, stat]) => {
      const sideLabel = analysisView === 'suppliers' ? 'BEKLEYEN' : 'ALACAK';
      const paidLabel = analysisView === 'suppliers' ? 'ÖDENEN' : 'TAHSİL';
      return `
        <div class="company-row">
          <span class="label">${currency} ${sideLabel}</span>
          <span class="value pending">${formatNumber(stat.pending)} ${currency}</span>
        </div>
        <div class="company-row">
          <span class="label">${currency} ${paidLabel}</span>
          <span class="value paid">${formatNumber(stat.paid)} ${currency}</span>
        </div>
      `;
    })
    .join('');

  card.innerHTML = `
    <div class="company-name">${company.name}</div>
    <div class="company-row">
      <span class="label">FATURA</span>
      <span class="value">${company.invoiceCount}</span>
    </div>
    ${rows}
  `;
  card.addEventListener('click', () => openCompanyModal(company));

  return card;
}

function openCompanyModal(company) {
  const modal = document.getElementById('companyDetailModal');
  const header = document.getElementById('companyModalHeader');
  if (!modal || !header) return;

  const isSuppliers = analysisView === 'suppliers';
  header.classList.remove('supplier', 'customer');
  header.classList.add(isSuppliers ? 'supplier' : 'customer');

  document.getElementById('detailCompanyName').innerText = company.name;
  document.getElementById('detailCompanySubtitle').innerText = isSuppliers
    ? 'Tedarikçi Hesap Özeti'
    : 'Müşteri Hesap Özeti';

  document.getElementById('detailInvoiceCount').innerText = String(company.invoiceCount);
  document.getElementById('detailPendingLabel').innerText = isSuppliers ? 'Bekleyen Borç' : 'Bekleyen Alacak';
  document.getElementById('detailPaidLabel').innerText = isSuppliers ? 'Ödenen' : 'Tahsil Edilen';

  const totalsByCurrency = aggregateCompanyCurrencies(company.invoices);
  document.getElementById('detailTotalVolume').innerText = formatCurrencyLines(totalsByCurrency, 'total');
  document.getElementById('detailPending').innerText = formatCurrencyLines(totalsByCurrency, 'pending');
  document.getElementById('detailPaid').innerText = formatCurrencyLines(totalsByCurrency, 'paid');

  renderCompanyInvoiceHistory(company.invoices);
  modal.style.display = 'flex';
}

function closeCompanyModal() {
  const modal = document.getElementById('companyDetailModal');
  if (modal) modal.style.display = 'none';
}

function aggregateCompanyCurrencies(invoices) {
  const byCurrency = {};
  invoices.forEach((inv) => {
    const currency = normalizeCurrency(inv.currency);
    const totalTl = parseFloat(inv.total_amount_tl) || 0;
    const paidTl = Math.min(parseFloat(inv.paid_amount) || 0, totalTl);
    const totalCur = getInvoiceCurrencyTotal(inv);
    const paidCur = totalTl > 0 ? (totalCur * (paidTl / totalTl)) : 0;
    const pendingCur = Math.max(totalCur - paidCur, 0);

    if (!byCurrency[currency]) byCurrency[currency] = { total: 0, pending: 0, paid: 0 };
    byCurrency[currency].total += totalCur;
    byCurrency[currency].pending += pendingCur;
    byCurrency[currency].paid += paidCur;
  });
  return byCurrency;
}

function formatCurrencyLines(currencyMap, field) {
  const parts = Object.entries(currencyMap)
    .sort(([a], [b]) => a.localeCompare(b, 'tr'))
    .map(([currency, stats]) => `${formatNumber(stats[field])} ${currency}`);
  return parts.length ? parts.join('  ·  ') : '-';
}

function renderCompanyInvoiceHistory(invoices) {
  const tbody = document.getElementById('detailInvoicesBody');
  if (!tbody) return;

  const sorted = [...invoices].sort((a, b) => {
    const da = new Date(a.invoice_date || 0).getTime();
    const db = new Date(b.invoice_date || 0).getTime();
    return db - da;
  });

  tbody.innerHTML = '';
  sorted.forEach((inv) => {
    const tr = document.createElement('tr');
    const currency = normalizeCurrency(inv.currency);
    const status = (inv.status || 'unpaid').toLowerCase();
    tr.innerHTML = `
      <td>${inv.invoice_no || '-'}</td>
      <td>${formatDate(inv.invoice_date)}</td>
      <td>${formatDate(inv.due_date)}</td>
      <td>${formatNumber(getInvoiceCurrencyTotal(inv))} ${currency}</td>
      <td>${renderStatusChip(status)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('tr-TR');
}

function renderStatusChip(status) {
  if (status === 'paid') return '<span class="status-chip paid">Ödendi</span>';
  if (status === 'partial') return '<span class="status-chip partial">Kısmi</span>';
  return '<span class="status-chip unpaid">Bekliyor</span>';
}

function getInvoiceCurrencyTotal(inv) {
  const totalCurrency = parseFloat(inv.total_currency);
  if (!Number.isNaN(totalCurrency) && totalCurrency > 0) return totalCurrency;
  return parseFloat(inv.total_amount_tl) || 0;
}

function normalizeCurrency(cur) {
  if (!cur) return 'TL';
  const v = String(cur).toUpperCase();
  if (v === 'TRY') return 'TL';
  return v;
}

function formatNumber(num) {
  return Number(num || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
