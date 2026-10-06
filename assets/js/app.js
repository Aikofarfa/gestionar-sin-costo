import { supabase, supabaseConfigured } from "./supabase.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = { session: null, profile: null, role: "vendedor", view: "dashboard", authMode: "login", saleDraft: [] };
const titles = { dashboard: "Resumen", products: "Productos", sales: "Ventas", clients: "Clientes", reports: "Informes", users: "Usuarios" };
const money = value => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value || 0));
const dateTime = value => new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const dateShort = value => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(new Date(value));
const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const monthStart = () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; };
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const shortName = profile => (profile?.full_name || profile?.email || "Mi cuenta").trim();

function toast(message, type = "") {
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.textContent = message;
  $("#toast-root").append(node);
  window.setTimeout(() => node.remove(), 4200);
}

function setBusy(button, busy, label = "Procesando…") {
  if (!button) return;
  if (busy) { button.dataset.originalText = button.textContent; button.disabled = true; button.textContent = label; }
  else { button.disabled = false; button.textContent = button.dataset.originalText || button.textContent; }
}

function showAuth() {
  $("#connection-screen").hidden = true;
  $("#app-shell").hidden = true;
  $("#auth-screen").hidden = false;
  updateAuthForm();
}

function updateAuthForm() {
  const signup = state.authMode === "signup";
  $("#auth-eyebrow").textContent = signup ? "Empieza con GestPyme" : "Bienvenido de nuevo";
  $("#auth-title").textContent = signup ? "Crea tu cuenta" : "Inicia sesión";
  $("#auth-subtitle").textContent = signup ? "Tu cuenta nueva empezará con el rol de vendedor." : "Ingresa a tu espacio de trabajo.";
  $("#name-field").hidden = !signup;
  $("#name-field input").required = signup;
  $("#auth-submit").textContent = signup ? "Crear cuenta" : "Iniciar sesión";
  $("#auth-toggle").textContent = signup ? "¿Ya tienes cuenta? Iniciar sesión" : "¿Primera vez? Crear una cuenta";
  $("#auth-form input[name=password]").autocomplete = signup ? "new-password" : "current-password";
}

function bindAuth() {
  $("#auth-toggle").addEventListener("click", () => { state.authMode = state.authMode === "login" ? "signup" : "login"; updateAuthForm(); });
  $("#auth-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = $("#auth-submit");
    setBusy(submit, true);
    const values = new FormData(form);
    const email = String(values.get("email")).trim().toLowerCase();
    const password = String(values.get("password"));
    try {
      if (state.authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.href, data: { full_name: String(values.get("full_name")).trim() } } });
        if (error) throw error;
        if (!data.session) toast("Revisa tu correo para confirmar la cuenta y luego inicia sesión.");
        else toast("Cuenta creada. Un administrador debe aprobar tu acceso antes de entrar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) { toast(error.message || "No se pudo completar el acceso.", "error"); }
    finally { setBusy(submit, false); }
  });
  $("#auth-form").insertAdjacentHTML("afterend", '<button class="text-button auth-reset-link" id="reset-password" type="button">Olvidé mi contraseña</button>');
  $("#reset-password").addEventListener("click", async () => {
    const email = $("#auth-form input[name=email]").value.trim();
    if (!email) return toast("Escribe tu correo para enviarte el enlace de recuperación.", "error");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.href });
    if (error) toast(error.message, "error"); else toast("Si el correo existe, recibirás un enlace para recuperar la contraseña.");
  });
}

async function enterWorkspace(session) {
  state.session = session;
  if (!session) {
    state.profile = null;
    state.role = "vendedor";
    $("#pending-screen").hidden = true;
    showAuth();
    return;
  }
  $("#auth-screen").hidden = true;
  $("#pending-screen").hidden = true;
  $("#app-shell").hidden = false;
  const { data, error } = await supabase.from("profiles").select("id,email,full_name,role,is_active").eq("id", session.user.id).maybeSingle();
  if (error) { toast("No se pudo cargar el perfil. Verifica que la migración de Supabase esté aplicada.", "error"); }
  state.profile = data || { id: session.user.id, email: session.user.email, full_name: session.user.user_metadata?.full_name, role: "vendedor" };
  state.role = state.profile.role || "vendedor";
  if (!state.profile.is_active) {
    state.profile = { ...state.profile, role: "vendedor" };
    $("#app-shell").hidden = true;
    $("#pending-name").textContent = shortName(state.profile);
    $("#pending-screen").hidden = false;
    return;
  }
  const name = shortName(state.profile);
  $("#sidebar-name").textContent = name;
  $("#sidebar-role").textContent = state.role === "admin" ? "Administrador" : "Vendedor";
  $("#sidebar-avatar").textContent = (name[0] || "G").toLocaleUpperCase("es-CO");
  $("#topbar-name").textContent = state.profile.business_name || "Mi negocio";
  $$(".admin-only").forEach(node => { node.hidden = state.role !== "admin"; });
  await renderView();
}

