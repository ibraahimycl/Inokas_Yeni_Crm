// ── CHARTS ───────────────────────────────────────────────────────────────────

let chartInstances = {};

function destroyCharts() {
    Object.values(chartInstances).forEach(c => c.destroy());
    chartInstances = {};
}

// ── CHART HELPERS ─────────────────────────────────────────────────────────────
function clearChartsGrid() {
    destroyCharts();
    document.getElementById("chartsGrid").innerHTML = "";
}

function createChartCanvas(id, title, spanTwo = false) {
    const grid = document.getElementById("chartsGrid");
    const div  = document.createElement("div");
    div.className = `chart-card${spanTwo ? " span-2" : ""}`;
    div.innerHTML = `
        <h3 class="chart-title">${title}</h3>
        <canvas id="${id}"></canvas>
    `;
    grid.appendChild(div);
}

// ── MAIN CHART LOADER ─────────────────────────────────────────────────────────
async function loadCharts(orders) {
    clearChartsGrid();
    const f = getActiveFilters();

    if (orders.length === 0) {
        document.getElementById("chartsGrid").innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:40px; color:#94a3b8;">
                Grafik için yeterli veri yok
            </div>`;
        return;
    }

    // ── Always show ───────────────────────────────────────────────────────────
    createChartCanvas("monthlyProfitChart", "📈 Aylık Net Kar Trendi", true);
    renderMonthlyProfitChart(orders);


    // ── Default view — no filters ─────────────────────────────────────────────
    if (!f.hasCompany && !f.hasProduct) {
        createChartCanvas("topCustomersChart",   "🏢 En Çok Sipariş Veren Müşteriler");
        createChartCanvas("topProductsChart",    "📦 En Çok Sipariş Edilen Ürünler");
        createChartCanvas("basketComparisonChart", "📊 DMO vs İnokas Sepet", true);
        renderTopCustomersChart(orders);
        await renderTopProductsChart(orders);
        renderBasketComparisonChart(orders);
        return;
    }

    // ── Company only ──────────────────────────────────────────────────────────
    if (f.hasCompany && !f.hasProduct) {
        createChartCanvas("customerProductMixChart",     "🥧 Ürün Dağılımı");
        createChartCanvas("customerOrderFrequencyChart", "📅 Sipariş Sıklığı");
        await renderCustomerProductMixChart(orders);
        renderCustomerOrderFrequencyChart(orders);
        return;
    }

    // ── Product only ──────────────────────────────────────────────────────────
    if (f.hasProduct && !f.hasCompany) {
        createChartCanvas("productCustomerChart",       "🏢 Bu Ürünü En Çok Kim Aldı");
        createChartCanvas("productQuantityTrendChart",  "📦 Miktar Trendi");
        await renderProductCustomerChart(orders);
        renderProductQuantityTrendChart(orders);
        return;
    }

    // ── Both company + product ────────────────────────────────────────────────
    if (f.hasCompany && f.hasProduct) {
        createChartCanvas("marginTrendChart",  "💰 Kar Marjı Trendi", true);
        createChartCanvas("basketComparisonChart", "📊 DMO vs İnokas Sepet", true);
        renderMarginTrendChart(orders);
        renderBasketComparisonChart(orders);
        return;
    }
}

// ── 1. MONTHLY PROFIT TREND (LINE) ───────────────────────────────────────────
function renderMonthlyProfitChart(orders) {
    const el = document.getElementById("monthlyProfitChart");
    if (!el || orders.length === 0) return;  // ← add this
    const monthly = {};
    orders.forEach(o => {
        const month = o.order_date?.slice(0, 7);
        if (!month) return;
        if (!monthly[month]) monthly[month] = 0;
        monthly[month] += o.net_profit || 0;
    });

    const labels = Object.keys(monthly).map(m => {
        const [y, mo] = m.split("-");
        return `${mo}/${y}`;
    });

    chartInstances.monthly = new Chart(document.getElementById("monthlyProfitChart"), {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Net Kar (₺)",
                data: Object.values(monthly),
                borderColor: "#2563eb",
                backgroundColor: "rgba(37,99,235,0.08)",
                borderWidth: 2,
                pointRadius: 4,
                tension: 0.3,
                fill: true,
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => formatAmount(ctx.raw) + " ₺"
                    }
                }
            },
            scales: {
                y: {
                    ticks: { callback: val => formatAmount(val) + " ₺" }
                }
            }
        }
    });
}

// ── 2. CUSTOMER PIE CHART ────────────────────────────────────────────────────
function renderCustomerPieChart(orders) {
    const el = document.getElementById("customerPieChart");
    if (!el || orders.length === 0) return;  // ← add this
    const customers = {};
    orders.forEach(o => {
        const name = o.customer_name || "Bilinmeyen";
        if (!customers[name]) customers[name] = 0;
        customers[name] += o.dmo_basket_total || 0;
    });

    const labels = Object.keys(customers);
    const colors = [
        "#2563eb","#16a34a","#dc2626","#d97706",
        "#7c3aed","#0891b2","#db2777","#65a30d"
    ];

    chartInstances.pie = new Chart(document.getElementById("customerPieChart"), {
        type: "doughnut",
        data: {
            labels,
            datasets: [{
                data: Object.values(customers),
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: "#ffffff"
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: "bottom", labels: { font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.label}: ${formatAmount(ctx.raw)} ₺`
                    }
                }
            }
        }
    });
}

