
import "./styles.css";

const qs = (selector, scope = document) => scope.querySelector(selector);
const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

const state = {
  apiBase: localStorage.getItem("arl_api_base") || "/api",
  token: localStorage.getItem("arl_token") || "",
  lastSearch: "",
};

const navConfig = [
  {
    group: "发现",
    items: [
      { id: "dashboard", label: "仪表盘", subtitle: "系统健康与关键指标" },
      { id: "tasks", label: "任务中心", subtitle: "创建并管理任务" },
      { id: "results", label: "结果中心", subtitle: "探索发现结果" },
    ],
  },
  {
    group: "资产",
    items: [
      { id: "scopes", label: "资产范围", subtitle: "定义覆盖范围" },
      { id: "assets", label: "资产浏览", subtitle: "查看资产" },
      { id: "scheduler", label: "监控调度", subtitle: "周期性执行" },
    ],
  },
  {
    group: "自动化",
    items: [
      { id: "github", label: "GitHub 监控", subtitle: "泄露监控" },
      { id: "policies", label: "策略", subtitle: "可复用配置" },
      { id: "api_console", label: "API 控制台", subtitle: "直接访问 API" },
    ],
  },
  {
    group: "系统",
    items: [{ id: "settings", label: "设置", subtitle: "鉴权与运行设置" }],
  },
];

const pageMeta = {
  dashboard: {
    title: "仪表盘",
    subtitle: "系统概览与快速入口。",
    render: renderDashboard,
  },
  tasks: {
    title: "任务中心",
    subtitle: "发起资产发现并管理执行中的任务。",
    render: renderTasks,
  },
  results: {
    title: "结果中心",
    subtitle: "查看域名、IP、站点与发现结果。",
    render: renderResults,
  },
  scopes: {
    title: "资产范围",
    subtitle: "定义与维护资产范围。",
    render: renderScopes,
  },
  assets: {
    title: "资产浏览",
    subtitle: "浏览任务同步的资产库。",
    render: renderAssets,
  },
  scheduler: {
    title: "监控调度",
    subtitle: "自动化周期性资产检查。",
    render: renderScheduler,
  },
  github: {
    title: "GitHub 监控",
    subtitle: "跟踪泄露关键词与结果。",
    render: renderGithub,
  },
  policies: {
    title: "策略",
    subtitle: "创建并应用可复用的任务预设。",
    render: renderPolicies,
  },
  api_console: {
    title: "API 控制台",
    subtitle: "向 ARL 接口发送直连请求。",
    render: renderApiConsole,
  },
  settings: {
    title: "设置",
    subtitle: "鉴权、API 基址与运行参数。",
    render: renderSettings,
  },
};

function initNav() {
  const navEl = qs("#nav");
  navEl.innerHTML = "";
  navConfig.forEach((group) => {
    const groupEl = document.createElement("div");
    groupEl.className = "nav-group";
    groupEl.textContent = group.group;
    navEl.appendChild(groupEl);

    group.items.forEach((item) => {
      const link = document.createElement("a");
      link.href = `#/` + item.id;
      link.dataset.page = item.id;
      link.innerHTML = `<span>${item.label}</span><small>${item.subtitle}</small>`;
      navEl.appendChild(link);
    });
  });
}

function setActiveNav(pageId) {
  qsa(".nav a").forEach((link) => {
    link.classList.toggle("active", link.dataset.page === pageId);
  });
}

function setPageMeta(pageId) {
  const meta = pageMeta[pageId];
  qs("#page-title").textContent = meta ? meta.title : "ARL";
  qs("#page-subtitle").textContent = meta ? meta.subtitle : "";
}

function toast(message, tone = "info") {
  const toastEl = qs("#toast");
  const item = document.createElement("div");
  item.className = "toast-item";
  item.textContent = message;
  if (tone === "error") {
    item.style.background = "#7f1d1d";
  }
  if (tone === "success") {
    item.style.background = "#065f46";
  }
  toastEl.appendChild(item);
  setTimeout(() => item.remove(), 4200);
}

function joinUrl(base, path) {
  const cleanBase = base.replace(/\/+$/, "");
  const cleanPath = path.replace(/^\/+/, "");
  return `${cleanBase}/${cleanPath}`;
}

function buildQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    query.set(key, value);
  });
  return query.toString();
}