function navigate(view) {
  if (view === "users" && state.role !== "admin") return toast("Solo un administrador puede gestionar usuarios.", "error");
  state.view = view;
  $$(".nav-link[data-view]").forEach(node => node.classList.toggle("active", node.dataset.view === view));
  $("#page-title").textContent = titles[view] || "Resumen";
  $("#sidebar").classList.remove("open");
  $("#mobile-menu").setAttribute("aria-expanded", "false");
  renderView();
}

async function renderView() {
  const root = $("#view-root");
  root.innerHTML = '<div class="skeleton" aria-label="Cargando"></div>';
  try {
    if (state.view === "dashboard") await renderDashboard(root);
    if (state.view === "products") await renderProducts(root);
    if (state.view === "sales") await renderSales(root);
    if (state.view === "clients") await renderClients(root);
    if (state.view === "reports") await renderReports(root);
    if (state.view === "users") await renderUsers(root);
  } catch (error) {
    console.error(error);
    root.innerHTML = `<div class="panel empty-state"><strong>No se pudo cargar esta sección</strong>${esc(error.message || "Verifica la conexión y vuelve a intentarlo.")}<br><button class="button button-secondary button-small retry-button" data-action="refresh">Reintentar</button></div>`;
  }
}

function intro(title, description, action = "") {
  return `<div class="view-intro"><div><h2>${title}</h2><p>${description}</p></div>${action}</div>`;
}
function actionButton(label, action) { return `<button class="button button-primary" data-action="${action}"><span aria-hidden="true">＋</span>${label}</button>`; }
function empty(title, detail) { return `<div class="empty-state"><strong>${title}</strong>${detail}</div>`; }
function badgeStock(product) { return Number(product.stock) <= Number(product.min_stock) ? '<span class="badge low">Stock bajo</span>' : '<span class="badge good">Disponible</span>'; }
function tableHead(labels) { return `<thead><tr>${labels.map(label => `<th>${label}</th>`).join("")}</tr></thead>`; }

async function renderDashboard(root) {
  const [productsResult, clientsResult, salesResult, itemsResult] = await Promise.all([
    supabase.from("products").select("id,name,code,category,price,stock,min_stock").order("name").limit(500),
    supabase.from("clients").select("id,name").order("name").limit(500),
    supabase.from("sales").select("id,client_id,total,created_at,user_id").order("created_at", { ascending: false }).limit(250),
    supabase.from("sale_items").select("product_id,quantity").limit(1000)
  ]);
  for (const result of [productsResult, clientsResult, salesResult, itemsResult]) if (result.error) throw result.error;
  const products = productsResult.data || [], clients = clientsResult.data || [], sales = salesResult.data || [], items = itemsResult.data || [];
  const now = new Date(), today = todayStart(), month = monthStart();
  const todaySales = sales.filter(sale => new Date(sale.created_at) >= today);
  const monthSales = sales.filter(sale => new Date(sale.created_at) >= month);
  const lowStock = products.filter(product => Number(product.stock) <= Number(product.min_stock));
  const clientMap = new Map(clients.map(client => [client.id, client.name]));
  const byProduct = new Map();
  for (const item of items) byProduct.set(item.product_id, (byProduct.get(item.product_id) || 0) + Number(item.quantity));
  const topProducts = products.map(product => ({ ...product, sold: byProduct.get(product.id) || 0 })).sort((a, b) => b.sold - a.sold).slice(0, 5);
  const chartDays = Array.from({ length: 7 }, (_, i) => { const date = new Date(); date.setDate(date.getDate() - (6 - i)); date.setHours(0, 0, 0, 0); const end = new Date(date); end.setDate(end.getDate() + 1); const amount = sales.filter(s => new Date(s.created_at) >= date && new Date(s.created_at) < end).reduce((sum, s) => sum + Number(s.total), 0); return { date, amount }; });
  const chartMax = Math.max(1, ...chartDays.map(day => day.amount));
  const metrics = [
    ["Ventas de hoy", money(todaySales.reduce((sum, sale) => sum + Number(sale.total), 0)), `${todaySales.length} transacciones`, "↗"],
    ["Ventas del mes", money(monthSales.reduce((sum, sale) => sum + Number(sale.total), 0)), `${monthSales.length} transacciones`, "$"],
    ["Productos activos", products.length.toLocaleString("es-CO"), "Referencias en catálogo", "▦"],
    ["Stock por revisar", lowStock.length.toLocaleString("es-CO"), lowStock.length ? "Requieren reposición" : "Todo en niveles saludables", "!" ]
  ];
  root.innerHTML = `${intro(`Hola, ${esc(shortName(state.profile).split(" ")[0])}`, "Este es el pulso de tu negocio.", actionButton("Registrar venta", "sale-new"))}
    <div class="metric-grid">${metrics.map(([label, value, note, symbol]) => `<article class="metric-card"><div class="metric-label"><span>${label}</span><span class="metric-symbol">${symbol}</span></div><strong class="metric-value">${value}</strong><span class="metric-note">${note}</span></article>`).join("")}</div>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-heading"><div><h3>Ventas recientes</h3><p>Actividad de los últimos siete días</p></div><button class="text-button" data-view-link="sales">Ver todas</button></div><div class="chart">${chartDays.map((day, i) => `<div class="chart-column"><div class="chart-bar-wrap"><div class="chart-bar ${i === 6 ? "current" : ""}" style="--bar-height:${Math.max(3, Math.round(day.amount / chartMax * 100))}%" title="${money(day.amount)}"></div></div><span>${new Intl.DateTimeFormat("es-CO", { weekday: "short" }).format(day.date)}</span></div>`).join("")}</div>
        <div class="stock-list dashboard-recent">${sales.slice(0, 4).map(sale => `<div class="stock-row"><div class="stock-product"><strong>${esc(clientMap.get(sale.client_id) || "Venta sin cliente")}</strong><small>${dateTime(sale.created_at)}</small></div><strong>${money(sale.total)}</strong></div>`).join("") || empty("Aún no hay ventas", "Registra la primera para ver la actividad aquí.")}</div>
      </section>
      <section class="panel"><div class="panel-heading"><div><h3>Stock por revisar</h3><p>${lowStock.length} referencias en nivel mínimo</p></div><button class="text-button" data-view-link="products">Productos</button></div>
        <div class="stock-list">${lowStock.slice(0, 6).map(product => `<div class="stock-row"><div class="stock-product"><strong>${esc(product.name)}</strong><small>${esc(product.code || product.category || "Sin código")}</small></div><span class="stock-count">${product.stock} un.</span></div>`).join("") || empty("Todo en orden", "No hay productos por debajo del nivel mínimo.")}</div>
      </section>
      <section class="panel"><div class="panel-heading"><div><h3>Productos más vendidos</h3><p>Unidades registradas</p></div></div><div class="stock-list">${topProducts.map(product => `<div class="stock-row"><div class="stock-product"><strong>${esc(product.name)}</strong><small>${money(product.price)}</small></div><span class="badge">${product.sold} un.</span></div>`).join("") || empty("Sin productos", "Agrega referencias para empezar.")}</div></section>
    </div>`;
}