// ── 3. DMO vs İNOKAS BASKET COMPARISON (BAR) ─────────────────────────────────
function renderBasketComparisonChart(orders) {
    const el = document.getElementById("basketComparisonChart");
    if (!el || orders.length === 0) return;  // ← add this
    chartInstances.bar = new Chart(document.getElementById("basketComparisonChart"), {
        type: "bar",
        data: {
            labels: orders.map(o => o.sales_order_no),
            datasets: [
                {
                    label: "DMO Sepet",
                    data: orders.map(o => o.dmo_basket_total || 0),
                    backgroundColor: "rgba(37,99,235,0.7)",
                    borderRadius: 4,
                },
                {
                    label: "İnokas Sepet",
                    data: orders.map(o => o.inokas_basket_total || 0),
                    backgroundColor: "rgba(22,163,74,0.7)",
                    borderRadius: 4,
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${formatAmount(ctx.raw)} ₺`
                    }
                }
            },
            scales: {
                y: { ticks: { callback: val => formatAmount(val) + " ₺" } }
            }
        }
    });
}

async function renderUSDRateChart(dateStart, dateEnd) {
    const el = document.getElementById("usdRateChart");
    if (!el) return;  // ← add this

    const rates = await fetchUSDRateHistory(dateStart, dateEnd);
    if (!rates || Object.keys(rates).length === 0) return;

    const labels = Object.keys(rates);
    const values = labels.map(d => rates[d].TRY);

    if (chartInstances.usdRate) chartInstances.usdRate.destroy();

    chartInstances.usdRate = new Chart(document.getElementById("usdRateChart"), {
        type: "line",
        data: {
            labels: labels.map(d => formatDate(d)),
            datasets: [{
                label: "USD/TRY",
                data: values,
                borderColor: "#d97706",
                backgroundColor: "rgba(217,119,6,0.08)",
                borderWidth: 2,
                pointRadius: 2,
                tension: 0.3,
                fill: true,
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `1 USD = ${ctx.raw.toFixed(2)} ₺`
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: val => val.toFixed(2) + " ₺"
                    }
                }
            }
        }
    });
}


// ── TOP CUSTOMERS ─────────────────────────────────────────────────────────────
function renderTopCustomersChart(orders) {
    const el = document.getElementById("topCustomersChart");
    if (!el) return;

    const customers = {};
    orders.forEach(o => {
        const name = o.customer_name || "Bilinmeyen";
        if (!customers[name]) customers[name] = 0;
        customers[name] += o.dmo_basket_total || 0;
    });

    const sorted = Object.entries(customers)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    chartInstances.topCustomers = new Chart(el, {
        type: "bar",
        data: {
            labels: sorted.map(([name]) => name),
            datasets: [{
                data:            sorted.map(([, val]) => val),
                backgroundColor: "rgba(37,99,235,0.7)",
                borderRadius:    4,
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { callback: val => formatAmount(val) + " ₺" } }
            }
        }
    });
}

// ── TOP PRODUCTS ──────────────────────────────────────────────────────────────
async function renderTopProductsChart(orders) {
    const el = document.getElementById("topProductsChart");
    if (!el || orders.length === 0) return;

    const orderIds = orders.map(o => o.id);
    const { data: items } = await db
        .from("dmo_order_items")
        .select("quantity, products(product_name)")
        .in("order_id", orderIds);

    if (!items) return;

    const products = {};
    items.forEach(i => {
        const name = i.products?.product_name || "Bilinmeyen";
        if (!products[name]) products[name] = 0;
        products[name] += i.quantity || 0;
    });

    const sorted = Object.entries(products)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    chartInstances.topProducts = new Chart(el, {
        type: "bar",
        data: {
            labels: sorted.map(([name]) => name),
            datasets: [{
                data:            sorted.map(([, val]) => val),
                backgroundColor: "rgba(22,163,74,0.7)",
                borderRadius:    4,
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { callback: val => val + " adet" } }
            }
        }
    });
}

// ── CUSTOMER PRODUCT MIX ──────────────────────────────────────────────────────
async function renderCustomerProductMixChart(orders) {
    const el = document.getElementById("customerProductMixChart");
    if (!el || orders.length === 0) return;

    const orderIds = orders.map(o => o.id);
    const { data: items } = await db
        .from("dmo_order_items")
        .select("line_total_excl_vat, products(product_name)")
        .in("order_id", orderIds);

    if (!items) return;

    const products = {};
    items.forEach(i => {
        const name = i.products?.product_name || "Bilinmeyen";
        if (!products[name]) products[name] = 0;
        products[name] += i.line_total_excl_vat || 0;
    });

    const colors = ["#2563eb","#16a34a","#dc2626","#d97706","#7c3aed","#0891b2","#db2777","#65a30d"];
    const labels = Object.keys(products);

    chartInstances.customerProductMix = new Chart(el, {
        type: "doughnut",
        data: {
            labels,
            datasets: [{
                data:            Object.values(products),
                backgroundColor: colors.slice(0, labels.length),
                borderWidth:     2,
                borderColor:     "#ffffff"
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: "bottom", labels: { font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.label}: ${formatAmount(ctx.raw)} ₺`
                    }
                }
            }
        }
    });
}