async function request(path, options = {}) {
  const url = joinUrl(state.apiBase, path);
  const { silent, ...fetchOptions } = options;
  const headers = fetchOptions.headers || {};
  if (state.token) {
    headers.Token = state.token;
  }
  if (!headers["Content-Type"] && fetchOptions.body && typeof fetchOptions.body === "string") {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(url, { ...fetchOptions, headers });
  const text = await response.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch (err) {
    data = text;
  }

  if (!response.ok) {
    const message = typeof data === "string" ? data : (data.message || "请求失败");
    if (!silent) {
      toast(message, "error");
    }
    throw new Error(message);
  }

  if (data && data.code && data.code !== 200) {
    const message = data.message || "请求失败";
    if (!silent) {
      toast(message, "error");
    }
  }

  return data;
}

async function apiGet(path, params = {}, options = {}) {
  const query = buildQuery(params);
  const fullPath = query ? `${path}?${query}` : path;
  return request(fullPath, { method: "GET", ...options });
}

async function apiPost(path, payload = {}, options = {}) {
  return request(path, {
    method: "POST",
    body: JSON.stringify(payload),
    ...options,
  });
}

function normalizeListResponse(resp) {
  if (!resp) {
    return { items: [], total: 0 };
  }
  if (Array.isArray(resp)) {
    return { items: resp, total: resp.length };
  }
  if (resp.items) {
    return { items: resp.items, total: resp.total || resp.items.length };
  }
  if (resp.data && resp.data.items) {
    return { items: resp.data.items, total: resp.data.total || resp.data.items.length };
  }
  if (resp.data && Array.isArray(resp.data)) {
    return { items: resp.data, total: resp.data.length };
  }
  return { items: [], total: 0 };
}

const taskMetaCache = new Map();

async function fetchTaskMeta(taskId) {
  if (!taskId) {
    return null;
  }
  if (taskMetaCache.has(taskId)) {
    return taskMetaCache.get(taskId);
  }
  const promise = apiGet("task/", { _id: taskId, page: 1, size: 1 }, { silent: true })
    .then((resp) => normalizeListResponse(resp).items[0] || null)
    .catch(() => null);
  taskMetaCache.set(taskId, promise);
  return promise;
}

async function fetchTaskMetaMap(taskIds) {
  const map = new Map();
  const unique = Array.from(new Set(taskIds.filter((taskId) => taskId && taskId !== "unknown")));
  await Promise.all(
    unique.map(async (taskId) => {
      const meta = await fetchTaskMeta(taskId);
      if (meta) {
        map.set(taskId, meta);
      }
    })
  );
  return map;
}

function groupItemsByTask(items) {
  const groups = new Map();
  items.forEach((item) => {
    const taskId = item.task_id || item.github_task_id || "unknown";
    if (!groups.has(taskId)) {
      groups.set(taskId, []);
    }
    groups.get(taskId).push(item);
  });
  return groups;
}

function card(title, subtitle) {
  const template = qs("#card-template");
  const clone = template.content.firstElementChild.cloneNode(true);
  clone.classList.add("fade-up");
  qs("h3", clone).textContent = title;
  qs("p", clone).textContent = subtitle || "";
  return clone;
}

function table(columns, items, actions = []) {
  const template = qs("#table-template");
  const clone = template.content.firstElementChild.cloneNode(true);
  const thead = qs("thead", clone);
  const tbody = qs("tbody", clone);

  const headerRow = document.createElement("tr");
  columns.forEach((col) => {
    const th = document.createElement("th");
    th.textContent = col.label;
    headerRow.appendChild(th);
  });
  if (actions.length) {
    const th = document.createElement("th");
    th.textContent = "操作";
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);

  items.forEach((item) => {
    const row = document.createElement("tr");
    columns.forEach((col) => {
      const td = document.createElement("td");
      const value = typeof col.value === "function" ? col.value(item) : item[col.key];
      td.innerHTML = formatCell(col.key, value);
      row.appendChild(td);
    });
    if (actions.length) {
      const td = document.createElement("td");
      const actionWrap = document.createElement("div");
      actionWrap.className = "actions";
      actions.forEach((action) => {
        const btn = document.createElement("button");
        btn.className = action.className || "ghost-button";
        btn.type = "button";
        btn.textContent = action.label;
        btn.addEventListener("click", () => action.onClick(item));
        actionWrap.appendChild(btn);
      });
      td.appendChild(actionWrap);
      row.appendChild(td);
    }
    tbody.appendChild(row);
  });

  return clone;
}

function formatCell(key, value) {
  if (value === undefined || value === null) {
    return "-";
  }
  if (key === "status" || key.endsWith("_status")) {
    return `<span class="tag">${escapeHtml(String(value))}</span>`;
  }
  if (typeof value === "object") {
    const json = JSON.stringify(value).slice(0, 120);
    return `<code>${escapeHtml(json)}</code>`;
  }
  const text = String(value);
  if (text.length > 120) {
    return `${escapeHtml(text.slice(0, 117))}...`;
  }
  return escapeHtml(text);
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function animateIn(container) {
  const nodes = qsa(".fade-up", container);
  nodes.forEach((node, index) => {
    setTimeout(() => node.classList.add("visible"), 120 * index);
  });
}

function renderFilters(container, defaults = []) {
  const filterWrap = document.createElement("div");
  filterWrap.className = "card-body";

  const list = document.createElement("div");
  list.className = "form-grid";

  function addRow(key = "", value = "") {
    const row = document.createElement("div");
    row.className = "form-group";
    row.innerHTML = `
      <label>过滤字段</label>
      <input type="text" placeholder="字段或查询参数" value="${escapeHtml(key)}">
      <label>值</label>
      <input type="text" placeholder="值" value="${escapeHtml(value)}">
      <button type="button" class="ghost-button">移除</button>
    `;
    const removeBtn = row.querySelector("button");
    removeBtn.addEventListener("click", () => row.remove());
    list.appendChild(row);
  }

  defaults.forEach((entry) => addRow(entry.key, entry.value));

  const controls = document.createElement("div");
  controls.className = "flex-row";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "secondary-button";
  addBtn.textContent = "添加过滤条件";
  addBtn.addEventListener("click", () => addRow());
  controls.appendChild(addBtn);

  filterWrap.appendChild(list);
  filterWrap.appendChild(controls);

  container.appendChild(filterWrap);

  return () => {
    const filters = {};
    const rows = Array.from(list.children);
    rows.forEach((row) => {
      const inputs = row.querySelectorAll("input");
      const key = inputs[0].value.trim();
      const value = inputs[1].value.trim();
      if (key && value) {
        filters[key] = value;
      }
    });
    return filters;
  };
}

function renderPagination(container, initial = { page: 1, size: 10, order: "-_id" }) {
  const form = document.createElement("div");
  form.className = "form-grid";
  form.innerHTML = `
    <div class="form-group">
      <label>页码</label>
      <input type="number" min="1" value="${initial.page}">
    </div>
    <div class="form-group">
      <label>数量</label>
      <input type="number" min="1" value="${initial.size}">
    </div>
    <div class="form-group">
      <label>排序</label>
      <input type="text" value="${initial.order}">
    </div>
  `;
  container.appendChild(form);
  return () => {
    const inputs = form.querySelectorAll("input");
    return {
      page: inputs[0].value,
      size: inputs[1].value,
      order: inputs[2].value,
    };
  };
}
async function renderDashboard(container) {
  container.innerHTML = "";
  const summaryCard = card("系统健康", "实时服务指标与主机状态。");
  const summaryBody = qs(".card-body", summaryCard);

  const statsGrid = document.createElement("div");
  statsGrid.className = "inline-grid";

  const statKeys = [
    { label: "任务", resource: "task" },
    { label: "域名", resource: "domain" },
    { label: "站点", resource: "site" },
    { label: "资产范围", resource: "asset_scope" },
  ];

  try {
    const countResults = await Promise.all(
      statKeys.map((item) => apiGet(`${item.resource}/`, { page: 1, size: 1 }))
    );
    countResults.forEach((result, index) => {
      const count = normalizeListResponse(result).total || 0;
      const stat = document.createElement("div");
      stat.className = "stat";
      stat.innerHTML = `<div class="label">${statKeys[index].label}</div><div class="value">${count}</div>`;
      statsGrid.appendChild(stat);
    });
  } catch (err) {
    const stat = document.createElement("div");
    stat.className = "stat";
    stat.innerHTML = `<div class="label">统计</div><div class="value">不可用</div>`;
    statsGrid.appendChild(stat);
  }

  summaryBody.appendChild(statsGrid);
  container.appendChild(summaryCard);

  const deviceCard = card("设备概览", "CPU、内存与磁盘信息。");
  const deviceBody = qs(".card-body", deviceCard);

  try {
    const info = await apiGet("console/info");
    const payload = info.data || info;
    const deviceInfo = payload.device_info || {};
    const deviceGrid = document.createElement("div");
    deviceGrid.className = "inline-grid";

    Object.entries(deviceInfo).forEach(([key, value]) => {
      const stat = document.createElement("div");
      stat.className = "stat";
      stat.innerHTML = `<div class="label">${escapeHtml(key)}</div><div class="value">${escapeHtml(String(value))}</div>`;
      deviceGrid.appendChild(stat);
    });

    deviceBody.appendChild(deviceGrid);
  } catch (err) {
    deviceBody.innerHTML = `<div class="notice">无法获取设备信息，请检查 API 基址和鉴权。</div>`;
  }

  container.appendChild(deviceCard);
  animateIn(container);
}

async function renderTasks(container) {
  container.innerHTML = "";

  const createCard = card("发起任务", "提交资产发现任务并配置参数。");
  const createBody = qs(".card-body", createCard);

  createBody.innerHTML = `
    <div class="form-grid">
      <div class="form-group">
        <label>任务名称</label>
        <input id="task-name" type="text" placeholder="任务名称">
      </div>
      <div class="form-group">
        <label>目标</label>
        <input id="task-target" type="text" placeholder="示例：example.com, 1.2.3.4/24">
      </div>
      <div class="form-group">
        <label>扫描深度</label>
        <select id="task-depth">
          <option value="deep">深度</option>
          <option value="standard">标准</option>
        </select>
      </div>
      <div class="form-group">
        <label>域名爆破</label>
        <select id="task-domain-brute">
          <option value="true">启用</option>
          <option value="false">禁用</option>
        </select>
      </div>
      <div class="form-group">
        <label>域名爆破类型</label>
        <select id="task-domain-brute-type">
          <option value="test">测试</option>
          <option value="big">大字典</option>
        </select>
      </div>
      <div class="form-group">
        <label>端口扫描</label>
        <select id="task-port-scan">
          <option value="true">启用</option>
          <option value="false">禁用</option>
        </select>
      </div>
      <div class="form-group">
        <label>端口扫描类型</label>
        <select id="task-port-scan-type">
          <option value="test">测试</option>
          <option value="top100">前100</option>
          <option value="top1000">前1000</option>
          <option value="all">全部</option>
          <option value="custom">自定义</option>
        </select>
      </div>
    </div>

    <div class="form-grid">
      <div class="form-group">
        <label>站点识别</label>
        <select id="task-site-identify">
          <option value="true">启用</option>
          <option value="false">禁用</option>
        </select>
      </div>
      <div class="form-group">
        <label>站点截图</label>
        <select id="task-site-capture">
          <option value="true">启用</option>
          <option value="false">禁用</option>
        </select>
      </div>
      <div class="form-group">
        <label>搜索引擎</label>
        <select id="task-search-engines">
          <option value="false">禁用</option>
          <option value="true">启用</option>
        </select>
      </div>
      <div class="form-group">
        <label>站点爬虫</label>
        <select id="task-site-spider">
          <option value="false">禁用</option>
          <option value="true">启用</option>
        </select>
      </div>
      <div class="form-group">
        <label>ARL 搜索</label>
        <select id="task-arl-search">
          <option value="true">启用</option>
          <option value="false">禁用</option>
        </select>
      </div>
      <div class="form-group">
        <label>备选 DNS</label>
        <select id="task-alt-dns">
          <option value="false">禁用</option>
          <option value="true">启用</option>
        </select>
      </div>
    </div>

    <div class="form-grid">
      <div class="form-group">
        <label>服务探测</label>
        <select id="task-service-detection">
          <option value="false">禁用</option>
          <option value="true">启用</option>
        </select>
      </div>
      <div class="form-group">
        <label>操作系统探测</label>
        <select id="task-os-detection">
          <option value="false">禁用</option>
          <option value="true">启用</option>
        </select>
      </div>
      <div class="form-group">
        <label>文件泄露</label>
        <select id="task-file-leak">
          <option value="false">禁用</option>
          <option value="true">启用</option>
        </select>
      </div>
      <div class="form-group">
        <label>SSL 证书</label>
        <select id="task-ssl-cert">
          <option value="false">禁用</option>
          <option value="true">启用</option>
        </select>
      </div>
      <div class="form-group">
        <label>DNS 查询插件</label>
        <select id="task-dns-query">
          <option value="false">禁用</option>
          <option value="true">启用</option>
        </select>
      </div>
      <div class="form-group">
        <label>跳过 CDN IP 扫描</label>
        <select id="task-skip-cdn">
          <option value="false">禁用</option>
          <option value="true">启用</option>
        </select>
      </div>
    </div>

    <div class="form-grid">
      <div class="form-group">
        <label>Nuclei 扫描</label>
        <select id="task-nuclei">
          <option value="false">禁用</option>
          <option value="true">启用</option>
        </select>
      </div>
      <div class="form-group">
        <label>发现 Vhost</label>
        <select id="task-findvhost">
          <option value="false">禁用</option>
          <option value="true">启用</option>
        </select>
      </div>
      <div class="form-group">
        <label>Web 信息探测</label>
        <select id="task-wih">
          <option value="false">禁用</option>
          <option value="true">启用</option>
        </select>
      </div>
    </div>

    <div class="flex-row">
      <button class="primary-button" id="task-submit">提交任务</button>
    </div>
  `;

  const depthSelect = qs("#task-depth");
  const presetKeys = [
    "task-domain-brute",
    "task-domain-brute-type",
    "task-port-scan",
    "task-port-scan-type",
    "task-site-identify",
    "task-site-capture",
    "task-search-engines",
    "task-site-spider",
    "task-arl-search",
    "task-alt-dns",
    "task-service-detection",
    "task-os-detection",
    "task-file-leak",
    "task-ssl-cert",
    "task-dns-query",
    "task-skip-cdn",
    "task-nuclei",
    "task-findvhost",
    "task-wih",
  ];
  const presetDefault = presetKeys.reduce((acc, id) => {
    const el = qs(`#${id}`);
    if (el) {
      acc[id] = el.value;
    }
    return acc;
  }, {});
  const presetDeep = {
    "task-domain-brute": "true",
    "task-domain-brute-type": "big",
    "task-port-scan": "true",
    "task-port-scan-type": "top1000",
    "task-site-identify": "true",
    "task-site-capture": "true",
    "task-search-engines": "true",
    "task-site-spider": "true",
    "task-arl-search": "true",
    "task-alt-dns": "true",
    "task-service-detection": "true",
    "task-os-detection": "true",
    "task-file-leak": "true",
    "task-ssl-cert": "true",
    "task-dns-query": "true",
    "task-skip-cdn": "false",
    "task-nuclei": "true",
    "task-findvhost": "true",
    "task-wih": "true",
  };
  const applyTaskPreset = (preset) => {
    const config = preset === "deep" ? presetDeep : presetDefault;
    Object.entries(config).forEach(([id, value]) => {
      const el = qs(`#${id}`);
      if (el && el.value !== value) {
        el.value = value;
      }
    });
  };
  if (depthSelect) {
    depthSelect.addEventListener("change", () => applyTaskPreset(depthSelect.value));
    applyTaskPreset(depthSelect.value);
  }

  createBody.querySelector("#task-submit").addEventListener("click", async () => {
    const payload = {
      name: qs("#task-name").value.trim(),
      target: qs("#task-target").value.trim(),
      domain_brute: qs("#task-domain-brute").value === "true",
      domain_brute_type: qs("#task-domain-brute-type").value,
      port_scan: qs("#task-port-scan").value === "true",
      port_scan_type: qs("#task-port-scan-type").value,
      site_identify: qs("#task-site-identify").value === "true",
      site_capture: qs("#task-site-capture").value === "true",
      search_engines: qs("#task-search-engines").value === "true",
      site_spider: qs("#task-site-spider").value === "true",
      arl_search: qs("#task-arl-search").value === "true",
      alt_dns: qs("#task-alt-dns").value === "true",
      service_detection: qs("#task-service-detection").value === "true",
      os_detection: qs("#task-os-detection").value === "true",
      file_leak: qs("#task-file-leak").value === "true",
      ssl_cert: qs("#task-ssl-cert").value === "true",
      dns_query_plugin: qs("#task-dns-query").value === "true",
      skip_scan_cdn_ip: qs("#task-skip-cdn").value === "true",
      nuclei_scan: qs("#task-nuclei").value === "true",
      findvhost: qs("#task-findvhost").value === "true",
      web_info_hunter: qs("#task-wih").value === "true",
    };

    if (!payload.name || !payload.target) {
      toast("任务名称和目标不能为空。", "error");
      return;
    }
    try {
      await apiPost("task/", payload);
      toast("任务已提交。", "success");
      renderTasks(container);
    } catch (err) {
      toast("提交任务失败。", "error");
    }
  });

  container.appendChild(createCard);

  const policyCard = card("策略任务", "通过策略运行任务并加载增强选项。");
  const policyBody = qs(".card-body", policyCard);
  policyBody.innerHTML = `
    <div class="form-grid">
      <div class="form-group">
        <label>任务名称</label>
        <input id="policy-task-name" type="text" placeholder="策略任务名称">
      </div>
      <div class="form-group">
        <label>目标</label>
        <input id="policy-task-target" type="text" placeholder="示例：example.com">
      </div>
      <div class="form-group">
        <label>任务标签</label>
        <select id="policy-task-tag">
          <option value="task">任务</option>
          <option value="risk_cruising">风险巡航</option>
        </select>
      </div>
      <div class="form-group">
        <label>策略 ID</label>
        <input id="policy-task-id" type="text" placeholder="策略 ID">
      </div>
      <div class="form-group">
        <label>结果集 ID（可选）</label>
        <input id="policy-result-set" type="text" placeholder="结果集 ID">
      </div>
    </div>
    <button class="secondary-button" id="policy-task-submit" type="button">运行策略任务</button>
  `;

  policyBody.querySelector("#policy-task-submit").addEventListener("click", async () => {
    const payload = {
      name: qs("#policy-task-name").value.trim(),
      target: qs("#policy-task-target").value.trim(),
      task_tag: qs("#policy-task-tag").value,
      policy_id: qs("#policy-task-id").value.trim(),
      result_set_id: qs("#policy-result-set").value.trim(),
    };
    if (!payload.name || !payload.policy_id) {
      toast("任务名称和策略 ID 不能为空。", "error");
      return;
    }
    try {
      await apiPost("task/policy/", payload);
      toast("策略任务已提交。", "success");
      renderTasks(container);
    } catch (err) {
      toast("提交策略任务失败。", "error");
    }
  });

  container.appendChild(policyCard);

  const syncCard = card("同步任务到范围", "将任务结果关联到资产范围。");
  const syncBody = qs(".card-body", syncCard);
  syncBody.innerHTML = `
    <div class="form-grid">
      <div class="form-group">
        <label>任务 ID</label>
        <input id="sync-task-id" type="text" placeholder="任务 ID">
      </div>
      <div class="form-group">
        <label>范围 ID</label>
        <input id="sync-scope-id" type="text" placeholder="范围 ID">
      </div>
    </div>
    <button class="secondary-button" id="sync-task-submit" type="button">同步任务</button>
  `;

  syncBody.querySelector("#sync-task-submit").addEventListener("click", async () => {
    const payload = {
      task_id: qs("#sync-task-id").value.trim(),
      scope_id: qs("#sync-scope-id").value.trim(),
    };
    if (!payload.task_id || !payload.scope_id) {
      toast("任务 ID 和范围 ID 不能为空。", "error");
      return;
    }
    try {
      await apiPost("task/sync/", payload);
      toast("同步请求已加入队列。", "success");
    } catch (err) {
      toast("同步请求失败。", "error");
    }
  });

  container.appendChild(syncCard);

  const listCard = card("任务列表", "查看当前任务、状态与快捷操作。");
  const listBody = qs(".card-body", listCard);
  const filterGetter = renderFilters(listBody);

  const paginationGetter = renderPagination(listBody, { page: 1, size: 10, order: "-_id" });

  const loadBtn = document.createElement("button");
  loadBtn.className = "primary-button";
  loadBtn.textContent = "加载任务";
  listBody.appendChild(loadBtn);

  const tableHost = document.createElement("div");
  listBody.appendChild(tableHost);

  async function loadTasks() {
    const filters = filterGetter();
    const pagination = paginationGetter();
    const params = { ...filters, ...pagination };
    const response = await apiGet("task/", params);
    const { items } = normalizeListResponse(response);

    tableHost.innerHTML = "";
    const columns = [
      { key: "name", label: "名称" },
      { key: "target", label: "目标" },
      { key: "status", label: "状态" },
      { key: "task_tag", label: "标签" },
      { key: "type", label: "类型" },
      { key: "start_time", label: "开始" },
      { key: "end_time", label: "结束" },
      { key: "_id", label: "ID" },
    ];

    const actions = [
      {
        label: "停止",
        className: "secondary-button",
        onClick: (item) => apiGet(`task/stop/${item._id}`).then(() => {
          toast("任务已停止。", "success");
          loadTasks();
        }),
      },
      {
        label: "重启",
        className: "ghost-button",
        onClick: (item) => apiPost("task/restart/", { task_id: [item._id] }).then(() => {
          toast("任务已重启。", "success");
          loadTasks();
        }),
      },
      {
        label: "删除",
        className: "danger-button",
        onClick: (item) => apiPost("task/delete/", { task_id: [item._id], del_task_data: true }).then(() => {
          toast("任务已删除。", "success");
          loadTasks();
        }),
      },
      {
        label: "导出",
        className: "ghost-button",
        onClick: (item) => window.open(joinUrl(state.apiBase, `export/${item._id}`), "_blank"),
      },
    ];

    tableHost.appendChild(table(columns, items, actions));
  }

  loadBtn.addEventListener("click", () => {
    loadTasks().catch(() => toast("加载任务失败。", "error"));
  });

  container.appendChild(listCard);
  animateIn(container);
}
async function renderResults(container) {
  container.innerHTML = "";
  const resultCard = card("结果浏览", "按条件浏览任意结果集合。");
  const resultBody = qs(".card-body", resultCard);

  const resourceSelect = document.createElement("select");
  const resources = [
    { value: "domain", label: "域名" },
    { value: "ip", label: "IP" },
    { value: "site", label: "站点" },
    { value: "url", label: "URL" },
    { value: "cert", label: "证书" },
    { value: "service", label: "服务" },
    { value: "fileleak", label: "文件泄露" },
    { value: "vuln", label: "漏洞" },
    { value: "wih", label: "Web 信息" },
    { value: "nuclei_result", label: "Nuclei 结果" },
    { value: "npoc_service", label: "NPoC 服务" },
    { value: "stat_finger", label: "指纹统计" },
    { value: "cip", label: "CIP" },
  ];
  resources.forEach((resource) => {
    const opt = document.createElement("option");
    opt.value = resource.value;
    opt.textContent = resource.label;
    resourceSelect.appendChild(opt);
  });

  const resourceGroup = document.createElement("div");
  resourceGroup.className = "form-group";
  resourceGroup.innerHTML = `<label>资源</label>`;
  resourceGroup.appendChild(resourceSelect);
  resultBody.appendChild(resourceGroup);

  const viewGroup = document.createElement("div");
  viewGroup.className = "form-group";
  viewGroup.innerHTML = `<label>展示模式</label>`;
  const viewSelect = document.createElement("select");
  viewSelect.innerHTML = `
    <option value="grouped">按任务分组</option>
    <option value="flat">平铺列表</option>
  `;
  viewGroup.appendChild(viewSelect);
  resultBody.appendChild(viewGroup);

  const filterGetter = renderFilters(resultBody);
  const paginationGetter = renderPagination(resultBody, { page: 1, size: 10, order: "-_id" });

  const loadBtn = document.createElement("button");
  loadBtn.className = "primary-button";
  loadBtn.textContent = "加载结果";
  resultBody.appendChild(loadBtn);

  const tableHost = document.createElement("div");
  resultBody.appendChild(tableHost);

  let cachedItems = [];
  let cachedColumns = [];

  async function renderResultItems(items, columns) {
    tableHost.innerHTML = "";
    if (!items.length) {
      tableHost.innerHTML = `<div class="notice">暂无结果。</div>`;
      return;
    }
    if (viewSelect.value === "flat") {
      tableHost.appendChild(table(columns, items));
      return;
    }

    const groups = groupItemsByTask(items);
    const taskMetaMap = await fetchTaskMetaMap(Array.from(groups.keys()));
    groups.forEach((groupItems, taskId) => {
      const meta = taskMetaMap.get(taskId);
      const titleText = meta ? (meta.name || "未命名任务") : (taskId === "unknown" ? "未知任务" : "任务");
      const subtitleText = meta
        ? `目标: ${meta.target || "-"} · ID: ${taskId}`
        : (taskId === "unknown" ? "未找到任务 ID" : `ID: ${taskId}`);

      const panel = document.createElement("details");
      panel.className = "group-panel";
      panel.open = true;

      const summary = document.createElement("summary");
      const heading = document.createElement("div");
      heading.className = "group-heading";
      const title = document.createElement("div");
      title.className = "group-title";
      title.textContent = titleText;
      const subtitle = document.createElement("div");
      subtitle.className = "group-subtitle";
      subtitle.textContent = subtitleText;
      heading.appendChild(title);
      heading.appendChild(subtitle);

      const metaEl = document.createElement("div");
      metaEl.className = "group-meta";
      metaEl.textContent = `${groupItems.length} 条`;
      summary.appendChild(heading);
      summary.appendChild(metaEl);

      const body = document.createElement("div");
      body.className = "group-body";
      body.appendChild(table(columns, groupItems));

      panel.appendChild(summary);
      panel.appendChild(body);
      tableHost.appendChild(panel);
    });
  }

  async function loadResults() {
    const filters = filterGetter();
    const pagination = paginationGetter();
    const params = { ...filters, ...pagination };
    const resource = resourceSelect.value;
    const response = await apiGet(`${resource}/`, params);
    const { items } = normalizeListResponse(response);
    cachedItems = items;
    cachedColumns = inferColumns(items);
    await renderResultItems(cachedItems, cachedColumns);
  }

  loadBtn.addEventListener("click", () => {
    loadResults().catch(() => toast("加载结果失败。", "error"));
  });

  viewSelect.addEventListener("change", () => {
    if (!cachedItems.length) {
      return;
    }
    renderResultItems(cachedItems, cachedColumns).catch(() => toast("结果渲染失败。", "error"));
  });

  container.appendChild(resultCard);
  animateIn(container);
}

async function renderScopes(container) {
  container.innerHTML = "";

  const addCard = card("创建范围", "定义域名或 IP 的范围边界。");
  const addBody = qs(".card-body", addCard);
  addBody.innerHTML = `
    <div class="form-grid">
      <div class="form-group">
        <label>名称</label>
        <input id="scope-name" type="text" placeholder="范围名称">
      </div>
      <div class="form-group">
        <label>范围</label>
        <input id="scope-value" type="text" placeholder="示例：example.com, 1.2.3.4/24">
      </div>
      <div class="form-group">
        <label>黑名单范围</label>
        <input id="scope-black" type="text" placeholder="排除列表">
      </div>
      <div class="form-group">
        <label>范围类型</label>
        <select id="scope-type">
          <option value="domain">域名</option>
          <option value="ip">IP</option>
        </select>
      </div>
    </div>
    <button class="primary-button" id="scope-submit" type="button">创建范围</button>
  `;

  addBody.querySelector("#scope-submit").addEventListener("click", async () => {
    const payload = {
      name: qs("#scope-name").value.trim(),
      scope: qs("#scope-value").value.trim(),
      black_scope: qs("#scope-black").value.trim(),
      scope_type: qs("#scope-type").value,
    };
    if (!payload.name || !payload.scope) {
      toast("名称和范围不能为空。", "error");
      return;
    }
    try {
      await apiPost("asset_scope/", payload);
      toast("范围已创建。", "success");
      renderScopes(container);
    } catch (err) {
      toast("创建范围失败。", "error");
    }
  });

  container.appendChild(addCard);

  const listCard = card("范围库", "当前范围定义。");
  const listBody = qs(".card-body", listCard);
  const filterGetter = renderFilters(listBody);
  const paginationGetter = renderPagination(listBody, { page: 1, size: 10, order: "-_id" });

  const loadBtn = document.createElement("button");
  loadBtn.className = "primary-button";
  loadBtn.textContent = "加载范围";
  listBody.appendChild(loadBtn);

  const tableHost = document.createElement("div");
  listBody.appendChild(tableHost);

  async function loadScopes() {
    const filters = filterGetter();
    const pagination = paginationGetter();
    const params = { ...filters, ...pagination };
    const response = await apiGet("asset_scope/", params);
    const { items } = normalizeListResponse(response);
    tableHost.innerHTML = "";
    const columns = [
      { key: "name", label: "名称" },
      { key: "scope_type", label: "类型" },
      { key: "scope", label: "范围" },
      { key: "black_scope", label: "黑名单范围" },
      { key: "_id", label: "ID" },
    ];

    const actions = [
      {
        label: "删除",
        className: "danger-button",
        onClick: (item) => apiPost("asset_scope/delete/", { scope_id: [item._id] }).then(() => {
          toast("范围已删除。", "success");
          loadScopes();
        }),
      },
    ];

    tableHost.appendChild(table(columns, items, actions));
  }

  loadBtn.addEventListener("click", () => {
    loadScopes().catch(() => toast("加载范围失败。", "error"));
  });

  container.appendChild(listCard);
  animateIn(container);
}

async function renderAssets(container) {
  container.innerHTML = "";
  const assetCard = card("资产浏览", "按范围与类别查看资产。");
  const assetBody = qs(".card-body", assetCard);

  const resourceSelect = document.createElement("select");
  const resources = [
    { value: "asset_domain", label: "域名资产" },
    { value: "asset_ip", label: "IP 资产" },
    { value: "asset_site", label: "站点资产" },
    { value: "asset_wih", label: "Web 信息资产" },
  ];
  resources.forEach((resource) => {
    const opt = document.createElement("option");
    opt.value = resource.value;
    opt.textContent = resource.label;
    resourceSelect.appendChild(opt);
  });

  const scopeInput = document.createElement("input");
  scopeInput.type = "text";
  scopeInput.placeholder = "范围 ID（可选）";

  const resourceGroup = document.createElement("div");
  resourceGroup.className = "form-grid";
  resourceGroup.innerHTML = `
    <div class="form-group">
      <label>资源</label>
    </div>
    <div class="form-group">
      <label>范围 ID</label>
    </div>
  `;
  resourceGroup.children[0].appendChild(resourceSelect);
  resourceGroup.children[1].appendChild(scopeInput);
  assetBody.appendChild(resourceGroup);

  const filterGetter = renderFilters(assetBody);
  const paginationGetter = renderPagination(assetBody, { page: 1, size: 10, order: "-_id" });

  const loadBtn = document.createElement("button");
  loadBtn.className = "primary-button";
  loadBtn.textContent = "加载资产";
  assetBody.appendChild(loadBtn);

  const tableHost = document.createElement("div");
  assetBody.appendChild(tableHost);

  async function loadAssets() {
    const filters = filterGetter();
    const pagination = paginationGetter();
    if (scopeInput.value.trim()) {
      filters.scope_id = scopeInput.value.trim();
    }
    const params = { ...filters, ...pagination };
    const resource = resourceSelect.value;
    const response = await apiGet(`${resource}/`, params);
    const { items } = normalizeListResponse(response);
    tableHost.innerHTML = "";
    const columns = inferColumns(items);
    tableHost.appendChild(table(columns, items));
  }

  loadBtn.addEventListener("click", () => {
    loadAssets().catch(() => toast("加载资产失败。", "error"));
  });

  container.appendChild(assetCard);
  animateIn(container);
}
async function renderScheduler(container) {
  container.innerHTML = "";

  const addCard = card("添加调度", "创建周期性监控任务。");
  const addBody = qs(".card-body", addCard);
  addBody.innerHTML = `
    <div class="form-grid">
      <div class="form-group">
        <label>范围 ID</label>
        <input id="scheduler-scope" type="text" placeholder="范围 ID">
      </div>
      <div class="form-group">
        <label>域名</label>
        <input id="scheduler-domain" type="text" placeholder="示例：example.com, foo.com">
      </div>
      <div class="form-group">
        <label>间隔（秒）</label>
        <input id="scheduler-interval" type="number" placeholder="21600">
      </div>
      <div class="form-group">
        <label>名称</label>
        <input id="scheduler-name" type="text" placeholder="监控名称">
      </div>
      <div class="form-group">
        <label>策略 ID（可选）</label>
        <input id="scheduler-policy" type="text" placeholder="策略 ID">
      </div>
    </div>
    <button class="primary-button" id="scheduler-submit" type="button">创建调度</button>
  `;

  addBody.querySelector("#scheduler-submit").addEventListener("click", async () => {
    const payload = {
      scope_id: qs("#scheduler-scope").value.trim(),
      domain: qs("#scheduler-domain").value.trim(),
      interval: Number(qs("#scheduler-interval").value.trim()),
      name: qs("#scheduler-name").value.trim(),
      policy_id: qs("#scheduler-policy").value.trim(),
    };
    if (!payload.scope_id || !payload.domain || !payload.interval) {
      toast("范围、域名和间隔不能为空。", "error");
      return;
    }
    try {
      await apiPost("scheduler/add/", payload);
      toast("调度已创建。", "success");
      renderScheduler(container);
    } catch (err) {
      toast("创建调度失败。", "error");
    }
  });

  container.appendChild(addCard);

  const listCard = card("调度列表", "当前监控任务。");
  const listBody = qs(".card-body", listCard);
  const filterGetter = renderFilters(listBody);
  const paginationGetter = renderPagination(listBody, { page: 1, size: 10, order: "-_id" });

  const loadBtn = document.createElement("button");
  loadBtn.className = "primary-button";
  loadBtn.textContent = "加载调度";
  listBody.appendChild(loadBtn);

  const tableHost = document.createElement("div");
  listBody.appendChild(tableHost);

  async function loadSchedulers() {
    const filters = filterGetter();
    const pagination = paginationGetter();
    const params = { ...filters, ...pagination };
    const response = await apiGet("scheduler/", params);
    const { items } = normalizeListResponse(response);
    tableHost.innerHTML = "";
    const columns = [
      { key: "name", label: "名称" },
      { key: "domain", label: "域名" },
      { key: "scope_id", label: "范围" },
      { key: "interval", label: "间隔" },
      { key: "status", label: "状态" },
      { key: "next_run_date", label: "下次运行" },
      { key: "run_number", label: "运行次数" },
      { key: "_id", label: "任务 ID" },
    ];

    const actions = [
      {
        label: "停止",
        className: "secondary-button",
        onClick: (item) => apiPost("scheduler/stop/", { job_id: item._id }).then(() => {
          toast("调度已停止。", "success");
          loadSchedulers();
        }),
      },
      {
        label: "恢复",
        className: "ghost-button",
        onClick: (item) => apiPost("scheduler/recover/", { job_id: item._id }).then(() => {
          toast("调度已恢复。", "success");
          loadSchedulers();
        }),
      },
      {
        label: "删除",
        className: "danger-button",
        onClick: (item) => apiPost("scheduler/delete/", { job_id: [item._id] }).then(() => {
          toast("调度已删除。", "success");
          loadSchedulers();
        }),
      },
    ];

    tableHost.appendChild(table(columns, items, actions));
  }

  loadBtn.addEventListener("click", () => {
    loadSchedulers().catch(() => toast("加载调度失败。", "error"));
  });

  container.appendChild(listCard);
  animateIn(container);
}

async function renderGithub(container) {
  container.innerHTML = "";
  const addCard = card("创建 GitHub 任务", "监控关键词与仓库。");
  const addBody = qs(".card-body", addCard);
  addBody.innerHTML = `
    <div class="form-grid">
      <div class="form-group">
        <label>名称</label>
        <input id="github-name" type="text" placeholder="任务名称">
      </div>
      <div class="form-group">
        <label>关键词</label>
        <input id="github-keyword" type="text" placeholder="关键词">
      </div>
    </div>
    <button class="primary-button" id="github-submit" type="button">创建 GitHub 任务</button>
  `;

  addBody.querySelector("#github-submit").addEventListener("click", async () => {
    const payload = {
      name: qs("#github-name").value.trim(),
      keyword: qs("#github-keyword").value.trim(),
    };
    if (!payload.name || !payload.keyword) {
      toast("名称和关键词不能为空。", "error");
      return;
    }
    try {
      await apiPost("github_task/", payload);
      toast("GitHub 任务已创建。", "success");
      renderGithub(container);
    } catch (err) {
      toast("创建 GitHub 任务失败。", "error");
    }
  });

  container.appendChild(addCard);

  const listCard = card("GitHub 任务", "管理泄露监控任务。");
  const listBody = qs(".card-body", listCard);
  const filterGetter = renderFilters(listBody);
  const paginationGetter = renderPagination(listBody, { page: 1, size: 10, order: "-_id" });

  const loadBtn = document.createElement("button");
  loadBtn.className = "primary-button";
  loadBtn.textContent = "加载 GitHub 任务";
  listBody.appendChild(loadBtn);

  const tableHost = document.createElement("div");
  listBody.appendChild(tableHost);

  async function loadGithubTasks() {
    const filters = filterGetter();
    const pagination = paginationGetter();
    const params = { ...filters, ...pagination };
    const response = await apiGet("github_task/", params);
    const { items } = normalizeListResponse(response);
    tableHost.innerHTML = "";
    const columns = [
      { key: "name", label: "名称" },
      { key: "keyword", label: "关键词" },
      { key: "status", label: "状态" },
      { key: "start_time", label: "开始" },
      { key: "end_time", label: "结束" },
      { key: "_id", label: "ID" },
    ];

    const actions = [
      {
        label: "停止",
        className: "secondary-button",
        onClick: (item) => apiPost("github_task/stop/", { _id: [item._id] }).then(() => {
          toast("GitHub 任务已停止。", "success");
          loadGithubTasks();
        }),
      },
      {
        label: "删除",
        className: "danger-button",
        onClick: (item) => apiPost("github_task/delete/", { _id: [item._id] }).then(() => {
          toast("GitHub 任务已删除。", "success");
          loadGithubTasks();
        }),
      },
    ];

    tableHost.appendChild(table(columns, items, actions));
  }

  loadBtn.addEventListener("click", () => {
    loadGithubTasks().catch(() => toast("加载 GitHub 任务失败。", "error"));
  });

  container.appendChild(listCard);

  const resultCard = card("GitHub 结果", "查看命中关键词与来源。");
  const resultBody = qs(".card-body", resultCard);
  const resultFilter = renderFilters(resultBody);
  const resultPagination = renderPagination(resultBody, { page: 1, size: 10, order: "-_id" });
  const resultBtn = document.createElement("button");
  resultBtn.className = "primary-button";
  resultBtn.textContent = "加载结果";
  resultBody.appendChild(resultBtn);

  const resultTableHost = document.createElement("div");
  resultBody.appendChild(resultTableHost);

  async function loadResults() {
    const filters = resultFilter();
    const pagination = resultPagination();
    const params = { ...filters, ...pagination };
    const response = await apiGet("github_result/", params);
    const { items } = normalizeListResponse(response);
    resultTableHost.innerHTML = "";
    const columns = inferColumns(items);
    resultTableHost.appendChild(table(columns, items));
  }

  resultBtn.addEventListener("click", () => {
    loadResults().catch(() => toast("加载 GitHub 结果失败。", "error"));
  });

  container.appendChild(resultCard);
  animateIn(container);
}
async function renderPolicies(container) {
  container.innerHTML = "";

  const listCard = card("策略", "审核并管理策略预设。");
  const listBody = qs(".card-body", listCard);
  const filterGetter = renderFilters(listBody);
  const paginationGetter = renderPagination(listBody, { page: 1, size: 10, order: "-_id" });
  const loadBtn = document.createElement("button");
  loadBtn.className = "primary-button";
  loadBtn.textContent = "加载策略";
  listBody.appendChild(loadBtn);

  const tableHost = document.createElement("div");
  listBody.appendChild(tableHost);

  async function loadPolicies() {
    const filters = filterGetter();
    const pagination = paginationGetter();
    const params = { ...filters, ...pagination };
    const response = await apiGet("policy/", params);
    const { items } = normalizeListResponse(response);
    tableHost.innerHTML = "";
    const columns = inferColumns(items);
    tableHost.appendChild(table(columns, items));
  }

  loadBtn.addEventListener("click", () => {
    loadPolicies().catch(() => toast("加载策略失败。", "error"));
  });

  container.appendChild(listCard);

  const addCard = card("新增策略", "提交 JSON 以创建复杂策略。");
  const addBody = qs(".card-body", addCard);
  addBody.innerHTML = `
    <div class="form-group">
      <label>策略 JSON</label>
      <textarea id="policy-json" placeholder='{"name":"策略名称","desc":"","policy":{}}'></textarea>
    </div>
    <div class="flex-row">
      <button class="secondary-button" id="policy-generate-vuln" type="button">生成漏洞策略</button>
      <button class="ghost-button" id="policy-sync-poc" type="button">同步插件</button>
      <button class="primary-button" id="policy-submit" type="button">创建策略</button>
    </div>
  `;

  const policyJsonEl = qs("#policy-json");
  const policySyncBtn = qs("#policy-sync-poc");
  const policyGenerateBtn = qs("#policy-generate-vuln");

  const syncPocPlugins = async () => {
    await apiGet("poc/sync/");
  };

  const buildVulnPolicyPayload = async () => {
    const [pocResp, bruteResp] = await Promise.all([
      apiGet("poc/", { plugin_type: "poc", page: 1, size: 10000 }),
      apiGet("poc/", { plugin_type: "brute", page: 1, size: 10000 }),
    ]);
    const pocItems = normalizeListResponse(pocResp).items;
    const bruteItems = normalizeListResponse(bruteResp).items;
    if (!pocItems.length && !bruteItems.length) {
      throw new Error("\u672a\u53d1\u73b0\u53ef\u7528\u63d2\u4ef6\uff0c\u8bf7\u5148\u540c\u6b65\u63d2\u4ef6");
    }
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    return {
      name: `\u6f0f\u6d1e\u6df1\u5ea6\u7b56\u7565-${stamp}`,
      desc: "\u81ea\u52a8\u751f\u6210\uff1a\u5168\u91cf PoC/\u5f31\u53e3\u4ee4 + \u6df1\u5ea6\u626b\u63cf",
      policy: {
        domain_config: {
          domain_brute: true,
          domain_brute_type: "big",
          alt_dns: true,
          arl_search: true,
          dns_query_plugin: true,
        },
        ip_config: {
          port_scan: true,
          port_scan_type: "top1000",
          service_detection: true,
          os_detection: true,
          ssl_cert: true,
          skip_scan_cdn_ip: false,
        },
        site_config: {
          site_identify: true,
          site_capture: true,
          search_engines: true,
          site_spider: true,
          nuclei_scan: true,
          web_info_hunter: true,
        },
        file_leak: true,
        npoc_service_detection: true,
        poc_config: pocItems.map((item) => ({
          plugin_name: item.plugin_name,
          enable: true,
        })),
        brute_config: bruteItems.map((item) => ({
          plugin_name: item.plugin_name,
          enable: true,
        })),
        scope_config: {
          scope_id: "",
        },
      },
    };
  };

  if (policySyncBtn) {
    policySyncBtn.addEventListener("click", async () => {
      try {
        await syncPocPlugins();
        toast("\u63d2\u4ef6\u5df2\u540c\u6b65", "success");
      } catch (err) {
        toast("\u63d2\u4ef6\u540c\u6b65\u5931\u8d25", "error");
      }
    });
  }

  if (policyGenerateBtn) {
    policyGenerateBtn.addEventListener("click", async () => {
      try {
        await syncPocPlugins();
        const payload = await buildVulnPolicyPayload();
        if (policyJsonEl) {
          policyJsonEl.value = JSON.stringify(payload, null, 2);
        }
        toast("\u6f0f\u6d1e\u7b56\u7565\u5df2\u751f\u6210", "success");
      } catch (err) {
        toast(err.message || "\u751f\u6210\u6f0f\u6d1e\u7b56\u7565\u5931\u8d25", "error");
      }
    });
  }

  addBody.querySelector("#policy-submit").addEventListener("click", async () => {
    const raw = qs("#policy-json").value.trim();
    if (!raw) {
      toast("策略 JSON 不能为空。", "error");
      return;
    }
    try {
      const payload = JSON.parse(raw);
      await apiPost("policy/add/", payload);
      toast("策略已创建。", "success");
      renderPolicies(container);
    } catch (err) {
      toast("创建策略失败，请检查 JSON。", "error");
    }
  });

  container.appendChild(addCard);
  animateIn(container);
}

async function renderApiConsole(container) {
  container.innerHTML = "";

  const consoleCard = card("API 控制台", "发送直连请求并查看原始响应。");
  const consoleBody = qs(".card-body", consoleCard);
  consoleBody.innerHTML = `
    <div class="form-grid">
      <div class="form-group">
        <label>方法</label>
        <select id="api-method">
          <option value="GET">GET</option>
          <option value="POST">POST</option>
        </select>
      </div>
      <div class="form-group">
        <label>路径</label>
        <input id="api-path" type="text" placeholder="例如 task/">
      </div>
    </div>
    <div class="form-group">
      <label>JSON 请求体（POST）</label>
      <textarea id="api-body" placeholder="{}"></textarea>
    </div>
    <button class="primary-button" id="api-send" type="button">发送请求</button>
    <div class="form-group">
      <label>响应</label>
      <textarea id="api-response" readonly></textarea>
    </div>
  `;

  consoleBody.querySelector("#api-send").addEventListener("click", async () => {
    const method = qs("#api-method").value;
    const path = qs("#api-path").value.trim();
    const responseArea = qs("#api-response");
    if (!path) {
      toast("路径不能为空。", "error");
      return;
    }
    try {
      let result;
      if (method === "GET") {
        result = await apiGet(path);
      } else {
        const rawBody = qs("#api-body").value.trim() || "{}";
        const payload = JSON.parse(rawBody);
        result = await apiPost(path, payload);
      }
      responseArea.value = JSON.stringify(result, null, 2);
      toast("请求完成。", "success");
    } catch (err) {
      responseArea.value = err.message;
    }
  });

  container.appendChild(consoleCard);
  animateIn(container);
}

async function renderSettings(container) {
  container.innerHTML = "";

  const authCard = card("鉴权", "登录、退出与修改密码。");
  const authBody = qs(".card-body", authCard);
  authBody.innerHTML = `
    <div class="form-grid">
      <div class="form-group">
        <label>用户名</label>
        <input id="auth-username" type="text" placeholder="admin">
      </div>
      <div class="form-group">
        <label>密码</label>
        <input id="auth-password" type="password" placeholder="密码">
      </div>
    </div>
    <button class="primary-button" id="login-btn" type="button">登录</button>
    <div class="notice">配置中可能关闭鉴权，登录成功后 Token 会本地保存。</div>

    <div class="form-grid" style="margin-top:12px;">
      <div class="form-group">
        <label>旧密码</label>
        <input id="pass-old" type="password" placeholder="旧密码">
      </div>
      <div class="form-group">
        <label>新密码</label>
        <input id="pass-new" type="password" placeholder="新密码">
      </div>
      <div class="form-group">
        <label>确认密码</label>
        <input id="pass-confirm" type="password" placeholder="确认密码">
      </div>
    </div>
    <button class="secondary-button" id="change-pass" type="button">修改密码</button>
  `;

  authBody.querySelector("#login-btn").addEventListener("click", async () => {
    const username = qs("#auth-username").value.trim();
    const password = qs("#auth-password").value.trim();
    if (!username || !password) {
      toast("用户名和密码不能为空。", "error");
      return;
    }
    try {
      const result = await apiPost("user/login", { username, password });
      const data = result.data || result;
      if (data.token) {
        state.token = data.token;
        localStorage.setItem("arl_token", data.token);
        toast("登录成功。", "success");
      } else {
        toast("登录失败。", "error");
      }
    } catch (err) {
      toast("登录失败。", "error");
    }
  });

  authBody.querySelector("#change-pass").addEventListener("click", async () => {
    const payload = {
      old_password: qs("#pass-old").value.trim(),
      new_password: qs("#pass-new").value.trim(),
      check_password: qs("#pass-confirm").value.trim(),
    };
    if (!payload.old_password || !payload.new_password) {
      toast("请填写完整密码字段。", "error");
      return;
    }
    try {
      await apiPost("user/change_pass", payload);
      toast("密码已更新。", "success");
    } catch (err) {
      toast("密码更新失败。", "error");
    }
  });

  container.appendChild(authCard);

  const apiCard = card("运行参数", "配置 API 基址并查看 Token。");
  const apiBody = qs(".card-body", apiCard);
  apiBody.innerHTML = `
    <div class="form-grid">
      <div class="form-group">
        <label>API 基址</label>
        <input id="api-base" type="text" value="${escapeHtml(state.apiBase)}">
      </div>
      <div class="form-group">
        <label>Token</label>
        <input id="api-token" type="text" value="${escapeHtml(state.token)}">
      </div>
    </div>
    <button class="secondary-button" id="save-runtime" type="button">保存设置</button>
  `;

  apiBody.querySelector("#save-runtime").addEventListener("click", () => {
    state.apiBase = qs("#api-base").value.trim() || "/api";
    state.token = qs("#api-token").value.trim();
    localStorage.setItem("arl_api_base", state.apiBase);
    localStorage.setItem("arl_token", state.token);
    qs("#env-pill").textContent = `API: ${state.apiBase}`;
    toast("设置已保存。", "success");
  });

  container.appendChild(apiCard);
  animateIn(container);
}

function inferColumns(items) {
  if (!items || !items.length) {
    return [{ key: "_id", label: "ID" }];
  }
  const sample = items[0];
  const keys = Object.keys(sample).slice(0, 7);
  return keys.map((key) => ({ key, label: key }));
}

function route() {
  const hash = window.location.hash || "#/dashboard";
  const pageId = hash.replace("#/", "").split("?")[0];
  const meta = pageMeta[pageId] || pageMeta.dashboard;
  const view = qs("#view");
  setPageMeta(pageId);
  setActiveNav(pageId);
  meta.render(view);
}

function bindGlobalActions() {
  qs("#env-pill").textContent = `API: ${state.apiBase}`;

  qs("#quick-action").addEventListener("click", () => {
    window.location.hash = "#/tasks";
  });

  qs("#logout-btn").addEventListener("click", async () => {
    try {
      await apiGet("user/logout");
    } catch (err) {
      // ignore
    }
    state.token = "";
    localStorage.removeItem("arl_token");
    toast("已退出登录。", "success");
  });

  qs("#global-search").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    const value = event.target.value.trim();
    if (!value) {
      return;
    }
    state.lastSearch = value;
    window.location.hash = "#/results";
  });
}

function init() {
  initNav();
  bindGlobalActions();
  window.addEventListener("hashchange", route);
  route();
}

init();