async function renderProducts(root, term = "") {
  const { data, error } = await supabase.from("products").select("*").order("name").limit(1000);
  if (error) throw error;
  const products = (data || []).filter(item => `${item.name} ${item.code || ""} ${item.category || ""}`.toLocaleLowerCase("es-CO").includes(term.toLocaleLowerCase("es-CO")));
  root.innerHTML = `${intro("Productos", "Administra precios, existencias y niveles mínimos.", actionButton("Nuevo producto", "product-new"))}
    <div class="toolbar"><label class="search-wrap"><span class="visually-hidden">Buscar productos</span><input class="search-input" id="search-products" type="search" placeholder="Buscar por nombre, código o categoría" value="${esc(term)}"></label><span class="muted small">${products.length} referencias</span></div>
    <div class="table-panel"><div class="table-scroll"><table class="data-table">${tableHead(["Producto", "Categoría", "Precio", "Existencias", "Estado", ""])}<tbody>${products.map(product => `<tr><td><span class="table-primary">${esc(product.name)}</span><span class="table-secondary">${esc(product.code || "Sin código")}</span></td><td>${esc(product.category || "—")}</td><td>${money(product.price)}</td><td>${Number(product.stock).toLocaleString("es-CO")}</td><td>${badgeStock(product)}</td><td><div class="table-actions"><button class="table-action" data-action="product-edit" data-id="${product.id}">Editar</button><button class="table-action danger" data-action="product-delete" data-id="${product.id}">Eliminar</button></div></td></tr>`).join("") || `<tr><td colspan="6">${empty("No hay productos todavía", "Agrega tu primera referencia para comenzar.")}</td></tr>`}</tbody></table></div></div>`;
  $("#search-products").addEventListener("input", event => {
    const value = event.target.value;
    window.clearTimeout(state.productsSearchTimer);
    state.productsSearchTimer = window.setTimeout(async () => {
      await renderProducts(root, value);
      const next = $("#search-products");
      next?.focus();
      next?.setSelectionRange(value.length, value.length);
    }, 220);
  });
}