// ── CUSTOMER ORDER FREQUENCY ──────────────────────────────────────────────────
function renderCustomerOrderFrequencyChart(orders) {
    const el = document.getElementById("customerOrderFrequencyChart");
    if (!el) return;

    const monthly = {};
    orders.forEach(o => {
        const month = o.order_date?.slice(0, 7);
        if (!month) return;
        if (!monthly[month]) monthly[month] = 0;
        monthly[month]++;
    });

    const labels = Object.keys(monthly).map(m => {
        const [y, mo] = m.split("-");
        return `${mo}/${y}`;
    });

    chartInstances.orderFrequency = new Chart(el, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label:           "Sipariş Sayısı",
                data:            Object.values(monthly),
                backgroundColor: "rgba(124,58,237,0.7)",
                borderRadius:    4,
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { ticks: { stepSize: 1 } }
            }
        }
    });
}

// ── PRODUCT CUSTOMER CHART ────────────────────────────────────────────────────
async function renderProductCustomerChart(orders) {
    const el = document.getElementById("productCustomerChart");
    if (!el || orders.length === 0) return;

    const orderIds = orders.map(o => o.id);
    const { data: items } = await db
        .from("dmo_order_items")
        .select("quantity, order_id")
        .in("order_id", orderIds);

    if (!items) return;

    const customerQty = {};
    items.forEach(i => {
        const order = orders.find(o => o.id === i.order_id);
        const name  = order?.customer_name || "Bilinmeyen";
        if (!customerQty[name]) customerQty[name] = 0;
        customerQty[name] += i.quantity || 0;
    });

    const sorted = Object.entries(customerQty).sort((a, b) => b[1] - a[1]);
    const colors = ["#2563eb","#16a34a","#dc2626","#d97706","#7c3aed"];

    chartInstances.productCustomer = new Chart(el, {
        type: "doughnut",
        data: {
            labels: sorted.map(([name]) => name),
            datasets: [{
                data:            sorted.map(([, val]) => val),
                backgroundColor: colors.slice(0, sorted.length),
                borderWidth:     2,
                borderColor:     "#ffffff"
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: "bottom" },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.label}: ${ctx.raw} adet`
                    }
                }
            }
        }
    });
}

// ── PRODUCT QUANTITY TREND ────────────────────────────────────────────────────
async function renderProductQuantityTrendChart(orders) {
    const el = document.getElementById("productQuantityTrendChart");
    if (!el || orders.length === 0) return;

    const orderIds = orders.map(o => o.id);
    const { data: items } = await db
        .from("dmo_order_items")
        .select("quantity, order_id")
        .in("order_id", orderIds);

    if (!items) return;

    const monthly = {};
    items.forEach(i => {
        const order = orders.find(o => o.id === i.order_id);
        const month = order?.order_date?.slice(0, 7);
        if (!month) return;
        if (!monthly[month]) monthly[month] = 0;
        monthly[month] += i.quantity || 0;
    });

    const labels = Object.keys(monthly).map(m => {
        const [y, mo] = m.split("-");
        return `${mo}/${y}`;
    });

    chartInstances.productQuantityTrend = new Chart(el, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label:           "Toplam Adet",
                data:            Object.values(monthly),
                borderColor:     "#16a34a",
                backgroundColor: "rgba(22,163,74,0.08)",
                borderWidth:     2,
                pointRadius:     4,
                tension:         0.3,
                fill:            true,
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { ticks: { callback: val => val + " adet" } }
            }
        }
    });
}

// ── MARGIN TREND ──────────────────────────────────────────────────────────────
function renderMarginTrendChart(orders) {
    const el = document.getElementById("marginTrendChart");
    if (!el) return;

    const sorted = [...orders].sort((a, b) => new Date(a.order_date) - new Date(b.order_date));

    chartInstances.marginTrend = new Chart(el, {
        type: "line",
        data: {
            labels: sorted.map(o => formatDate(o.order_date)),
            datasets: [{
                label:           "Kar %",
                data:            sorted.map(o => o.profit_percentage || 0),
                borderColor:     "#d97706",
                backgroundColor: "rgba(217,119,6,0.08)",
                borderWidth:     2,
                pointRadius:     4,
                tension:         0.3,
                fill:            true,
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { ticks: { callback: val => val.toFixed(1) + "%" } }
            }
        }
    });
}