function openProductForm(product = null) {
  const editing = Boolean(product);
  openModal(editing ? "Editar producto" : "Nuevo producto", "Mantén al día la información y las existencias.", `<form class="modal-form" data-form="product" data-id="${product?.id || ""}">
    <label>Nombre del producto<input class="field-input" name="name" maxlength="120" required value="${esc(product?.name || "")}" placeholder="Ej. Café de origen"></label>
    <div class="form-grid"><label>Código<input class="field-input" name="code" maxlength="40" value="${esc(product?.code || "")}" placeholder="SKU-001"></label><label>Categoría<input class="field-input" name="category" maxlength="60" value="${esc(product?.category || "")}" placeholder="Bebidas"></label></div>
    <div class="form-grid"><label>Precio (COP)<input class="field-input" name="price" type="number" min="0" step="1" required value="${Number(product?.price || 0)}"></label><label>Existencias<input class="field-input" name="stock" type="number" min="0" step="1" required value="${Number(product?.stock || 0)}"></label></div>
    <label>Alertar cuando queden<input class="field-input" name="min_stock" type="number" min="0" step="1" required value="${Number(product?.min_stock || 5)}"></label>
    <label>Descripción<textarea class="field-textarea" name="description" maxlength="500">${esc(product?.description || "")}</textarea></label>
    <div class="modal-actions"><button class="button button-secondary" type="button" data-close-modal>Cancelar</button><button class="button button-primary" type="submit">${editing ? "Guardar cambios" : "Crear producto"}</button></div>
  </form>`);
}

async function renderClients(root, term = "") {
  const { data, error } = await supabase.from("clients").select("*").order("name").limit(1000);
  if (error) throw error;
  const clients = (data || []).filter(item => `${item.name} ${item.email || ""} ${item.phone || ""}`.toLocaleLowerCase("es-CO").includes(term.toLocaleLowerCase("es-CO")));
  root.innerHTML = `${intro("Clientes", "Conserva sus datos y consulta su historial de compras.", actionButton("Nuevo cliente", "client-new"))}
    <div class="toolbar"><label class="search-wrap"><span class="visually-hidden">Buscar clientes</span><input class="search-input" id="search-clients" type="search" placeholder="Buscar por nombre, correo o teléfono" value="${esc(term)}"></label><span class="muted small">${clients.length} clientes</span></div>
    <div class="table-panel"><div class="table-scroll"><table class="data-table">${tableHead(["Cliente", "Teléfono", "Correo", "Dirección", ""])}<tbody>${clients.map(client => `<tr><td><span class="table-primary">${esc(client.name)}</span></td><td>${esc(client.phone || "—")}</td><td>${esc(client.email || "—")}</td><td>${esc(client.address || "—")}</td><td><div class="table-actions"><button class="table-action" data-action="client-history" data-id="${client.id}">Historial</button><button class="table-action" data-action="client-edit" data-id="${client.id}">Editar</button><button class="table-action danger" data-action="client-delete" data-id="${client.id}">Eliminar</button></div></td></tr>`).join("") || `<tr><td colspan="5">${empty("Aún no hay clientes", "Registra tus clientes para consultar sus compras.")}</td></tr>`}</tbody></table></div></div>`;
  $("#search-clients").addEventListener("input", event => {
    const value = event.target.value;
    window.clearTimeout(state.clientsSearchTimer);
    state.clientsSearchTimer = window.setTimeout(async () => {
      await renderClients(root, value);
      const next = $("#search-clients");
      next?.focus();
      next?.setSelectionRange(value.length, value.length);
    }, 220);
  });
}

function openClientForm(client = null) {
  const editing = Boolean(client);
  openModal(editing ? "Editar cliente" : "Nuevo cliente", "Los datos de contacto son opcionales.", `<form class="modal-form" data-form="client" data-id="${client?.id || ""}">
    <label>Nombre completo<input class="field-input" name="name" maxlength="120" required value="${esc(client?.name || "")}"></label>
    <div class="form-grid"><label>Teléfono<input class="field-input" name="phone" maxlength="40" value="${esc(client?.phone || "")}"></label><label>Correo<input class="field-input" name="email" type="email" maxlength="254" value="${esc(client?.email || "")}"></label></div>
    <label>Dirección<input class="field-input" name="address" maxlength="200" value="${esc(client?.address || "")}"></label>
    <div class="modal-actions"><button class="button button-secondary" type="button" data-close-modal>Cancelar</button><button class="button button-primary" type="submit">${editing ? "Guardar cambios" : "Crear cliente"}</button></div>
  </form>`);
}

async function renderSales(root) {
  const [{ data: sales, error }, { data: clients, error: clientsError }] = await Promise.all([
    supabase.from("sales").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("clients").select("id,name").limit(1000)
  ]);
  if (error) throw error; if (clientsError) throw clientsError;
  const clientMap = new Map((clients || []).map(client => [client.id, client.name]));
  root.innerHTML = `${intro("Ventas", "Cada venta válida descuenta existencias automáticamente.", actionButton("Registrar venta", "sale-new"))}
    <div class="report-grid"><article class="report-summary"><span>Ventas de hoy</span><strong>${money((sales || []).filter(s => new Date(s.created_at) >= todayStart()).reduce((sum, s) => sum + Number(s.total), 0))}</strong></article><article class="report-summary"><span>Transacciones del mes</span><strong>${(sales || []).filter(s => new Date(s.created_at) >= monthStart()).length}</strong></article><article class="report-summary"><span>Total histórico visible</span><strong>${money((sales || []).reduce((sum, s) => sum + Number(s.total), 0))}</strong></article></div>
    <div class="table-panel"><div class="table-scroll"><table class="data-table">${tableHead(["Fecha", "Cliente", "Venta", "Valor", "Registrada por"])}<tbody>${(sales || []).map(sale => `<tr><td>${dateTime(sale.created_at)}</td><td>${esc(clientMap.get(sale.client_id) || "Venta sin cliente")}</td><td><span class="table-secondary">${sale.id.slice(0, 8).toUpperCase()}</span></td><td><span class="table-primary">${money(sale.total)}</span></td><td>${sale.user_id === state.session.user.id ? "Tú" : "Equipo"}</td></tr>`).join("") || `<tr><td colspan="5">${empty("Aún no hay ventas", "Registra una venta para empezar a medir tu negocio.")}</td></tr>`}</tbody></table></div></div>`;
}

async function openSaleForm() {
  const [{ data: products, error }, { data: clients, error: clientError }] = await Promise.all([
    supabase.from("products").select("id,name,code,price,stock").order("name").limit(1000),
    supabase.from("clients").select("id,name").order("name").limit(1000)
  ]);
  if (error) return toast(error.message, "error"); if (clientError) return toast(clientError.message, "error");
  const available = (products || []).filter(product => Number(product.stock) > 0);
  if (!available.length) return toast("Agrega productos con existencias antes de registrar una venta.", "error");
  state.saleDraft = [{ product_id: available[0].id, quantity: 1 }];
  state.saleProducts = available;
  state.saleClients = clients || [];
  showSaleForm();
}

function showSaleForm() {
  const products = state.saleProducts || [], clients = state.saleClients || [];
  const options = (selected = "") => products.map(product => `<option value="${product.id}" ${selected === product.id ? "selected" : ""}>${esc(product.name)} · ${money(product.price)} · ${product.stock} disp.</option>`).join("");
  const rows = state.saleDraft.map((line, index) => `<div class="cart-row" data-cart-row="${index}"><select aria-label="Producto" data-cart-product="${index}">${options(line.product_id)}</select><input aria-label="Cantidad" data-cart-quantity="${index}" type="number" min="1" max="${products.find(p => p.id === line.product_id)?.stock || 1}" value="${line.quantity}"><button class="cart-remove" data-action="cart-remove" data-index="${index}" type="button" aria-label="Quitar producto">×</button></div>`).join("");
  const total = state.saleDraft.reduce((sum, line) => sum + Number(products.find(product => product.id === line.product_id)?.price || 0) * Number(line.quantity || 0), 0);
  openModal("Registrar venta", "Selecciona los productos y cantidades. El inventario se actualizará al confirmar.", `<form class="modal-form" data-form="sale">
    <label>Cliente <select class="field-select" name="client_id"><option value="">Venta sin cliente</option>${clients.map(client => `<option value="${client.id}">${esc(client.name)}</option>`).join("")}</select></label>
    <div><div class="panel-heading cart-panel-heading"><h3>Productos</h3><button class="text-button" type="button" data-action="cart-add">＋ Añadir producto</button></div><div id="cart-items">${rows}</div></div>
    <div class="cart-total"><span>Total de la venta</span><strong id="cart-total">${money(total)}</strong></div>
    <div class="modal-actions"><button class="button button-secondary" type="button" data-close-modal>Cancelar</button><button class="button button-primary" type="submit">Confirmar venta</button></div>
  </form>`);
}

async function renderReports(root) {
  const [{ data: sales, error }, { data: products, error: productError }, { data: items, error: itemError }] = await Promise.all([
    supabase.from("sales").select("id,total,created_at,client_id").order("created_at", { ascending: false }).limit(1000),
    supabase.from("products").select("id,name,stock,min_stock,price").limit(1000),
    supabase.from("sale_items").select("product_id,quantity").limit(3000)
  ]);
  if (error) throw error; if (productError) throw productError; if (itemError) throw itemError;
  const monthSales = (sales || []).filter(sale => new Date(sale.created_at) >= monthStart());
  const quantity = new Map(); for (const item of items || []) quantity.set(item.product_id, (quantity.get(item.product_id) || 0) + Number(item.quantity));
  const productMap = new Map((products || []).map(product => [product.id, product]));
  const best = [...quantity].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const low = (products || []).filter(product => Number(product.stock) <= Number(product.min_stock)).sort((a, b) => a.stock - b.stock);
  root.innerHTML = `${intro("Informes", "Una lectura sencilla de la actividad de tu negocio.", '<button class="button button-secondary" data-action="export-report">Descargar CSV</button>')}
    <div class="report-grid"><article class="report-summary"><span>Ingresos del mes</span><strong>${money(monthSales.reduce((sum, s) => sum + Number(s.total), 0))}</strong></article><article class="report-summary"><span>Ventas del mes</span><strong>${monthSales.length}</strong></article><article class="report-summary"><span>Unidades vendidas</span><strong>${(items || []).reduce((sum, item) => sum + Number(item.quantity), 0).toLocaleString("es-CO")}</strong></article></div>
    <div class="dashboard-grid"><section class="panel"><div class="panel-heading"><div><h3>Productos más vendidos</h3><p>Historial registrado</p></div></div><div class="table-scroll"><table class="data-table">${tableHead(["Producto", "Unidades", "Precio actual"])}<tbody>${best.map(([id, sold]) => { const product = productMap.get(id); return product ? `<tr><td>${esc(product.name)}</td><td>${sold}</td><td>${money(product.price)}</td></tr>` : ""; }).join("") || `<tr><td colspan="3">${empty("Sin datos de ventas", "Cuando registres ventas aparecerán aquí.")}</td></tr>`}</tbody></table></div></section>
    <section class="panel"><div class="panel-heading"><div><h3>Inventario por reponer</h3><p>${low.length} referencias en mínimo o por debajo</p></div></div><div class="stock-list">${low.map(product => `<div class="stock-row"><div class="stock-product"><strong>${esc(product.name)}</strong><small>Mínimo ${product.min_stock} · ${money(product.price)}</small></div><span class="stock-count">${product.stock} un.</span></div>`).join("") || empty("Sin alertas", "Todos los productos superan su nivel mínimo.")}</div></section></div>`;
}

async function renderUsers(root) {
  if (state.role !== "admin") throw new Error("Solo un administrador puede gestionar usuarios.");
  const { data, error } = await supabase.from("profiles").select("id,email,full_name,role,is_active,created_at").order("created_at", { ascending: true }).limit(500);
  if (error) throw error;
  root.innerHTML = `${intro("Usuarios", "Aprueba el acceso y administra los roles de este negocio.")}
    <p class="inline-note inline-note-spaced">Las cuentas nuevas quedan pendientes y no pueden consultar información hasta que un administrador las apruebe.</p>
    <div class="table-panel"><div class="table-scroll"><table class="data-table">${tableHead(["Persona", "Correo", "Estado", "Rol", "Acceso desde", ""])}<tbody>${(data || []).map(profile => `<tr><td><span class="table-primary">${esc(profile.full_name || "Sin nombre")}</span></td><td>${esc(profile.email || "—")}</td><td><span class="badge ${profile.is_active ? "good" : "low"}">${profile.is_active ? "Activo" : "Pendiente"}</span></td><td><span class="badge ${profile.role === "admin" ? "role-admin" : ""}">${profile.role === "admin" ? "Administrador" : "Vendedor"}</span></td><td>${dateShort(profile.created_at)}</td><td>${profile.id === state.session.user.id ? '<span class="table-secondary">Tu cuenta</span>' : `<div class="table-actions"><button class="table-action" data-action="user-status" data-id="${profile.id}" data-active="${profile.is_active}">${profile.is_active ? "Suspender" : "Aprobar"}</button>${profile.is_active ? `<button class="table-action" data-action="user-role" data-id="${profile.id}" data-role="${profile.role}">Cambiar rol</button>` : ""}</div>`}</td></tr>`).join("") || `<tr><td colspan="6">${empty("Sin usuarios", "Los perfiles aparecen después de registrarse.")}</td></tr>`}</tbody></table></div></div>`;
}

function openModal(title, subtitle, content) {
  $("#modal-root").innerHTML = `<div class="modal-backdrop" data-backdrop><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><header class="modal-header"><div><h2 id="modal-title">${title}</h2><p>${subtitle}</p></div><button class="modal-close" type="button" data-close-modal aria-label="Cerrar">×</button></header>${content}</section></div>`;
  $(".modal-backdrop .modal")?.focus?.();
}
function closeModal() { $("#modal-root").innerHTML = ""; }

function askConfirm(title, message, onConfirm, label = "Eliminar") {
  openModal(title, message, `<div class="modal-actions"><button class="button button-secondary" type="button" data-close-modal>Cancelar</button><button class="button button-danger" type="button" id="confirm-action">${label}</button></div>`);
  $("#confirm-action").addEventListener("click", async event => { setBusy(event.currentTarget, true); try { await onConfirm(); closeModal(); } catch (error) { toast(error.message || "No se pudo completar la acción.", "error"); setBusy(event.currentTarget, false); } });
}

async function handleViewAction(action, id) {
  if (action === "product-new") return openProductForm();
  if (action === "client-new") return openClientForm();
  if (action === "sale-new") return openSaleForm();
  if (action === "product-edit") { const { data, error } = await supabase.from("products").select("*").eq("id", id).single(); if (error) throw error; return openProductForm(data); }
  if (action === "client-edit") { const { data, error } = await supabase.from("clients").select("*").eq("id", id).single(); if (error) throw error; return openClientForm(data); }
  if (action === "product-delete") return askConfirm("¿Eliminar este producto?", "No se puede borrar un producto que ya aparece en ventas registradas.", async () => { const { error } = await supabase.from("products").delete().eq("id", id); if (error) throw error; toast("Producto eliminado."); await renderView(); });
  if (action === "client-delete") return askConfirm("¿Eliminar este cliente?", "Las ventas anteriores se conservarán sin el vínculo al cliente.", async () => { const { error } = await supabase.from("clients").delete().eq("id", id); if (error) throw error; toast("Cliente eliminado."); await renderView(); });
  if (action === "client-history") return showClientHistory(id);
  if (action === "user-role") return changeRole(id);
  if (action === "user-status") return changeUserStatus(id);
  if (action === "refresh") return renderView();
  if (action === "export-report") return exportReport();
}

async function showClientHistory(clientId) {
  const [{ data: client, error }, { data: sales, error: salesError }] = await Promise.all([
    supabase.from("clients").select("id,name").eq("id", clientId).single(),
    supabase.from("sales").select("id,total,created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(300)
  ]);
  if (error) throw error; if (salesError) throw salesError;
  openModal(`Historial de ${esc(client.name)}`, `${sales.length} compras registradas`, `<div class="stock-list">${sales.map(sale => `<div class="stock-row"><div class="stock-product"><strong>${dateTime(sale.created_at)}</strong><small>Venta ${sale.id.slice(0, 8).toUpperCase()}</small></div><strong>${money(sale.total)}</strong></div>`).join("") || empty("Sin compras todavía", "Las ventas asociadas a este cliente aparecerán aquí.")}</div>`);
}

async function changeRole(userId) {
  const { data, error } = await supabase.from("profiles").select("id,full_name,email,role").eq("id", userId).single();
  if (error) throw error;
  const next = data.role === "admin" ? "vendedor" : "admin";
  askConfirm(`Cambiar a ${next === "admin" ? "Administrador" : "Vendedor"}`, `${data.full_name || data.email} tendrá el rol ${next === "admin" ? "Administrador" : "Vendedor"}.`, async () => {
    const { error: updateError } = await supabase.from("profiles").update({ role: next }).eq("id", userId);
    if (updateError) throw updateError;
    toast("Rol actualizado."); await renderView();
  }, "Confirmar cambio");
}

async function changeUserStatus(userId) {
  const { data, error } = await supabase.from("profiles").select("id,full_name,email,is_active").eq("id", userId).single();
  if (error) throw error;
  const active = !data.is_active;
  askConfirm(active ? "Aprobar acceso" : "Suspender acceso", `${data.full_name || data.email} ${active ? "podrá entrar y consultar los datos del negocio" : "perderá acceso a los datos del negocio"}.`, async () => {
    const { error: updateError } = await supabase.from("profiles").update({ is_active: active }).eq("id", userId);
    if (updateError) throw updateError;
    toast(active ? "Cuenta aprobada." : "Acceso suspendido."); await renderView();
  }, active ? "Aprobar cuenta" : "Suspender cuenta");
}

function csvCell(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
async function exportReport() {
  const { data, error } = await supabase.from("sales").select("id,created_at,client_id,total").order("created_at", { ascending: false }).limit(5000);
  if (error) throw error;
  const clients = await supabase.from("clients").select("id,name").limit(2000);
  if (clients.error) throw clients.error;
  const map = new Map((clients.data || []).map(client => [client.id, client.name]));
  const lines = [["Fecha", "Cliente", "Código de venta", "Total COP"], ...(data || []).map(sale => [dateTime(sale.created_at), map.get(sale.client_id) || "Venta sin cliente", sale.id, sale.total])];
  const blob = new Blob(["\ufeff" + lines.map(line => line.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = "gestpyme-ventas.csv"; link.click(); URL.revokeObjectURL(url);
  toast("Informe descargado.");
}

$("#view-root").addEventListener("click", async event => {
  const link = event.target.closest("[data-view-link]");
  if (link) return navigate(link.dataset.viewLink);
  const button = event.target.closest("[data-action]");
  if (!button) return;
  try { await handleViewAction(button.dataset.action, button.dataset.id); }
  catch (error) { toast(error.message || "No se pudo completar la acción.", "error"); }
});

$("#modal-root").addEventListener("click", event => {
  if (event.target.closest("[data-close-modal]") || (event.target.matches("[data-backdrop]"))) return closeModal();
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "cart-add") {
    const product = state.saleProducts?.find(item => item.id === state.saleDraft.at(-1)?.product_id) || state.saleProducts?.[0];
    if (product) { state.saleDraft.push({ product_id: product.id, quantity: 1 }); showSaleForm(); }
  }
  if (button.dataset.action === "cart-remove") { state.saleDraft.splice(Number(button.dataset.index), 1); if (!state.saleDraft.length) state.saleDraft.push({ product_id: state.saleProducts[0].id, quantity: 1 }); showSaleForm(); }
});

$("#modal-root").addEventListener("change", event => {
  const productSelect = event.target.closest("[data-cart-product]");
  const quantityInput = event.target.closest("[data-cart-quantity]");
  if (productSelect) {
    const index = Number(productSelect.dataset.cartProduct);
    state.saleDraft[index].product_id = productSelect.value;
    const stock = state.saleProducts.find(product => product.id === productSelect.value)?.stock || 1;
    state.saleDraft[index].quantity = Math.min(Number(state.saleDraft[index].quantity) || 1, stock);
    showSaleForm();
  }
  if (quantityInput) {
    const index = Number(quantityInput.dataset.cartQuantity);
    state.saleDraft[index].quantity = Math.max(1, Number(quantityInput.value) || 1);
    const total = state.saleDraft.reduce((sum, line) => sum + Number(state.saleProducts.find(product => product.id === line.product_id)?.price || 0) * Number(line.quantity || 0), 0);
    $("#cart-total").textContent = money(total);
  }
});

$("#modal-root").addEventListener("submit", async event => {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  const submit = form.querySelector('button[type="submit"]'); setBusy(submit, true);
  const values = new FormData(form);
  try {
    if (form.dataset.form === "product") {
      const item = { name: String(values.get("name")).trim(), code: String(values.get("code")).trim() || null, category: String(values.get("category")).trim() || null, price: Number(values.get("price")), stock: Number(values.get("stock")), min_stock: Number(values.get("min_stock")), description: String(values.get("description")).trim() || null };
      const query = form.dataset.id ? supabase.from("products").update(item).eq("id", form.dataset.id) : supabase.from("products").insert({ ...item, created_by: state.session.user.id });
      const { error } = await query; if (error) throw error; closeModal(); toast(form.dataset.id ? "Producto actualizado." : "Producto creado."); await renderView();
    }
    if (form.dataset.form === "client") {
      const item = { name: String(values.get("name")).trim(), phone: String(values.get("phone")).trim() || null, email: String(values.get("email")).trim() || null, address: String(values.get("address")).trim() || null };
      const query = form.dataset.id ? supabase.from("clients").update(item).eq("id", form.dataset.id) : supabase.from("clients").insert({ ...item, created_by: state.session.user.id });
      const { error } = await query; if (error) throw error; closeModal(); toast(form.dataset.id ? "Cliente actualizado." : "Cliente creado."); await renderView();
    }
    if (form.dataset.form === "sale") {
      const items = $$(".cart-row", form).map(row => ({ product_id: row.querySelector("[data-cart-product]").value, quantity: Number(row.querySelector("[data-cart-quantity]").value) })).filter(item => item.quantity > 0);
      if (!items.length) throw new Error("Añade al menos un producto.");
      const { error } = await supabase.rpc("register_sale", { p_client_id: values.get("client_id") || null, p_items: items });
      if (error) throw error; closeModal(); toast("Venta registrada e inventario actualizado."); await renderView();
    }
    if (form.dataset.form === "password-reset") {
      const password = String(values.get("password") || "");
      if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
      if (password !== String(values.get("password_confirm") || "")) throw new Error("Las contraseñas no coinciden.");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      closeModal(); toast("Contraseña actualizada."); await enterWorkspace(state.session);
    }
  } catch (error) { toast(error.message || "No se pudo guardar.", "error"); setBusy(submit, false); }
});

$$(".nav-link[data-view]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.view)));
$("#mobile-menu").addEventListener("click", () => { const open = $("#sidebar").classList.toggle("open"); $("#mobile-menu").setAttribute("aria-expanded", String(open)); });
$("#signout-button").addEventListener("click", async () => { const { error } = await supabase.auth.signOut(); if (error) toast(error.message, "error"); });
$("#pending-signout").addEventListener("click", async () => { const { error } = await supabase.auth.signOut(); if (error) toast(error.message, "error"); });
document.addEventListener("keydown", event => { if (event.key === "Escape") closeModal(); });

async function start() {
  $("#today-label").textContent = new Intl.DateTimeFormat("es-CO", { dateStyle: "full" }).format(new Date()).toLocaleUpperCase("es-CO");
  if (!supabaseConfigured) { $("#connection-screen").hidden = false; return; }
  bindAuth();
  const { data, error } = await supabase.auth.getSession();
  if (error) toast(error.message, "error");
  await enterWorkspace(data?.session || null);
  supabase.auth.onAuthStateChange((event, session) => {
    window.setTimeout(async () => {
      await enterWorkspace(session);
      if (event === "PASSWORD_RECOVERY") {
        openModal("Crea una contraseña nueva", "Elige una contraseña de al menos 8 caracteres.", `<form class="modal-form" data-form="password-reset"><label>Nueva contraseña<input class="field-input" type="password" name="password" minlength="8" autocomplete="new-password" required></label><label>Repite la contraseña<input class="field-input" type="password" name="password_confirm" minlength="8" autocomplete="new-password" required></label><div class="modal-actions"><button class="button button-primary" type="submit">Actualizar contraseña</button></div></form>`);
      }
    }, 0);
  });
}

start().catch(error => { console.error(error); toast("No se pudo iniciar GestPyme. Revisa la conexión a Supabase.", "error"); showAuth(); });
