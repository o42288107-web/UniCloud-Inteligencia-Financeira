// DOM Elements
const btnFiltrar = document.getElementById('btnFiltrar');
const inputDataInicial = document.getElementById('dataInicial');
const inputDataFinal = document.getElementById('dataFinal');
const inputFilial = document.getElementById('filial');
const btnStockRefresh = document.getElementById('btnStockRefresh');
const stockDateStart = document.getElementById('stockDateStart');
const stockDateEnd = document.getElementById('stockDateEnd');
const stockBranch = document.getElementById('stockBranch');
const stockSupplier = document.getElementById('stockSupplier');
const stockSupplierOptions = document.getElementById('stockSupplierOptions');
const stockGroup = document.getElementById('stockGroup');
const stockGroupOptions = document.getElementById('stockGroupOptions');
const stockStatus = document.getElementById('stockStatus');
const stockMetaNotice = document.getElementById('stockMetaNotice');
const stockTableCount = document.getElementById('stockTableCount');
const stockTableBody = document.querySelector('#stockTable tbody');
const stockPrevPage = document.getElementById('stockPrevPage');
const stockNextPage = document.getElementById('stockNextPage');
const stockPaginationInfo = document.getElementById('stockPaginationInfo');
const stockKpiProducts = document.getElementById('stockKpiProducts');
const stockKpiQuantity = document.getElementById('stockKpiQuantity');
const stockKpiCost = document.getElementById('stockKpiCost');
const stockKpiSale = document.getElementById('stockKpiSale');
const stockKpiMargin = document.getElementById('stockKpiMargin');
const stockKpiOut = document.getElementById('stockKpiOut');
const stockKpiHigh = document.getElementById('stockKpiHigh');
const stockKpiMode = document.getElementById('stockKpiMode');
const stockTopValue = document.getElementById('stockTopValue');
const stockTopMargin = document.getElementById('stockTopMargin');
const stockTopSupplier = document.getElementById('stockTopSupplier');
const stockTopGroup = document.getElementById('stockTopGroup');

const kpiFaturamento = document.getElementById('kpiFaturamento');
const kpiDespesas = document.getElementById('kpiDespesas');
const kpiPercentual = document.getElementById('kpiPercentual');
const kpiDespesasBreakdown = document.getElementById('kpiDespesasBreakdown');
const btnManualAccount = document.getElementById('btnManualAccount');
const detailsSearchInput = document.getElementById('detailsSearchInput');
const detailsSourceFilter = document.getElementById('detailsSourceFilter');
const detailsTableCount = document.getElementById('detailsTableCount');

const detailsTableBody = document.querySelector('#detailsTable tbody');

// Tab System
const tabBar = document.getElementById('tabBar');
const tabContents = document.getElementById('tabContents');

// Chart Instances
let monthlyChartInstance = null;
let top10ChartInstance = null;
let currentDashboardData = null;
let currentDetailsRows = [];
let currentStockIntelligenceData = null;
let currentStockPage = 1;
let currentStockSupplierOptions = [];
let currentStockGroupOptions = [];
const STOCK_PAGE_SIZE = 25;
const STOCK_AUTOCOMPLETE_LIMIT = 40;

// Hidden DB Config Tab Toggle (Ctrl+A+O)
let isDbConfigVisible = false;
let dbConfigShortcutHandled = false;
const pressedKeys = new Set();
let dbConfigShortcutArmedUntil = 0;
let dbConfigMutationObserver = null;
const DB_CONFIG_STATIC_TAB_ID = 'settings';
let dbSettingsInitialized = false;
let dbSelectedConnectionId = null;
let dbMappingDefinition = [];
let currentAiMode = 'conversa';
let presentationState = {
    stage: 'filters',
    filters: null,
    data: null,
    aiAnalysis: null,
    currentSlideIndex: 0,
    isPresenting: false
};
const PRESENTATION_LOG_PREFIX = '[IA Apresentacao]';

function safeLogPayload(payload) {
    try {
        return JSON.stringify(payload, (key, value) => {
            if (typeof value === 'bigint') return value.toString();
            if (value instanceof Error) {
                return {
                    message: value.message,
                    stack: value.stack
                };
            }
            return value;
        });
    } catch (error) {
        return `[payload nao serializavel: ${error.message}]`;
    }
}

function getPresentationDataSummary(data) {
    return {
        mainRows: Array.isArray(data?.main) ? data.main.length : 0,
        monthlyRows: Array.isArray(data?.monthly) ? data.monthly.length : 0,
        top10Rows: Array.isArray(data?.top10) ? data.top10.length : 0
    };
}

function logPresentationStep(step, payload = {}) {
    console.log(`${PRESENTATION_LOG_PREFIX} ${step} ${safeLogPayload(payload)}`);
}

function logPresentationError(step, error, payload = {}) {
    console.error(`${PRESENTATION_LOG_PREFIX} ${step} ${safeLogPayload({
        ...payload,
        message: error?.message || String(error),
        stack: error?.stack || null
    })}`);
}

window.addEventListener('error', (event) => {
    logPresentationError('Erro global de JavaScript', event.error || event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
    });
});

window.addEventListener('unhandledrejection', (event) => {
    logPresentationError('Promise rejeitada sem tratamento', event.reason);
});

// Currency Formatter
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatPercent = (value) => {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + '%';
};

const formatQuantity = (value) => {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value || 0);
};

const formatDateInput = (date) => {
    return date.toISOString().split('T')[0];
};


// --- Tab Manager ---
let tabs = ['dashboard', 'stock-intelligence', 'ai', DB_CONFIG_STATIC_TAB_ID];

function openTab(id, title, contentBuilder) {
    if (tabs.includes(id)) {
        switchTab(id);
        return;
    }

    // Create Tab Item
    const tabItem = document.createElement('div');
    tabItem.className = 'tab';
    tabItem.dataset.tab = id;
    tabItem.onclick = (e) => {
        if (!e.target.classList.contains('tab-close')) {
            switchTab(id, { source: 'tab-click' });
        }
    };
    tabItem.innerHTML = `
        <span class="tab-title">${escapeHtml(title)}</span>
        <span class="tab-close" onclick="window.closeTab('${id}', event)">X</span>
    `;
    tabBar.appendChild(tabItem);

    // Create Tab Content
    const tabContent = document.createElement('div');
    tabContent.id = `tab-${id}`;
    tabContent.className = 'tab-content';
    tabContent.innerHTML = contentBuilder();
    tabContents.appendChild(tabContent);

    tabs.push(id);

    // Keep DB Config tab hidden unless shortcut enabled.
    if (isDbConfigTab(tabItem) && !isDbConfigVisible) {
        setDbConfigVisibility(false);
        switchTab('dashboard');
        return;
    }

    switchTab(id);
}

function closeTab(id, event) {
    if (event) event.stopPropagation();
    logPresentationStep('closeTab chamado', {
        id,
        activeBefore: document.querySelector('.tab.active')?.dataset.tab || null,
        tabs: [...tabs]
    });

    if (id === 'dashboard') return; // Cannot close dashboard

    const tabItem = document.querySelector(`.tab[data-tab="${id}"]`);
    const tabContent = document.getElementById(`tab-${id}`);

    if (tabItem) tabItem.remove();
    if (tabContent) tabContent.remove();

    tabs = tabs.filter(t => t !== id);

    // If active was closed, switch to last available
    if (!document.querySelector('.tab.active')) {
        switchTab(tabs[tabs.length - 1]);
    }
}

function shouldKeepPresentationTab(id, options = {}) {
    const activeTabId = document.querySelector('.tab.active')?.dataset.tab || null;
    const isProgrammaticDashboardSwitch = id === 'dashboard'
        && options.source !== 'tab-click'
        && options.allowPresentationExit !== true;
    const isPresentationFlowActive = currentAiMode === 'apresentacao'
        && ['loading', 'deck'].includes(presentationState.stage);

    return isProgrammaticDashboardSwitch && isPresentationFlowActive && activeTabId === 'ai';
}

function switchTab(id, options = {}) {
    logPresentationStep('switchTab chamado', {
        id,
        source: options.source || 'programmatic',
        allowPresentationExit: Boolean(options.allowPresentationExit),
        activeBefore: document.querySelector('.tab.active')?.dataset.tab || null,
        tabs: [...tabs]
    });

    if (shouldKeepPresentationTab(id, options)) {
        logPresentationStep('switchTab bloqueado para preservar apresentacao', {
            requestedId: id,
            source: options.source || 'programmatic',
            stage: presentationState.stage,
            currentAiMode,
            ui: getPresentationUiSnapshot()
        });
        return;
    }

    // Deactivate all
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    // Activate target
    const targetTab = document.querySelector(`.tab[data-tab="${id}"]`);
    const targetContent = document.getElementById(`tab-${id}`);

    if (targetTab && targetContent) {
        targetTab.classList.add('active');
        targetContent.classList.add('active');
        
        // Trigger resize for Chart.js to recalculate dimensions
        if (id === 'dashboard') {
            window.dispatchEvent(new Event('resize'));
            if (monthlyChartInstance) monthlyChartInstance.update();
            if (top10ChartInstance) top10ChartInstance.update();
        }

        logPresentationStep('switchTab aplicado', {
            id,
            targetTabFound: true,
            targetContentFound: true,
            activeAfter: document.querySelector('.tab.active')?.dataset.tab || null
        });
    } else {
        logPresentationError('switchTab falhou: alvo nao encontrado', new Error(`Tab ${id} nao encontrada`), {
            id,
            targetTabFound: Boolean(targetTab),
            targetContentFound: Boolean(targetContent),
            tabs: [...tabs]
        });
    }
}

function normalizeText(value) {
    return (value || '').toString().trim().toLowerCase();
}

function hasAnyHint(text, hints) {
    return hints.some(hint => text.includes(hint));
}

function isDbConfigIdentifier(identifier) {
    const normalized = normalizeText(identifier);
    if (!normalized) return false;

    const strongMatches = [
        'configuração de banco',
        'configuracao de banco',
        'configuração banco',
        'configuracao banco',
        'banco de dados'
    ];

    if (strongMatches.some(match => normalized.includes(match))) {
        return true;
    }

    const configHints = ['config', 'configur', 'setting', 'ajuste'];
    const dbHints = ['banco', 'db', 'database', 'postgres', 'mysql', 'sql', 'host', 'porta', 'usuário', 'usuario', 'senha'];

    const hasConfig = hasAnyHint(normalized, configHints);
    const hasDb = hasAnyHint(normalized, dbHints);

    return hasConfig && hasDb;
}

function isDbConfigTab(tabElement) {
    if (!tabElement) return false;

    const tabId = normalizeText(tabElement.dataset.tab);
    const tabTitle = normalizeText(tabElement.querySelector('.tab-title')?.textContent);
    const fullTabText = normalizeText(tabElement.textContent);

    if (isDbConfigIdentifier(tabId) || isDbConfigIdentifier(tabTitle) || isDbConfigIdentifier(fullTabText)) {
        return true;
    }

    const contentId = tabElement.dataset.tab ? `tab-${tabElement.dataset.tab}` : '';
    const content = contentId ? document.getElementById(contentId) : null;

    if (!content) return false;

    const contentSignals = normalizeText(`${content.id} ${content.textContent || ''}`);
    const hasDbFields = !!content.querySelector(
        '[id*="db"], [name*="db"], [id*="database"], [name*="database"], [id*="host"], [name*="host"], [id*="senha"], [name*="senha"], [id*="usuario"], [name*="usuario"]'
    );

    return isDbConfigIdentifier(contentSignals) || hasDbFields;
}

function getDbConfigTabElements() {
    const detectedTabs = Array.from(document.querySelectorAll('.tab')).filter(isDbConfigTab);
    const staticSettingsTab = document.querySelector(`.tab[data-tab="${DB_CONFIG_STATIC_TAB_ID}"]`);

    if (staticSettingsTab && !detectedTabs.includes(staticSettingsTab)) {
        detectedTabs.push(staticSettingsTab);
    }

    return detectedTabs;
}

function setDbConfigVisibility(show) {
    isDbConfigVisible = show;

    const dbTabs = getDbConfigTabElements();

    dbTabs.forEach(tab => {
        const tabId = tab.dataset.tab;
        const relatedContent = tabId ? document.getElementById(`tab-${tabId}`) : null;

        tab.style.display = show ? '' : 'none';
        if (relatedContent) {
            relatedContent.style.display = show ? '' : 'none';
        }
    });

    if (!show) {
        const activeDbTab = dbTabs.find(tab => tab.classList.contains('active'));
        if (activeDbTab) {
            switchTab('dashboard');
        }
    }
}

function tryToggleDbConfigShortcut(event) {
    const key = normalizeText(event.key);
    if (key) {
        pressedKeys.add(key);
    }

    if (event.ctrlKey && key === 'a') {
        dbConfigShortcutArmedUntil = Date.now() + 2500;
    }

    const isSequentialCombo = event.ctrlKey && key === 'o' && Date.now() <= dbConfigShortcutArmedUntil;
    const isSimultaneousCombo = event.ctrlKey && pressedKeys.has('a') && pressedKeys.has('o');
    const comboIsPressed = isSequentialCombo || isSimultaneousCombo;
    const relevantKeyPressed = key === 'a' || key === 'o';

    if (comboIsPressed && relevantKeyPressed && !dbConfigShortcutHandled) {
        dbConfigShortcutHandled = true;
        const shouldShow = !isDbConfigVisible;
        setDbConfigVisibility(shouldShow);
        switchTab(shouldShow ? DB_CONFIG_STATIC_TAB_ID : 'dashboard');
        dbConfigShortcutArmedUntil = 0;
        event.preventDefault();
    }
}

function releaseDbConfigShortcut(event) {
    const key = normalizeText(event.key);
    if (key) {
        pressedKeys.delete(key);
    }

    if (!event.ctrlKey || !pressedKeys.has('a') || !pressedKeys.has('o')) {
        dbConfigShortcutHandled = false;
    }
}

// Expose to window for HTML onclick attributes
window.openTab = openTab;
window.closeTab = closeTab;
window.switchTab = switchTab;

// Keyboard Shortcuts & Global Events
window.addEventListener('keydown', tryToggleDbConfigShortcut);
window.addEventListener('keyup', releaseDbConfigShortcut);
window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'f')) {
        // Optional: Custom search/print override if needed
    }
});

// Start with DB Config tab hidden and allow toggle via Ctrl+A+O
setDbConfigVisibility(false);
window.addEventListener('blur', () => {
    pressedKeys.clear();
    dbConfigShortcutHandled = false;
    dbConfigShortcutArmedUntil = 0;
});

// Keep DB config tab hidden even if rendered/updated after load.
dbConfigMutationObserver = new MutationObserver(() => {
    if (!isDbConfigVisible) {
        setDbConfigVisibility(false);
    }
});

if (tabBar) {
    dbConfigMutationObserver.observe(tabBar, { childList: true, subtree: true });
}
if (tabContents) {
    dbConfigMutationObserver.observe(tabContents, { childList: true });
}

// --- Database Settings Panel Logic ---
const dbConnectionSelect = document.getElementById('dbConnectionSelect');
const dbType = document.getElementById('dbType');
const dbName = document.getElementById('dbName');
const dbHost = document.getElementById('dbHost');
const dbPort = document.getElementById('dbPort');
const dbDatabase = document.getElementById('dbDatabase');
const dbUser = document.getElementById('dbUser');
const dbPassword = document.getElementById('dbPassword');
const dbApiKey = document.getElementById('dbApiKey');
const dbSSL = document.getElementById('dbSSL');
const dbSetActive = document.getElementById('dbSetActive');
const dbBtnNew = document.getElementById('dbBtnNew');
const dbBtnRefresh = document.getElementById('dbBtnRefresh');
const dbBtnTest = document.getElementById('dbBtnTest');
const dbBtnSetActive = document.getElementById('dbBtnSetActive');
const dbBtnDelete = document.getElementById('dbBtnDelete');
const dbBtnSave = document.getElementById('dbBtnSave');
const dbStatus = document.getElementById('dbStatus');
const dbProfileList = document.getElementById('dbProfileList');
const dbBtnLoadMapping = document.getElementById('dbBtnLoadMapping');
const dbBtnSaveMapping = document.getElementById('dbBtnSaveMapping');
const dbMappingCards = document.getElementById('dbMappingCards');
const dbMappingHint = document.getElementById('dbMappingHint');
const dbSchemaSearch = document.getElementById('dbSchemaSearch');
const dbSchemaCards = document.getElementById('dbSchemaCards');
const dbSchemaCount = document.getElementById('dbSchemaCount');
const dbMappingSearch = document.getElementById('dbMappingSearch');
const dbMappingCount = document.getElementById('dbMappingCount');
const dbBtnSchemaPrev = document.getElementById('dbBtnSchemaPrev');
const dbBtnSchemaNext = document.getElementById('dbBtnSchemaNext');
const dbSchemaPaginationInfo = document.getElementById('dbSchemaPaginationInfo');

let dbSupportedTypes = [];
let dbConnectionsCache = [];
let dbActiveConnectionId = null;

let dbMappingData = null;
let dbSchemaTables = [];
let dbSchemaSearchTerm = '';
let dbMappingSearchTerm = '';
let dbSchemaPage = 1;
const dbSchemaLimit = 4;

function setDbStatus(message, tone = 'info') {
    if (!dbStatus) return;
    dbStatus.textContent = message;
    dbStatus.className = `db-status db-status-${tone}`;
}

function getDefaultPortByType(type) {
    const item = dbSupportedTypes.find((entry) => entry.type === type);
    return item?.defaultPort || '';
}

function fillDbTypeOptions(types) {
    if (!dbType) return;
    const previousValue = dbType.value;
    dbType.innerHTML = '';

    if (!types.length) {
        const fallback = document.createElement('option');
        fallback.value = 'postgres';
        fallback.textContent = 'PostgreSQL';
        dbType.appendChild(fallback);
        return;
    }

    types.forEach((entry) => {
        const option = document.createElement('option');
        option.value = entry.type;
        option.textContent = entry.installed ? entry.label : `${entry.label} (driver ausente)`;
        dbType.appendChild(option);
    });

    if (previousValue && types.some((entry) => entry.type === previousValue)) {
        dbType.value = previousValue;
    } else {
        const firstInstalled = types.find((entry) => entry.installed);
        dbType.value = firstInstalled ? firstInstalled.type : types[0].type;
    }
}

function clearDbForm() {
    if (!dbType) return;

    dbName.value = '';
    dbHost.value = 'localhost';
    dbDatabase.value = '';
    dbUser.value = '';
    dbPassword.value = '';
    dbApiKey.value = '';
    dbSSL.checked = false;
    dbSetActive.checked = true;

    const currentType = dbType.value || 'postgres';
    dbPort.value = getDefaultPortByType(currentType);
}

function applyDbConnectionToForm(connection) {
    if (!connection) {
        clearDbForm();
        return;
    }

    dbType.value = connection.type || dbType.value || 'postgres';
    dbName.value = connection.name || '';
    dbHost.value = connection.host || 'localhost';
    dbPort.value = connection.port || getDefaultPortByType(dbType.value);
    dbDatabase.value = connection.database || '';
    dbUser.value = connection.user || '';
    dbPassword.value = connection.password || '';
    dbApiKey.value = connection.apiKey || '';
    dbSSL.checked = Boolean(connection.ssl);
    dbSetActive.checked = connection.id === dbActiveConnectionId;
}

function buildDbPayloadFromForm() {
    const payload = {
        type: (dbType.value || 'postgres').trim(),
        name: dbName.value.trim(),
        host: dbHost.value.trim(),
        port: dbPort.value ? Number(dbPort.value) : getDefaultPortByType(dbType.value),
        database: dbDatabase.value.trim(),
        user: dbUser.value.trim(),
        password: dbPassword.value,
        apiKey: dbApiKey.value.trim(),
        ssl: Boolean(dbSSL.checked)
    };

    if (!payload.name) {
        payload.name = `${payload.type}-${payload.host || 'local'}`;
    }

    if (!payload.host) {
        return { valid: false, error: 'Informe o host da conexão.' };
    }
    if (!payload.database) {
        return { valid: false, error: 'Informe o nome do database.' };
    }
    if (!payload.user) {
        return { valid: false, error: 'Informe o usuário do banco.' };
    }
    if (!payload.port || Number.isNaN(payload.port)) {
        return { valid: false, error: 'Informe uma porta válida.' };
    }

    return { valid: true, payload };
}

function cloneData(value) {
    return JSON.parse(JSON.stringify(value || {}));
}

function getValueByPath(source, path) {
    return path.split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), source);
}

function setValueByPath(target, path, value) {
    const keys = path.split('.');
    let cursor = target;

    for (let i = 0; i < keys.length - 1; i += 1) {
        const key = keys[i];
        if (!cursor[key] || typeof cursor[key] !== 'object') {
            cursor[key] = {};
        }
        cursor = cursor[key];
    }
    cursor[keys[keys.length - 1]] = value;
}

function resetDbMappingFilter() {
    dbMappingSearchTerm = '';
    if (dbMappingSearch) dbMappingSearch.value = '';
    if (dbMappingCount) dbMappingCount.textContent = '0 relacionamentos';
}

function renderDbProfilesList() {
    if (!dbProfileList) return;

    if (!dbConnectionsCache.length) {
        dbProfileList.innerHTML = '<div class="db-profile-empty text-center py-10 text-on-surface-variant/60 text-sm italic">Nenhum perfil cadastrado.</div>';
        return;
    }

    dbProfileList.innerHTML = '';

    dbConnectionsCache.forEach((connection) => {
        const button = document.createElement('button');
        button.type = 'button';
        
        const isSelected = connection.id === dbSelectedConnectionId;
        const isActive = connection.id === dbActiveConnectionId;
        
        const activeTag = isActive ? ' <span class="ml-2 text-[10px] bg-primary-container text-on-primary-container px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Ativa</span>' : '';
        const borderClass = isSelected ? 'border-primary shadow-md' : 'border-transparent hover:bg-surface-container-high';
        
        button.className = `flex items-center justify-between p-4 bg-surface-container-lowest rounded-DEFAULT border-l-4 ${borderClass} transition-all text-left w-full group overflow-hidden shadow-sm`;
        
        button.innerHTML = `
            <div class="flex items-center gap-3 overflow-hidden">
                <div class="p-2 ${isSelected ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-outline group-hover:text-primary' } rounded-lg transition-all">
                    <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' ${isSelected ? '1' : '0'};">database</span>
                </div>
                <div class="overflow-hidden">
                    <p class="font-bold text-on-surface truncate flex items-center">${escapeHtml(connection.name)}${activeTag}</p>
                    <p class="text-xs text-on-surface-variant truncate uppercase tracking-tighter opacity-70">${escapeHtml(connection.type)} • ${escapeHtml(connection.host)}</p>
                </div>
            </div>
            <span class="material-symbols-outlined text-outline opacity-0 group-hover:opacity-100 transition-opacity" style="font-size: 20px;">chevron_right</span>
        `;

        button.addEventListener('click', () => {
            dbSelectedConnectionId = connection.id;
            if (dbConnectionSelect) dbConnectionSelect.value = connection.id;
            applyDbConnectionToForm(connection);
            renderDbProfilesList();
            setDbStatus(`Perfil "${connection.name}" selecionado.`, 'info');
            loadDbMappingTemplate();
        });

        dbProfileList.appendChild(button);
    });
}

function getFilteredSchemaTables() {
    if (!dbSchemaSearchTerm) return dbSchemaTables;

    return dbSchemaTables.filter((table) => {
        const tableName = String(table.fullName || table.name || '').toLowerCase();
        if (tableName.includes(dbSchemaSearchTerm)) return true;

        const columns = Array.isArray(table.columns) ? table.columns : [];
        return columns.some((column) => String(column || '').toLowerCase().includes(dbSchemaSearchTerm));
    });
}

function renderDbSchemaCards() {
    if (!dbSchemaCards) return;

    if (!dbSelectedConnectionId) {
        dbSchemaCards.innerHTML = '<div class="db-empty-state col-span-2 text-center py-20 text-on-surface-variant/60 flex flex-col items-center gap-2"><span class="material-symbols-outlined text-4xl mb-2 block opacity-20">database</span>Selecione um perfil para carregar as tabelas.</div>';
        if (dbSchemaCount) dbSchemaCount.textContent = '0 tabelas';
        return;
    }

    const filtered = getFilteredSchemaTables();
    const totalTables = dbSchemaTables.length;
    if (dbSchemaCount) {
        dbSchemaCount.textContent = `${filtered.length} / ${totalTables} tabelas`;
    }

    if (!filtered.length) {
        dbSchemaCards.innerHTML = '<div class="db-empty-state col-span-2 text-center py-20 text-on-surface-variant/60">Nenhuma tabela encontrada.</div>';
        return;
    }

    const ordered = [...filtered].sort((a, b) =>
        String(a.fullName || a.name || '').localeCompare(String(b.fullName || b.name || ''), 'pt-BR')
    );

    const totalFiltered = ordered.length;
    const totalPages = Math.ceil(totalFiltered / dbSchemaLimit) || 1;
    if (dbSchemaPage > totalPages) dbSchemaPage = totalPages;
    if (dbSchemaPage < 1) dbSchemaPage = 1;

    const startIndex = (dbSchemaPage - 1) * dbSchemaLimit;
    const paginated = ordered.slice(startIndex, startIndex + dbSchemaLimit);

    const cards = paginated.map((table) => {
        const tableName = escapeHtml(String(table.fullName || table.name || '(sem nome)'));
        const columns = Array.isArray(table.columns) ? table.columns : [];
        const previewLimit = 8;
        const visibleColumns = columns.slice(0, previewLimit);
        const hiddenCount = Math.max(0, columns.length - visibleColumns.length);

        let columnsHtml = visibleColumns.length
            ? visibleColumns.map((column) => `<span class="bg-surface-container-high text-[10px] px-2 py-0.5 rounded text-on-surface-variant border border-outline-variant/10">${escapeHtml(String(column))}</span>`).join('')
            : '<span class="text-[10px] italic text-on-surface-variant/40">(vazio)</span>';

        if (hiddenCount > 0) {
            columnsHtml += `<span class="bg-primary/5 text-primary text-[10px] px-2 py-0.5 rounded font-bold">+${hiddenCount}</span>`;
        }

        return `
            <article class="bg-surface-container-low p-5 rounded-xl border border-transparent hover:border-primary/30 hover:bg-white transition-all cursor-pointer group shadow-sm flex flex-col h-full">
                <div class="flex items-start justify-between mb-3 shrink-0">
                    <div class="p-2 bg-secondary-container rounded-lg text-on-secondary-container transition-transform group-hover:scale-110">
                        <span class="material-symbols-outlined text-[18px]">table_chart</span>
                    </div>
                </div>
                <h3 class="font-bold text-on-surface group-hover:text-primary transition-colors truncate mb-3" title="${tableName}">${tableName}</h3>
                <div class="flex flex-wrap gap-1 mt-auto">
                    ${columnsHtml}
                </div>
            </article>
        `;
    });

    dbSchemaCards.innerHTML = cards.join('');
    updateDbSchemaPagination(totalFiltered);
}

function updateDbSchemaPagination(totalFiltered) {
    const totalPages = Math.ceil(totalFiltered / dbSchemaLimit) || 1;
    if (dbSchemaPaginationInfo) {
        dbSchemaPaginationInfo.textContent = `Página ${dbSchemaPage} de ${totalPages}`;
    }
    if (dbBtnSchemaPrev) dbBtnSchemaPrev.disabled = dbSchemaPage <= 1;
    if (dbBtnSchemaNext) dbBtnSchemaNext.disabled = dbSchemaPage >= totalPages;
}

function normalizeDbIdentifier(value) {
    return String(value || '').trim().toLowerCase();
}

function resolveSchemaTableByName(mappedTableName) {
    const normalizedTarget = normalizeDbIdentifier(mappedTableName);
    if (!normalizedTarget) return null;

    const tables = Array.isArray(dbSchemaTables) ? dbSchemaTables : [];
    const exactFullName = tables.find((table) => normalizeDbIdentifier(table.fullName) === normalizedTarget);
    if (exactFullName) return exactFullName;

    const exactName = tables.find((table) => normalizeDbIdentifier(table.name) === normalizedTarget);
    if (exactName) return exactName;

    return tables.find((table) => normalizeDbIdentifier(table.fullName).endsWith(`.${normalizedTarget}`)) || null;
}

function resolveFieldState(value, schemaColumnSet, validateAgainstSchema) {
    const normalizedValue = normalizeDbIdentifier(value);
    if (!normalizedValue) {
        return { css: 'is-missing', text: 'Faltando' };
    }

    if (validateAgainstSchema && !schemaColumnSet.has(normalizedValue)) {
        // Special case for 'conta' which comes from a join with planocontas
        if (normalizedValue === 'conta' || normalizedValue === 'nome') {
            return { css: 'is-valid', text: 'OK (Join)' };
        }
        return { css: 'is-invalid', text: 'Nao encontrada' };
    }

    return { css: 'is-valid', text: 'OK' };
}

function renderDbMappingCards() {
    if (!dbMappingCards) return;

    if (!dbSelectedConnectionId) {
        dbMappingCards.innerHTML = '<div class="db-empty-state text-center py-10 text-on-surface-variant/60 text-sm">Selecione um perfil para visualizar o mapeamento.</div>';
        if (dbMappingCount) dbMappingCount.textContent = '0 relacionamentos';
        return;
    }

    if (!dbMappingDefinition.length || !dbMappingData) {
        dbMappingCards.innerHTML = '<div class="db-empty-state text-center py-10 text-on-surface-variant/60 text-sm">Mapeamento não carregado.</div>';
        if (dbMappingCount) dbMappingCount.textContent = '0 relacionamentos';
        return;
    }

    const query = dbMappingSearchTerm;
    const filteredSections = dbMappingDefinition.filter((section) => {
        if (!query) return true;

        const tableValue = getValueByPath(dbMappingData, section.tablePath) || '';
        const allText = [
            section.label,
            section.key,
            section.tablePath,
            tableValue,
            ...(section.columns || []).map((column) => `${column.label} ${column.path} ${getValueByPath(dbMappingData, column.path) || ''}`)
        ]
            .join(' ')
            .toLowerCase();

        return allText.includes(query);
    });

    if (dbMappingCount) {
        dbMappingCount.textContent = `${filteredSections.length} / ${dbMappingDefinition.length} relacionamentos`;
    }

    if (!filteredSections.length) {
        dbMappingCards.innerHTML = '<div class="db-empty-state text-center py-10 text-on-surface-variant/60 text-sm">Nenhum relacionamento encontrado.</div>';
        return;
    }

    const cards = filteredSections.map((section) => {
        const tableValue = getValueByPath(dbMappingData, section.tablePath) || '';
        const matchedTable = resolveSchemaTableByName(tableValue);
        const schemaColumnSet = new Set((matchedTable?.columns || []).map((column) => normalizeDbIdentifier(column)));
        const validateColumns = Boolean(matchedTable);

        const tableState = !normalizeDbIdentifier(tableValue)
            ? { css: 'is-missing', text: 'Tabela faltando', icon: 'error' }
            : matchedTable
                ? { css: 'is-valid', text: 'Tabela OK', icon: 'check_circle' }
                : { css: 'is-invalid', text: 'Tabela nao encontrada', icon: 'warning' };

        let missingCount = tableState.css === 'is-missing' ? 1 : 0;
        let invalidCount = tableState.css === 'is-invalid' ? 1 : 0;
        let validCount = tableState.css === 'is-valid' ? 1 : 0;

        const totalChecks = 1 + (section.columns || []).length;

        const columnsHtml = (section.columns || []).map((column) => {
            const colValue = getValueByPath(dbMappingData, column.path) || '';
            const state = resolveFieldState(colValue, schemaColumnSet, validateColumns);

            if (state.css === 'is-missing') missingCount += 1;
            if (state.css === 'is-invalid') invalidCount += 1;
            if (state.css === 'is-valid') validCount += 1;

            const stateIcon = state.css === 'is-valid' ? 'check_circle' : (state.css === 'is-missing' ? 'error' : 'warning');
            const stateColor = state.css === 'is-valid' ? 'text-green-500' : (state.css === 'is-missing' ? 'text-red-500' : 'text-amber-500');

            return `
                <div class="grid grid-cols-11 gap-2 items-center py-3 border-b border-outline-variant/10 last:border-0">
                    <div class="col-span-1 flex justify-center text-primary/30">
                        <span class="material-symbols-outlined text-sm">link</span>
                    </div>
                    <div class="col-span-10">
                        <div class="flex items-center justify-between mb-1.5">
                            <span class="text-[10px] font-black uppercase text-outline opacity-60 tracking-wider">${escapeHtml(column.label)}</span>
                            <span class="material-symbols-outlined text-[16px] ${stateColor}" title="${state.text}">${stateIcon}</span>
                        </div>
                        <div class="flex flex-col gap-1">
                            <input class="w-full bg-surface-container-low border-none rounded-lg px-3 py-1.5 text-xs font-mono text-primary font-bold focus:ring-2 focus:ring-primary/20 db-mapping-input" 
                                   data-map-path="${column.path}" value="${escapeHtml(String(colValue))}" placeholder="nome_da_coluna">
                            <span class="text-[9px] text-secondary/50 font-mono italic opacity-0 group-hover:opacity-100 transition-opacity">Destino: ${escapeHtml(column.path)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        const completionFinal = Math.max(0, Math.min(100, Math.round((validCount / totalChecks) * 100)));

        return `
            <article class="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/10 shadow-sm transition-all hover:shadow-md group">
                <div class="flex items-start justify-between mb-6">
                    <div class="flex items-center gap-3">
                        <div class="p-2.5 bg-primary/10 text-primary rounded-xl transition-all shadow-sm">
                             <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1;">schema</span>
                        </div>
                        <div>
                             <h3 class="font-bold text-on-surface group-hover:text-primary transition-colors">${escapeHtml(section.label)}</h3>
                             <p class="text-[10px] text-on-surface-variant font-mono uppercase opacity-50 tracking-widest">Mapeia: ${escapeHtml(section.key)}</p>
                        </div>
                    </div>
                    <div class="text-right flex flex-col items-end">
                        <div class="text-[11px] font-black text-primary uppercase tracking-wider mb-1">${completionFinal}% OK</div>
                        <div class="w-20 h-1.5 bg-surface-container rounded-full overflow-hidden shadow-inner">
                            <div class="h-full bg-primary transition-all duration-700 ease-out" style="width: ${completionFinal}%"></div>
                        </div>
                    </div>
                </div>

                <div class="space-y-6">
                    <!-- Tabela Origem -->
                    <div class="bg-surface-container-low p-4 rounded-xl border border-outline-variant/5 shadow-inner">
                         <div class="flex justify-between items-center mb-2">
                             <label class="text-[10px] font-black uppercase text-outline opacity-60 tracking-wider">Tabela de Origem</label>
                             <div class="flex items-center gap-1">
                                 <span class="text-[9px] font-bold ${tableState.css === 'is-valid' ? 'text-green-500' : 'text-red-500'} uppercase">${tableState.text}</span>
                                 <span class="material-symbols-outlined text-[16px] ${tableState.css === 'is-valid' ? 'text-green-500' : 'text-red-500'}" title="${tableState.text}">${tableState.icon}</span>
                             </div>
                         </div>
                         <div class="relative">
                            <input class="w-full bg-white border border-outline-variant/20 rounded-lg px-4 py-2 text-xs font-bold text-on-surface focus:ring-2 focus:ring-primary/20 db-mapping-input transition-all" 
                                   data-map-path="${section.tablePath}" value="${escapeHtml(String(tableValue))}" placeholder="ex: public.orders">
                         </div>
                         <p class="mt-1.5 text-[9px] text-on-surface-variant/40 font-mono">Local: ${escapeHtml(section.tablePath)}</p>
                    </div>

                    <!-- Campos -->
                    <div class="bg-white/40 rounded-xl p-4 border border-outline-variant/10 shadow-sm">
                        <div class="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em] mb-3 opacity-40 ml-1">Relacionamento de Campos</div>
                        <div class="space-y-1">
                            ${columnsHtml}
                        </div>
                    </div>
                </div>
            </article>
        `;
    });

    dbMappingCards.innerHTML = cards.join('');
}

async function loadDbSchemaCatalog() {
    if (!window.api?.dbGetSchema) return;

    if (!dbSelectedConnectionId) {
        dbSchemaTables = [];
        dbSchemaSearchTerm = '';
        if (dbSchemaSearch) dbSchemaSearch.value = '';
        renderDbSchemaCards();
        return;
    }

    try {
        const response = await window.api.dbGetSchema(dbSelectedConnectionId);
        if (!response?.success) {
            dbSchemaTables = [];
            renderDbSchemaCards();
            renderDbMappingCards();
            return;
        }

        dbSchemaTables = Array.isArray(response.data?.tables) ? response.data.tables : [];
        renderDbSchemaCards();
        renderDbMappingCards();
    } catch (error) {
        dbSchemaTables = [];
        renderDbSchemaCards();
        renderDbMappingCards();
    }
}

async function loadDbMappingTemplate() {
    if (!dbSelectedConnectionId) {
        if (dbMappingHint) dbMappingHint.textContent = 'Selecione um perfil para editar o mapeamento.';
        dbMappingDefinition = [];
        dbMappingData = null;
        resetDbMappingFilter();
        renderDbMappingCards();
        await loadDbSchemaCatalog();
        return;
    }

    if (!window.api?.dbGetMappingTemplate) {
        setDbStatus('Função de mapeamento indisponível nesta versão.', 'warning');
        return;
    }

    if (dbMappingHint) dbMappingHint.textContent = 'Carregando mapeamento...';
    try {
        const response = await window.api.dbGetMappingTemplate(dbSelectedConnectionId);
        if (!response?.success) {
            throw new Error(response?.error || 'Falha ao carregar mapeamento.');
        }

        dbMappingDefinition = Array.isArray(response.data?.definition) ? response.data.definition : [];
        dbMappingData = cloneData(response.data?.mapping || {});
        await loadDbSchemaCatalog();
        if (dbMappingHint) dbMappingHint.textContent = 'Mapeamento carregado. Edite os campos e clique em salvar.';
    } catch (error) {
        console.error('Erro ao carregar mapeamento:', error);
        setDbStatus(error.message || 'Erro ao carregar mapeamento.', 'error');
        if (dbMappingHint) dbMappingHint.textContent = 'Erro ao carregar mapeamento.';
        dbMappingDefinition = [];
        dbMappingData = null;
        resetDbMappingFilter();
        renderDbMappingCards();
        await loadDbSchemaCatalog();
    }
}

async function saveDbMapping() {
    if (!dbSelectedConnectionId) {
        setDbStatus('Selecione um perfil antes de salvar o mapeamento.', 'warning');
        return;
    }

    if (!window.api?.dbSaveMapping) {
        setDbStatus('Função de salvar mapeamento indisponível.', 'warning');
        return;
    }

    if (!dbMappingData) {
        setDbStatus('Nenhum mapeamento carregado para salvar.', 'warning');
        return;
    }

    setDbStatus('Salvando mapeamento...', 'info');
    try {
        const response = await window.api.dbSaveMapping({
            connectionId: dbSelectedConnectionId,
            mapping: dbMappingData
        });

        if (!response?.success) {
            throw new Error(response?.error || 'Falha ao salvar mapeamento.');
        }

        setDbStatus('Mapeamento salvo com sucesso.', 'success');
    } catch (error) {
        console.error('Erro ao salvar mapeamento:', error);
        setDbStatus(error.message || 'Erro ao salvar mapeamento.', 'error');
    }
}

function populateDbConnectionsSelect() {
    if (!dbConnectionSelect) return;

    dbConnectionSelect.innerHTML = '<option value="">Nova conexão</option>';
    dbConnectionsCache.forEach((connection) => {
        const option = document.createElement('option');
        option.value = connection.id;

        const activeTag = connection.id === dbActiveConnectionId ? ' [ATIVA]' : '';
        option.textContent = `${connection.name} (${connection.type} @ ${connection.host}:${connection.port})${activeTag}`;
        dbConnectionSelect.appendChild(option);
    });
}

async function refreshDbSettings(keepCurrentSelection = true) {
    const hasApi =
        window.api &&
        typeof window.api.dbGetSupportedTypes === 'function' &&
        typeof window.api.dbListConnections === 'function';

    if (!hasApi) {
        setDbStatus('API de banco não disponível nesta versão.', 'warning');
        return;
    }

    setDbStatus('Carregando conexões...', 'info');

    try {
        const [typesResponse, connectionsResponse] = await Promise.all([
            window.api.dbGetSupportedTypes(),
            window.api.dbListConnections()
        ]);

        if (typesResponse?.success) {
            dbSupportedTypes = Array.isArray(typesResponse.data) ? typesResponse.data : [];
            fillDbTypeOptions(dbSupportedTypes);
        }

        if (!connectionsResponse?.success) {
            throw new Error(connectionsResponse?.error || 'Falha ao carregar conexões.');
        }

        const responseData = connectionsResponse.data || {};
        dbConnectionsCache = Array.isArray(responseData.connections) ? responseData.connections : [];
        dbActiveConnectionId = responseData.activeConnectionId || null;

        populateDbConnectionsSelect();
        renderDbProfilesList();

        if (!keepCurrentSelection) {
            dbSelectedConnectionId = null;
        }

        if (dbSelectedConnectionId && !dbConnectionsCache.some((item) => item.id === dbSelectedConnectionId)) {
            dbSelectedConnectionId = null;
        }

        if (!dbSelectedConnectionId && dbActiveConnectionId) {
            dbSelectedConnectionId = dbActiveConnectionId;
        }

        if (dbConnectionSelect) {
            dbConnectionSelect.value = dbSelectedConnectionId || '';
        }

        if (dbSelectedConnectionId) {
            const selected = dbConnectionsCache.find((item) => item.id === dbSelectedConnectionId);
            applyDbConnectionToForm(selected || null);
            await loadDbMappingTemplate();
            setDbStatus('Conexões carregadas com sucesso.', 'success');
        } else {
            clearDbForm();
            dbMappingDefinition = [];
            dbMappingData = null;
            resetDbMappingFilter();
            renderDbMappingCards();
            if (dbMappingHint) dbMappingHint.textContent = 'Selecione um perfil para editar o mapeamento.';
            dbSchemaTables = [];
            dbSchemaSearchTerm = '';
            if (dbSchemaSearch) dbSchemaSearch.value = '';
            if (dbSchemaSummary) dbSchemaSummary.textContent = 'Schema não carregado.';
            renderDbSchemaCards();
            setDbStatus('Pronto para cadastrar uma nova conexão.', 'info');
        }
    } catch (error) {
        console.error('Erro ao carregar configuração de banco:', error);
        setDbStatus(error.message || 'Erro ao carregar conexões.', 'error');
    }
}

async function handleDbSave() {
    const parsed = buildDbPayloadFromForm();
    if (!parsed.valid) {
        setDbStatus(parsed.error, 'warning');
        return;
    }

    setDbStatus('Salvando conexão...', 'info');
    try {
        const payload = {
            ...parsed.payload,
            id: dbSelectedConnectionId || undefined,
            setActive: Boolean(dbSetActive.checked)
        };
        const response = await window.api.dbUpsertConnection(payload);
        if (!response?.success) {
            throw new Error(response?.error || 'Falha ao salvar conexão.');
        }

        dbSelectedConnectionId = response?.data?.id || dbSelectedConnectionId;
        await refreshDbSettings(true);
        setDbStatus('Conexão salva com sucesso.', 'success');
    } catch (error) {
        console.error('Erro ao salvar conexão:', error);
        setDbStatus(error.message || 'Erro ao salvar conexão.', 'error');
    }
}

async function handleDbTest() {
    const parsed = buildDbPayloadFromForm();
    if (!parsed.valid) {
        setDbStatus(parsed.error, 'warning');
        return;
    }

    setDbStatus('Testando conexão...', 'info');
    try {
        const response = await window.api.dbTestConnection(parsed.payload);
        if (!response?.success) {
            throw new Error(response?.error || 'Falha no teste de conexão.');
        }
        setDbStatus(response?.message || 'Conexão validada com sucesso.', 'success');
    } catch (error) {
        console.error('Erro ao testar conexão:', error);
        setDbStatus(error.message || 'Erro ao testar conexão.', 'error');
    }
}

async function handleDbSetActive() {
    if (!dbSelectedConnectionId) {
        setDbStatus('Selecione uma conexão para definir como ativa.', 'warning');
        return;
    }

    setDbStatus('Atualizando conexão ativa...', 'info');
    try {
        const response = await window.api.dbSetActiveConnection(dbSelectedConnectionId);
        if (!response?.success) {
            throw new Error(response?.error || 'Falha ao ativar conexão.');
        }
        await refreshDbSettings(true);
        setDbStatus('Conexão ativa atualizada.', 'success');
    } catch (error) {
        console.error('Erro ao definir conexão ativa:', error);
        setDbStatus(error.message || 'Erro ao ativar conexão.', 'error');
    }
}

async function handleDbDelete() {
    if (!dbSelectedConnectionId) {
        setDbStatus('Selecione uma conexão para excluir.', 'warning');
        return;
    }

    const selected = dbConnectionsCache.find((item) => item.id === dbSelectedConnectionId);
    const selectedName = selected?.name || 'esta conexão';
    const confirmed = window.confirm(`Deseja realmente excluir ${selectedName}?`);
    if (!confirmed) return;

    setDbStatus('Excluindo conexão...', 'info');
    try {
        const response = await window.api.dbDeleteConnection(dbSelectedConnectionId);
        if (!response?.success) {
            throw new Error(response?.error || 'Falha ao excluir conexão.');
        }
        dbSelectedConnectionId = null;
        await refreshDbSettings(false);
        setDbStatus('Conexão excluída com sucesso.', 'success');
    } catch (error) {
        console.error('Erro ao excluir conexão:', error);
        setDbStatus(error.message || 'Erro ao excluir conexão.', 'error');
    }
}

function initDbSettingsPanel() {
    if (dbSettingsInitialized) return;

    const requiredElements = [
        dbConnectionSelect,
        dbType,
        dbName,
        dbHost,
        dbPort,
        dbDatabase,
        dbUser,
        dbPassword,
        dbApiKey,
        dbSSL,
        dbSetActive,
        dbBtnNew,
        dbBtnRefresh,
        dbBtnTest,
        dbBtnSetActive,
        dbBtnDelete,
        dbBtnSave,
        dbStatus,
        dbBtnSchemaPrev,
        dbBtnSchemaNext
    ];

    if (requiredElements.some((item) => !item)) {
        return;
    }

    if (!window.api) {
        setDbStatus('API de banco indisponível.', 'error');
        return;
    }

    dbConnectionSelect.addEventListener('change', () => {
        dbSelectedConnectionId = dbConnectionSelect.value || null;
        renderDbProfilesList();

        if (!dbSelectedConnectionId) {
            clearDbForm();
            dbMappingDefinition = [];
            dbMappingData = null;
            resetDbMappingFilter();
            renderDbMappingCards();
            if (dbMappingHint) dbMappingHint.textContent = 'Selecione um perfil para editar o mapeamento.';
            dbSchemaTables = [];
            dbSchemaSearchTerm = '';
            dbSchemaPage = 1;
            if (dbSchemaSearch) dbSchemaSearch.value = '';
            renderDbSchemaCards();
            setDbStatus('Pronto para cadastrar uma nova conexão.', 'info');
            return;
        }

        const selected = dbConnectionsCache.find((item) => item.id === dbSelectedConnectionId);
        dbSchemaPage = 1;
        applyDbConnectionToForm(selected || null);
        setDbStatus(`Conexão "${selected?.name || ''}" selecionada.`, 'info');
        loadDbMappingTemplate();
    });

    dbType.addEventListener('change', () => {
        if (!dbPort.value) {
            dbPort.value = getDefaultPortByType(dbType.value);
        }
    });

    dbBtnNew.addEventListener('click', () => {
        dbSelectedConnectionId = null;
        if (dbConnectionSelect) dbConnectionSelect.value = '';
        dbSchemaPage = 1;
        clearDbForm();
        renderDbProfilesList();
        dbMappingDefinition = [];
        dbMappingData = null;
        resetDbMappingFilter();
        renderDbMappingCards();
        if (dbMappingHint) dbMappingHint.textContent = 'Selecione um perfil para editar o mapeamento.';
        dbSchemaTables = [];
        dbSchemaSearchTerm = '';
        if (dbSchemaSearch) dbSchemaSearch.value = '';
        if (dbSchemaSummary) dbSchemaSummary.textContent = 'Schema não carregado.';
        renderDbSchemaCards();
        setDbStatus('Novo cadastro iniciado.', 'info');
    });

    dbBtnRefresh.addEventListener('click', () => {
        refreshDbSettings(true);
    });

    dbBtnTest.addEventListener('click', () => {
        handleDbTest();
    });

    dbBtnSave.addEventListener('click', () => {
        handleDbSave();
    });

    dbBtnSetActive.addEventListener('click', () => {
        handleDbSetActive();
    });

    dbBtnDelete.addEventListener('click', () => {
        handleDbDelete();
    });

    if (dbMappingCards) {
        dbMappingCards.addEventListener('input', (event) => {
            const target = event.target;
            if (!target || !target.matches('input[data-map-path]')) return;
            if (!dbMappingData) return;

            const path = target.getAttribute('data-map-path');
            if (!path) return;
            setValueByPath(dbMappingData, path, target.value.trim());
        });
    }

    if (dbSchemaSearch) {
        dbSchemaSearch.addEventListener('input', () => {
            dbSchemaSearchTerm = dbSchemaSearch.value.trim().toLowerCase();
            dbSchemaPage = 1;
            renderDbSchemaCards();
        });
    }

    if (dbBtnSchemaPrev) {
        dbBtnSchemaPrev.addEventListener('click', () => {
            if (dbSchemaPage > 1) {
                dbSchemaPage -= 1;
                renderDbSchemaCards();
            }
        });
    }

    if (dbBtnSchemaNext) {
        dbBtnSchemaNext.addEventListener('click', () => {
            const filtered = getFilteredSchemaTables();
            const totalPages = Math.ceil(filtered.length / dbSchemaLimit);
            if (dbSchemaPage < totalPages) {
                dbSchemaPage += 1;
                renderDbSchemaCards();
            }
        });
    }

    if (dbMappingSearch) {
        dbMappingSearch.addEventListener('input', () => {
            dbMappingSearchTerm = dbMappingSearch.value.trim().toLowerCase();
            renderDbMappingCards();
        });
    }

    if (dbBtnLoadMapping) {
        dbBtnLoadMapping.addEventListener('click', () => {
            loadDbMappingTemplate();
        });
    }

    if (dbBtnSaveMapping) {
        dbBtnSaveMapping.addEventListener('click', () => {
            saveDbMapping();
        });
    }

    dbSettingsInitialized = true;
    refreshDbSettings(false);
}

initDbSettingsPanel();



// --- Skeleton Helpers ---
function getSkeletonRows(cols, rows = 5) {
    let html = '';
    for (let i = 0; i < rows; i++) {
        html += '<tr>';
        for (let j = 0; j < cols; j++) {
            html += `<td><div class="skeleton skeleton-text" style="width: ${Math.random() * 50 + 40}%"></div></td>`;
        }
        html += '</tr>';
    }
    return html;
}

function showDashboardSkeleton() {
    kpiFaturamento.innerHTML = '<div class="skeleton skeleton-text" style="width: 120px; height: 2rem;"></div>';
    kpiDespesas.innerHTML = '<div class="skeleton skeleton-text" style="width: 120px; height: 2rem;"></div>';
    kpiPercentual.innerHTML = '<div class="skeleton skeleton-text" style="width: 80px; height: 2rem;"></div>';
    if (kpiDespesasBreakdown) kpiDespesasBreakdown.textContent = 'Carregando composição...';
    detailsTableBody.innerHTML = getSkeletonRows(5, 8);
}

// --- Account History Tab Logic ---

function getAccountSourceLabel(source) {
    return source === 'manual' ? 'Manual' : 'ERP';
}

function renderSourceBadge(source) {
    const normalized = source === 'manual' ? 'manual' : 'erp';
    return `<span class="source-badge source-badge-${normalized}">${getAccountSourceLabel(normalized)}</span>`;
}

function getSelectedBranchName() {
    const option = inputFilial.options[inputFilial.selectedIndex];
    return option ? option.textContent : '';
}

async function refreshDashboard() {
    const startDate = inputDataInicial.value;
    const endDate = inputDataFinal.value;
    const branch = inputFilial.value;
    if (!startDate || !endDate) return;

    const response = await window.api.getData({ startDate, endDate, branch });
    if (response.success) {
        updateDashboard(response.data);
    }
}

function closeManualModal() {
    document.querySelector('.manual-modal-backdrop')?.remove();
}

function openManualAccountModal() {
    const wrapper = document.createElement('div');
    wrapper.className = 'manual-modal-backdrop';
    wrapper.innerHTML = `
        <form id="manualAccountForm" class="manual-modal" novalidate>
            <div class="manual-modal-header">
                <div>
                    <span>Plano de contas</span>
                    <h2>Nova conta manual</h2>
                </div>
                <button type="button" class="manual-icon-btn" id="manualAccountClose" aria-label="Fechar">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <label>Nome da conta *
                <input id="manualAccountName" required placeholder="Funcionários sem carteira">
            </label>
            <div class="manual-form-grid">
                <label>Código interno
                    <input id="manualAccountCode" placeholder="Gerado automaticamente">
                </label>
                <label>Categoria
                    <input id="manualAccountCategory" placeholder="Folha, Operacional...">
                </label>
            </div>
            <label>Observação
                <textarea id="manualAccountObservation" rows="3" placeholder="Observações internas"></textarea>
            </label>
            <p id="manualAccountError" class="manual-form-error"></p>
            <div class="manual-modal-actions">
                <button type="button" class="manual-secondary-btn" id="manualAccountCancel">Cancelar</button>
                <button type="submit" class="manual-primary-btn">Salvar conta</button>
            </div>
        </form>
    `;
    document.body.appendChild(wrapper);

    document.getElementById('manualAccountClose')?.addEventListener('click', closeManualModal);
    document.getElementById('manualAccountCancel')?.addEventListener('click', closeManualModal);
    wrapper.addEventListener('click', (event) => {
        if (event.target === wrapper) closeManualModal();
    });

    document.getElementById('manualAccountForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const errorEl = document.getElementById('manualAccountError');
        const payload = {
            name: document.getElementById('manualAccountName')?.value,
            code: document.getElementById('manualAccountCode')?.value,
            category: document.getElementById('manualAccountCategory')?.value,
            observation: document.getElementById('manualAccountObservation')?.value
        };

        const result = await window.api.createManualAccount(payload);
        if (!result.success) {
            if (errorEl) errorEl.textContent = result.error || 'Erro ao salvar conta manual.';
            return;
        }

        closeManualModal();
        await refreshDashboard();
    });

    document.getElementById('manualAccountName')?.focus();
}

function openManualExpenseModal(account) {
    const source = account.account_source === 'manual' ? 'manual' : 'erp';
    const wrapper = document.createElement('div');
    wrapper.className = 'manual-modal-backdrop';
    wrapper.innerHTML = `
        <form id="manualExpenseForm" class="manual-modal manual-expense-modal" novalidate>
            <div class="manual-modal-header">
                <div>
                    <span>Despesa indireta</span>
                    <h2>Adicionar despesa</h2>
                </div>
                <button type="button" class="manual-icon-btn" id="manualExpenseClose" aria-label="Fechar">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <label>Conta
                <input value="${escapeHtml(account.conta)}" disabled>
            </label>
            <div class="manual-form-grid">
                <label>Data *
                    <input id="manualExpenseDate" type="date" required value="${escapeHtml(inputDataFinal.value || formatDateInput(new Date()))}">
                </label>
                <label>Filial *
                    <select id="manualExpenseBranch" required>
                        ${Array.from(inputFilial.options).filter((option) => option.value).map((option) => `
                            <option value="${escapeHtml(option.value)}"${option.value === inputFilial.value ? ' selected' : ''}>${escapeHtml(option.textContent)}</option>
                        `).join('')}
                    </select>
                </label>
            </div>
            <div class="manual-form-grid">
                <label>Valor *
                    <input id="manualExpenseAmount" inputmode="decimal" required placeholder="0,00">
                </label>
                <label>Documento
                    <input id="manualExpenseDocument" placeholder="REC-001">
                </label>
            </div>
            <label>Fornecedor / funcionário / entidade
                <input id="manualExpenseEntity" placeholder="João Prestador">
            </label>
            <label>Histórico *
                <input id="manualExpenseHistory" required placeholder="Pagamento semanal">
            </label>
            <label>Observação
                <textarea id="manualExpenseObservation" rows="3" placeholder="Detalhes adicionais"></textarea>
            </label>
            <p id="manualExpenseError" class="manual-form-error"></p>
            <div class="manual-modal-actions">
                <button type="button" class="manual-secondary-btn" id="manualExpenseCancel">Cancelar</button>
                <button type="submit" class="manual-primary-btn">Salvar despesa</button>
            </div>
        </form>
    `;
    document.body.appendChild(wrapper);

    const close = () => closeManualModal();
    document.getElementById('manualExpenseClose')?.addEventListener('click', close);
    document.getElementById('manualExpenseCancel')?.addEventListener('click', close);
    wrapper.addEventListener('click', (event) => {
        if (event.target === wrapper) close();
    });

    document.getElementById('manualExpenseForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const branchSelect = document.getElementById('manualExpenseBranch');
        const payload = {
            accountId: String(account.id_conta),
            accountSource: source,
            accountName: account.conta,
            date: document.getElementById('manualExpenseDate')?.value,
            branchId: branchSelect?.value,
            branchName: branchSelect?.options[branchSelect.selectedIndex]?.textContent || '',
            amount: document.getElementById('manualExpenseAmount')?.value,
            document: document.getElementById('manualExpenseDocument')?.value,
            entity: document.getElementById('manualExpenseEntity')?.value,
            history: document.getElementById('manualExpenseHistory')?.value,
            observation: document.getElementById('manualExpenseObservation')?.value
        };

        const result = await window.api.createManualExpense(payload);
        if (!result.success) {
            const errorEl = document.getElementById('manualExpenseError');
            if (errorEl) errorEl.textContent = result.error || 'Erro ao salvar despesa manual.';
            return;
        }

        close();
        await refreshDashboard();
        await loadAccountHistory(account.id_conta);
    });

    document.getElementById('manualExpenseAmount')?.focus();
}

async function openAccountHistoryTab(accountId, accountName, accountSource = 'erp') {
    const tabId = `account-${accountId}`;
    const account = {
        id_conta: accountId,
        conta: accountName,
        account_source: accountSource
    };
    const formatDateDisplay = (isoStr) => {
        if (!isoStr) return '';
        const [y, m, d] = isoStr.split('-');
        return `${d}/${m}/${y}`;
    };
    const contentBuilder = () => `
        <div class="legacy-container">
            <header>
                <h1>Histórico: ${escapeHtml(accountName)} ${renderSourceBadge(accountSource)}</h1>
                <div class="filters">
                    <p style="color: var(--secondary-text)">Periodo: ${formatDateDisplay(inputDataInicial.value)} a ${formatDateDisplay(inputDataFinal.value)}</p>
                    <button type="button" class="manual-primary-btn" id="add-expense-${accountId}">
                        <span class="material-symbols-outlined text-[18px]">add</span>
                        Adicionar Despesa
                    </button>
                </div>
            </header>
            <div class="data-table-section">
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr><th>Data</th><th>Origem</th><th>Histórico</th><th>Documento</th><th>Forn./Cliente</th><th class="text-right">Valor (R$)</th></tr>
                        </thead>
                        <tbody id="history-tbody-${accountId}">${getSkeletonRows(6, 6)}</tbody>
                        <tfoot>
                            <tr>
                                <th colspan="5" style="text-align:right">Total do Período:</th>
                                <th class="text-right" id="history-total-${accountId}"><div class="skeleton skeleton-text" style="width: 80px; display:inline-block"></div></th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    `;
    openTab(tabId, accountName, contentBuilder);
    document.getElementById(`add-expense-${accountId}`)?.addEventListener('click', () => openManualExpenseModal(account));

    await loadAccountHistory(accountId);
}

async function loadAccountHistory(accountId) {
    const startDate = inputDataInicial.value;
    const endDate = inputDataFinal.value;
    const branch = inputFilial.value;

    try {
        const response = await window.api.getAccountHistory({ startDate, endDate, branch, accountId });
        const tbody = document.getElementById(`history-tbody-${accountId}`);
        const totalFooter = document.getElementById(`history-total-${accountId}`);
        if (response.success) {
            if (!response.data || response.data.length === 0) {
                if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Nenhum lançamento encontrado.</td></tr>';
                if (totalFooter) totalFooter.textContent = formatCurrency(0);
                return;
            }
            if (tbody) tbody.innerHTML = '';
            let total = 0;
            response.data.forEach(item => {
                const val = parseFloat(item.valor); total += val;
                const origin = item.origem === 'Manual' ? 'manual' : 'erp';
                const displayDate = typeof item.datahora === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.datahora)
                    ? formatDateDisplay(item.datahora)
                    : new Date(item.datahora).toLocaleDateString('pt-BR');
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${displayDate}</td>
                    <td>${renderSourceBadge(origin)}</td>
                    <td>${escapeHtml(item.historico || '-')}</td>
                    <td>${escapeHtml(item.documento || '-')}</td>
                    <td>${escapeHtml(item.forn_cliente || '-')}</td>
                    <td class="text-right">${formatCurrency(val)}</td>
                `;
                if (tbody) tbody.appendChild(tr);
            });
            if (totalFooter) totalFooter.textContent = formatCurrency(total);
        } else {
            if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="color: red; text-align:center">Erro: ${escapeHtml(response.error)}</td></tr>`;
        }
    } catch (err) {
        console.error(err);
        const tbody = document.getElementById(`history-tbody-${accountId}`);
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="color: red; text-align:center">Erro de comunicação.</td></tr>';
    }
}

// --- Main Dashboard Logic ---
const today = new Date();
const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
inputDataInicial.value = formatDateInput(firstDay);
inputDataFinal.value = formatDateInput(today);

async function loadBranches() {
    try {
        const response = await window.api.getBranches();
        if (response.success) {
            const select = inputFilial;
            response.data.forEach(branch => {
                const option = document.createElement('option');
                option.value = branch.value; option.textContent = branch.label;
                select.appendChild(option);
            });

            if (currentAiMode === 'apresentacao' && presentationState.stage === 'filters') {
                renderPresentationFilterStep();
            }
        }
    } catch (err) { console.error('Error loading branches:', err); }
}
loadBranches();

stockDateStart.value = formatDateInput(firstDay);
stockDateEnd.value = formatDateInput(today);

function populateStockBranchOptions(branches) {
    if (!stockBranch) return;

    const existing = new Set(Array.from(stockBranch.options).map((option) => option.value));
    branches.forEach((branch) => {
        if (existing.has(branch.value)) return;
        const option = document.createElement('option');
        option.value = branch.value;
        option.textContent = branch.label;
        stockBranch.appendChild(option);
    });
}

function setStockMetaNotice(text, tone = 'info') {
    if (!stockMetaNotice) return;
    stockMetaNotice.textContent = text;
    stockMetaNotice.dataset.tone = tone;
}

function resetStockTable(message = 'Nenhum dado disponível.') {
    if (stockTableBody) {
        stockTableBody.innerHTML = `<tr><td colspan="12" style="text-align:center; color:#64748b;">${escapeHtml(message)}</td></tr>`;
    }
    if (stockTableCount) stockTableCount.textContent = '0 produtos';
    updateStockPagination(0);
}

function getStockMiniSkeleton(items = 5) {
    return Array.from({ length: items }, () => `
        <div class="stock-mini-item">
            <div>
                <div class="skeleton skeleton-text" style="width: 220px; height: 0.95rem;"></div>
            </div>
            <div class="skeleton skeleton-text" style="width: 64px; height: 0.95rem;"></div>
        </div>
    `).join('');
}

function getStockTableSkeletonRows(rows = 8) {
    return Array.from({ length: rows }, () => `
        <tr>
            <td class="py-3 px-2 stock-col-product">
                <div class="stock-product-cell">
                    <div class="skeleton skeleton-text" style="width: 78%; height: 1rem;"></div>
                    <div class="skeleton skeleton-text" style="width: 62%; height: 0.82rem;"></div>
                </div>
            </td>
            <td class="py-3 px-2 stock-col-supplier">
                <div class="skeleton skeleton-text" style="width: 88%; height: 1rem;"></div>
                <div class="skeleton skeleton-text" style="width: 56%; height: 1rem; margin-top: 6px;"></div>
            </td>
            <td class="py-3 px-2 text-right"><div class="skeleton skeleton-text" style="width: 64px; height: 1rem; margin-left: auto;"></div></td>
            <td class="py-3 px-2 text-right"><div class="skeleton skeleton-text" style="width: 64px; height: 1rem; margin-left: auto;"></div></td>
            <td class="py-3 px-2 text-right"><div class="skeleton skeleton-text" style="width: 70px; height: 1rem; margin-left: auto;"></div></td>
            <td class="py-3 px-2 text-right"><div class="skeleton skeleton-text" style="width: 70px; height: 1rem; margin-left: auto;"></div></td>
            <td class="py-3 px-2 text-right"><div class="skeleton skeleton-text" style="width: 84px; height: 1rem; margin-left: auto;"></div></td>
            <td class="py-3 px-2 text-right"><div class="skeleton skeleton-text" style="width: 84px; height: 1rem; margin-left: auto;"></div></td>
            <td class="py-3 px-2 text-right"><div class="skeleton skeleton-text" style="width: 56px; height: 1rem; margin-left: auto;"></div></td>
            <td class="py-3 px-2 text-right"><div class="skeleton skeleton-text" style="width: 42px; height: 1rem; margin-left: auto;"></div></td>
            <td class="py-3 px-2"><div class="skeleton skeleton-text" style="width: 96px; height: 1rem;"></div></td>
            <td class="py-3 px-2"><div class="skeleton skeleton-text" style="width: 92px; height: 2rem; border-radius: 999px;"></div></td>
        </tr>
    `).join('');
}

function showStockSkeleton() {
    const stockKpiTargets = [
        stockKpiProducts,
        stockKpiQuantity,
        stockKpiCost,
        stockKpiSale,
        stockKpiMargin,
        stockKpiOut,
        stockKpiHigh,
        stockKpiMode
    ];

    stockKpiTargets.forEach((target, index) => {
        if (!target) return;
        const width = index >= 2 && index <= 4 ? '110px' : '72px';
        target.innerHTML = `<div class="skeleton skeleton-text" style="width: ${width}; height: 2rem; margin: 0 auto 0 0;"></div>`;
    });

    if (stockTopValue) stockTopValue.innerHTML = getStockMiniSkeleton(5);
    if (stockTopMargin) stockTopMargin.innerHTML = getStockMiniSkeleton(5);
    if (stockTopSupplier) stockTopSupplier.innerHTML = getStockMiniSkeleton(5);
    if (stockTopGroup) stockTopGroup.innerHTML = getStockMiniSkeleton(5);

    if (stockTableBody) {
        stockTableBody.innerHTML = getStockTableSkeletonRows(8);
    }

    if (stockTableCount) {
        stockTableCount.innerHTML = '<div class="skeleton skeleton-text" style="width: 96px; height: 1rem; display:inline-block;"></div>';
    }

    currentStockPage = 1;
    if (stockPaginationInfo) {
        stockPaginationInfo.innerHTML = '<div class="skeleton skeleton-text" style="width: 88px; height: 0.95rem; display:inline-block;"></div>';
    }
    if (stockPrevPage) stockPrevPage.disabled = true;
    if (stockNextPage) stockNextPage.disabled = true;
}

function populateSelectOptions(select, options, defaultLabel) {
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = `<option value="">${defaultLabel}</option>`;

    options.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.value;
        option.textContent = item.label;
        select.appendChild(option);
    });

    if (currentValue && options.some((item) => item.value === currentValue)) {
        select.value = currentValue;
    }
}

function resolveStockOptionValue(options, typedValue) {
    const term = String(typedValue || '').trim().toLowerCase();
    if (!term) return '';

    const exactMatch = options.find((item) => String(item.label || '').trim().toLowerCase() === term);
    if (exactMatch) return exactMatch.value;

    const matches = options.filter((item) => String(item.label || '').toLowerCase().includes(term));
    return matches.length === 1 ? matches[0].value : '';
}

function getStockAutocompleteMatches(options, typedValue) {
    const term = String(typedValue || '').trim().toLowerCase();
    const matches = term
        ? options.filter((item) => String(item.label || '').toLowerCase().includes(term))
        : options;

    return matches.slice(0, STOCK_AUTOCOMPLETE_LIMIT);
}

function hideStockAutocomplete(menu) {
    if (!menu) return;
    menu.hidden = true;
}

function renderStockAutocomplete(input, menu, options) {
    if (!input || !menu) return;

    const matches = getStockAutocompleteMatches(options, input.value);
    if (!matches.length) {
        menu.innerHTML = '<div class="stock-autocomplete-empty">Nenhum resultado encontrado.</div>';
        menu.hidden = false;
        return;
    }

    menu.innerHTML = matches.map((item) => `
        <button type="button" class="stock-autocomplete-option"
            data-value="${escapeHtml(item.value)}"
            data-label="${escapeHtml(item.label)}">
            ${escapeHtml(item.label)}
        </button>
    `).join('');
    menu.hidden = false;
}

function attachStockAutocomplete(input, menu, getOptions) {
    if (!input || !menu) return;

    const render = () => renderStockAutocomplete(input, menu, getOptions());

    input.addEventListener('focus', render);
    input.addEventListener('input', render);
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            hideStockAutocomplete(menu);
        }
    });

    menu.addEventListener('mousedown', (event) => {
        event.preventDefault();
    });

    menu.addEventListener('click', (event) => {
        const option = event.target.closest('.stock-autocomplete-option');
        if (!option) return;
        input.value = option.dataset.label || '';
        hideStockAutocomplete(menu);
    });
}

function renderStockMiniList(container, items, formatter, emptyText = 'Sem dados.') {
    if (!container) return;

    if (!items?.length) {
        container.innerHTML = `<div class="stock-empty">${escapeHtml(emptyText)}</div>`;
        return;
    }

    container.innerHTML = items.map((item) => `
        <div class="stock-mini-item">
            <div>
                <strong>${escapeHtml(item.label || '-')}</strong>
            </div>
            <span>${formatter(item.value)}</span>
        </div>
    `).join('');
}

function updateStockPagination(totalRows) {
    const totalPages = Math.max(1, Math.ceil(totalRows / STOCK_PAGE_SIZE));

    if (currentStockPage > totalPages) {
        currentStockPage = totalPages;
    }

    if (stockPaginationInfo) {
        stockPaginationInfo.textContent = `Página ${currentStockPage} de ${totalPages}`;
    }

    if (stockPrevPage) {
        stockPrevPage.disabled = currentStockPage <= 1 || totalRows === 0;
    }

    if (stockNextPage) {
        stockNextPage.disabled = currentStockPage >= totalPages || totalRows === 0;
    }
}

function renderStockRows(rows) {
    if (!stockTableBody) return;

    if (!rows?.length) {
        resetStockTable('Nenhum produto encontrado para os filtros informados.');
        return;
    }

    const totalRows = rows.length;
    const startIndex = (currentStockPage - 1) * STOCK_PAGE_SIZE;
    const paginatedRows = rows.slice(startIndex, startIndex + STOCK_PAGE_SIZE);

    stockTableBody.innerHTML = paginatedRows.map((row) => `
        <tr class="stock-row-clickable" data-product-id="${row.productId ?? ''}" data-product-name="${escapeHtml(row.productName || '')}">
            <td class="py-3 px-2 stock-col-product">
                <div class="stock-product-cell">
                    <strong>${escapeHtml(row.productName || '-')}</strong>
                    <small>${escapeHtml(row.productCode || '-')} | EAN: ${escapeHtml(row.barcode || '-')} | ${escapeHtml(row.groupName || 'Sem grupo')}</small>
                </div>
            </td>
            <td class="py-3 px-2 stock-col-supplier">${escapeHtml(row.supplierName || '-')}</td>
            <td class="py-3 px-2 text-right">${row.purchasedQty == null ? '---' : formatQuantity(row.purchasedQty)}</td>
            <td class="py-3 px-2 text-right">${row.soldQty == null ? '---' : formatQuantity(row.soldQty)}</td>
            <td class="py-3 px-2 text-right">${formatQuantity(row.balanceQty)}</td>
            <td class="py-3 px-2 text-right">${formatQuantity(row.stockQty)}</td>
            <td class="py-3 px-2 text-right">${formatCurrency(row.avgCost)}</td>
            <td class="py-3 px-2 text-right">${formatCurrency(row.avgSale)}</td>
            <td class="py-3 px-2 text-right">${formatPercent(row.marginPct)}</td>
            <td class="py-3 px-2 text-right">${row.turnover == null ? '---' : formatQuantity(row.turnover)}</td>
            <td class="py-3 px-2">${escapeHtml(row.lastStockChange || '---')}</td>
            <td class="py-3 px-2"><span class="stock-status-badge">${escapeHtml(row.status || '-')}</span></td>
        </tr>
    `).join('');

    stockTableCount.textContent = `${totalRows} produtos`;
    updateStockPagination(totalRows);
    stockTableBody.querySelectorAll('tr[data-product-id]').forEach((rowEl) => {
        rowEl.addEventListener('click', () => {
            const productId = rowEl.dataset.productId;
            if (!productId) return;
            openStockDrillDownModal(productId, rowEl.dataset.productName || 'Produto');
        });
    });
}

function updateStockSummary(summary) {
    stockKpiProducts.textContent = formatQuantity(summary.totalProducts || 0);
    stockKpiQuantity.textContent = formatQuantity(summary.estoqueAtual || 0);
    stockKpiCost.textContent = formatCurrency(summary.totalComprado || 0);
    stockKpiSale.textContent = formatCurrency(summary.totalVendido || 0);
    stockKpiMargin.textContent = formatPercent(summary.margemPercentual || 0);
    stockKpiOut.textContent = formatQuantity(summary.produtosSemGiro || 0);
    stockKpiHigh.textContent = formatQuantity(summary.maiorGiro || 0);
    stockKpiMode.textContent = summary.partialAnalytics ? 'Parcial' : 'Completo';
}

function updateStockDashboard(data) {
    currentStockIntelligenceData = data;
    currentStockPage = 1;
    updateStockSummary(data.summary || {});
    renderStockRows(data.rows || []);
    populateSelectOptions(stockBranch, data.filterOptions?.branches || [], 'Todas as filiais');
    currentStockSupplierOptions = data.filterOptions?.suppliers || [];
    currentStockGroupOptions = data.filterOptions?.groups || [];
    populateSelectOptions(stockStatus, data.filterOptions?.statuses || [], 'Todos os status');
    renderStockMiniList(stockTopValue, data.charts?.topStockValue || [], formatCurrency);
    renderStockMiniList(stockTopMargin, data.charts?.topMargin || [], formatPercent, data.meta?.topMarginEmptyReason || 'Sem dados.');
    renderStockMiniList(stockTopSupplier, (data.charts?.supplierRanking || []).slice(0, 5), formatCurrency);
    renderStockMiniList(stockTopGroup, (data.charts?.groupRanking || []).slice(0, 5), formatCurrency);

    const limitations = data.meta?.limitations || [];
    setStockMetaNotice(limitations[0] || 'Análise carregada com sucesso.', limitations.length ? 'warning' : 'info');
}

async function loadStockIntelligence() {
    if (!window.api?.getStockIntelligence) {
        setStockMetaNotice('API do módulo de estoque não está disponível no preload.', 'error');
        resetStockTable('API indisponível.');
        return;
    }

    setStockMetaNotice('Carregando análise de estoque...', 'info');
    showStockSkeleton();

    try {
        const response = await window.api.getStockIntelligence({
            startDate: stockDateStart?.value || '',
            endDate: stockDateEnd?.value || '',
            branch: stockBranch?.value || '',
            supplierId: resolveStockOptionValue(currentStockSupplierOptions, stockSupplier?.value),
            groupId: resolveStockOptionValue(currentStockGroupOptions, stockGroup?.value),
            supplierTerm: stockSupplier?.value || '',
            groupTerm: stockGroup?.value || '',
            status: stockStatus?.value || ''
        });

        if (!response?.success) {
            throw new Error(response?.error || 'Falha ao carregar módulo de estoque.');
        }

        updateStockDashboard(response.data);
    } catch (error) {
        console.error('Erro ao carregar Estoque Inteligente:', error);
        setStockMetaNotice(`Erro ao carregar análise: ${error.message}`, 'error');
        resetStockTable('Erro ao carregar dados do módulo.');
    }
}

async function loadStockFilterOptions() {
    if (!window.api?.getStockFilterOptions) return;

    try {
        const response = await window.api.getStockFilterOptions();
        if (!response?.success) {
            throw new Error(response?.error || 'Falha ao carregar opções de filtro.');
        }

        const options = response.data || {};
        populateSelectOptions(stockBranch, options.branches || [], 'Todas as filiais');
        currentStockSupplierOptions = options.suppliers || [];
        currentStockGroupOptions = options.groups || [];
        populateSelectOptions(stockStatus, options.statuses || [], 'Todos os status');
        setStockMetaNotice('Preencha os filtros e clique em Atualizar análise.', 'info');
    } catch (error) {
        console.error('Erro ao carregar opções do Estoque Inteligente:', error);
        setStockMetaNotice(`Erro ao carregar opções de filtro: ${error.message}`, 'error');
    }
}

async function openStockDrillDownModal(productId, productName) {
    if (!window.api?.getStockDrillDown) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'manual-modal-backdrop';
    wrapper.innerHTML = `
        <div class="manual-modal manual-expense-modal">
            <div class="manual-modal-header">
                <div>
                    <span>Movimentações reais</span>
                    <h2>${escapeHtml(productName)}</h2>
                </div>
                <button type="button" class="manual-icon-btn" id="stockDrillClose" aria-label="Fechar">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="data-table-section">
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Tipo</th>
                                <th class="text-right">Entrada</th>
                                <th class="text-right">Saída</th>
                                <th class="text-right">Custo Total</th>
                                <th class="text-right">Valor Total</th>
                                <th>Observação</th>
                            </tr>
                        </thead>
                        <tbody id="stockDrillBody">${getSkeletonRows(6, 7)}</tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(wrapper);

    const close = () => closeManualModal();
    document.getElementById('stockDrillClose')?.addEventListener('click', close);
    wrapper.addEventListener('click', (event) => {
        if (event.target === wrapper) close();
    });

    try {
        const response = await window.api.getStockDrillDown(productId, {
            startDate: stockDateStart?.value || '',
            endDate: stockDateEnd?.value || '',
            branch: stockBranch?.value || ''
        });
        const tbody = document.getElementById('stockDrillBody');
        if (!tbody) return;

        if (!response?.success) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">${escapeHtml(response?.error || 'Erro ao carregar drill-down.')}</td></tr>`;
            return;
        }

        if (!response.data?.length) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#64748b;">Nenhuma movimentação encontrada.</td></tr>';
            return;
        }

        tbody.innerHTML = response.data.map((row) => `
            <tr>
                <td>${escapeHtml(row.date || '-')}</td>
                <td>${escapeHtml(String(row.documentType ?? '-'))}</td>
                <td class="text-right">${formatQuantity(row.qtyIn)}</td>
                <td class="text-right">${formatQuantity(row.qtyOut)}</td>
                <td class="text-right">${formatCurrency(row.costTotal)}</td>
                <td class="text-right">${formatCurrency(row.saleTotal)}</td>
                <td>${escapeHtml(row.observation || '-')}</td>
            </tr>
        `).join('');
    } catch (error) {
        const tbody = document.getElementById('stockDrillBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">${escapeHtml(error.message || 'Erro ao carregar drill-down.')}</td></tr>`;
        }
    }
}

function initTilt() {
    if (typeof VanillaTilt !== 'undefined') {
        VanillaTilt.init(document.querySelectorAll(".card, .chart-wrapper"), {
            max: 5, speed: 400, glare: true, "max-glare": 0.2, scale: 1.02, perspective: 1000
        });
    }
}
initTilt();

btnFiltrar.addEventListener('click', async () => {
    const startDate = inputDataInicial.value;
    const endDate = inputDataFinal.value;
    const branch = inputFilial.value;
    if (!startDate || !endDate) { alert('Por favor, selecione as datas inicial e final.'); return; }
    showDashboardSkeleton();
    try {
        const response = await window.api.getData({ startDate, endDate, branch });
        if (response.success) { updateDashboard(response.data); }
        else { alert('Erro ao carregar dados: ' + response.error); }
    } catch (err) { alert('Erro de comunicação.'); }
});

btnManualAccount?.addEventListener('click', openManualAccountModal);
btnStockRefresh?.addEventListener('click', loadStockIntelligence);
attachStockAutocomplete(stockSupplier, stockSupplierOptions, () => currentStockSupplierOptions);
attachStockAutocomplete(stockGroup, stockGroupOptions, () => currentStockGroupOptions);
document.addEventListener('click', (event) => {
    if (!stockSupplier?.closest('.stock-autocomplete')?.contains(event.target)) {
        hideStockAutocomplete(stockSupplierOptions);
    }
    if (!stockGroup?.closest('.stock-autocomplete')?.contains(event.target)) {
        hideStockAutocomplete(stockGroupOptions);
    }
});
stockPrevPage?.addEventListener('click', () => {
    if (currentStockPage <= 1) return;
    currentStockPage -= 1;
    renderStockRows(currentStockIntelligenceData?.rows || []);
});
stockNextPage?.addEventListener('click', () => {
    const totalRows = currentStockIntelligenceData?.rows?.length || 0;
    const totalPages = Math.max(1, Math.ceil(totalRows / STOCK_PAGE_SIZE));
    if (currentStockPage >= totalPages) return;
    currentStockPage += 1;
    renderStockRows(currentStockIntelligenceData?.rows || []);
});

loadStockFilterOptions();

function updateDashboard(data) {
    currentDashboardData = data;
    updateKPIs(data.main);
    updateMonthlyChart(data.monthly);
    updateTop10Chart(data.top10);
    currentDetailsRows = Array.isArray(data.main) ? data.main : [];
    renderFilteredDetailsTable();
}

function updateKPIs(mainData) {
    if (!mainData || mainData.length === 0) {
        kpiFaturamento.textContent = formatCurrency(0);
        kpiDespesas.textContent = formatCurrency(0);
        kpiPercentual.textContent = formatPercent(0);
        if (kpiDespesasBreakdown) kpiDespesasBreakdown.textContent = 'ERP: R$ 0,00 | Manual: R$ 0,00';
        return;
    }
    const firstRow = mainData[0];
    const totalFat = parseFloat(firstRow.total_faturamento || 0);
    const totalDesp = parseFloat(firstRow.total_despesas || 0);
    const percent = totalFat ? (totalDesp / totalFat) * 100 : 0;
    kpiFaturamento.textContent = formatCurrency(totalFat);
    kpiDespesas.textContent = formatCurrency(totalDesp);
    kpiPercentual.textContent = formatPercent(percent);
    if (kpiDespesasBreakdown) {
        const totals = currentDashboardData?.totals || {};
        kpiDespesasBreakdown.textContent = `ERP: ${formatCurrency(totals.erpExpense || 0)} | Manual: ${formatCurrency(totals.manualExpense || 0)}`;
    }
}

function calculateLinearRegression(yList) {
    const n = yList.length;
    if (n === 0) return { slope: 0, intercept: 0 };
    if (n === 1) return { slope: 0, intercept: yList[0] };
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
        let x = i + 1; sumX += x; sumY += yList[i]; sumXY += x * yList[i]; sumXX += x * x;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
}

function updateMonthlyChart(monthlyData) {
    const ctx = document.getElementById('monthlyChart').getContext('2d');
    if (monthlyChartInstance) {
        monthlyChartInstance.destroy();
    }
    let labels = monthlyData.map(d => `${String(d.mes).padStart(2, '0')}/${d.ano}`);
    let dataDespesas = monthlyData.map(d => parseFloat(d.total_despesa_mes));
    let dataFaturamento = monthlyData.map(d => parseFloat(d.total_faturamento_mes));

    /* 
    // Funcionalidade de Previsão desativada para conclusão futura
    const FORECAST_MONTHS = 3;
    const n = dataDespesas.length;
    let trendDespesas = []; let trendFaturamento = [];
    if (n > 0) {
        const today = new Date();
        const curM = today.getMonth() + 1;
        const curY = today.getFullYear();
        const lastM = monthlyData[n - 1].mes;
        const lastY = monthlyData[n - 1].ano;
        const isPartialMonth = (lastM === curM && lastY === curY);
        const regD = (isPartialMonth && n > 1) ? dataDespesas.slice(0, -1) : dataDespesas;
        const regF = (isPartialMonth && n > 1) ? dataFaturamento.slice(0, -1) : dataFaturamento;
        const lrD = calculateLinearRegression(regD);
        const lrF = calculateLinearRegression(regF);
        let lLabel = labels[n - 1] || "01/2023";
        let [lM, lY] = lLabel.split('/').map(Number);
        for (let i = 1; i <= n + FORECAST_MONTHS; i++) {
            trendDespesas.push(Math.max(0, lrD.slope * i + lrD.intercept)); 
            trendFaturamento.push(Math.max(0, lrF.slope * i + lrF.intercept));
        }
        for (let i = 1; i <= FORECAST_MONTHS; i++) {
            lM++; if (lM > 12) { lM = 1; lY++; }
            labels.push(`${String(lM).padStart(2, '0')}/${lY}`);
            dataDespesas.push(null); dataFaturamento.push(null);
        }
    }
    */

    monthlyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Despesas',
                    data: dataDespesas,
                    backgroundColor: 'rgba(239, 68, 68, 0.7)',
                    borderColor: '#ef4444',
                    borderWidth: 1,
                    borderRadius: 8,
                    barPercentage: 0.6
                },
                {
                    label: 'Faturamento',
                    data: dataFaturamento,
                    backgroundColor: 'rgba(154, 203, 74, 0.7)',
                    borderColor: '#9acb4a',
                    borderWidth: 1,
                    borderRadius: 8,
                    barPercentage: 0.6
                }
            ]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: { color: '#334155' },
                    border: { display: false }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#334155' },
                    border: { display: false }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#0f172a', font: { family: 'Inter' } }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) { label += ': '; }
                            if (context.raw !== null && context.raw !== undefined) { 
                                label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.raw); 
                            }
                            return label;
                        }
                    },
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#0f172a',
                    bodyColor: '#334155',
                    borderColor: 'rgba(27, 150, 216, 0.2)',
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: true
                }
            },
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function updateTop10Chart(top10Data) {
    const ctx = document.getElementById('top10Chart').getContext('2d');
    if (top10ChartInstance) {
        top10ChartInstance.destroy();
    }
    const labels = top10Data.map(d => d.conta);
    const values = top10Data.map(d => parseFloat(d.total_despesa));

    top10ChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    '#ef4444', '#74B9D9', '#9ACB4A', '#C3DE96', '#CFEAE5',
                    '#166ca3', '#7db828', '#5da9cc', '#a6c95d', '#0f172a'
                ],
                borderWidth: 1,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#334155', font: { family: 'Inter', size: 11 }, boxWidth: 12 }
                }
            }
        }
    });
}

function getFilteredDetailsRows() {
    const searchTerm = (detailsSearchInput?.value || '').trim().toLowerCase();
    const sourceFilter = detailsSourceFilter?.value || '';

    return currentDetailsRows.filter((row) => {
        const matchesSearch = !searchTerm || String(row.conta || '').toLowerCase().includes(searchTerm);
        const matchesSource = !sourceFilter || String(row.account_source || 'erp') === sourceFilter;
        return matchesSearch && matchesSource;
    });
}

function updateDetailsCount(count) {
    if (!detailsTableCount) return;
    detailsTableCount.textContent = `${count} ${count === 1 ? 'conta' : 'contas'}`;
}

function renderFilteredDetailsTable() {
    const mainData = getFilteredDetailsRows();
    detailsTableBody.innerHTML = '';

    if (!mainData.length) {
        detailsTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center">Nenhuma conta encontrada para os filtros selecionados.</td></tr>';
        updateDetailsCount(0);
        return;
    }

    mainData.forEach(row => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.title = 'Clique duas vezes para abrir em nova aba';
        tr.ondblclick = () => openAccountHistoryTab(row.id_conta, row.conta, row.account_source || 'erp');
        const valorDespesa = parseFloat(row.total_despesa);
        const percSobreDesp = parseFloat(row.perc_sobre_desp_total);
        const percSobreFat = parseFloat(row.perc_sobre_faturamento);
        tr.innerHTML = `
            <td>${escapeHtml(row.conta)}</td>
            <td>${renderSourceBadge(row.account_source || 'erp')}</td>
            <td class="text-right">${formatCurrency(valorDespesa)}</td>
            <td class="text-right">${formatPercent(percSobreDesp)}</td>
            <td class="text-right">${formatPercent(percSobreFat)}</td>
        `;
        detailsTableBody.appendChild(tr);
    });
    updateDetailsCount(mainData.length);
}

detailsSearchInput?.addEventListener('input', renderFilteredDetailsTable);
detailsSourceFilter?.addEventListener('change', renderFilteredDetailsTable);


// --- AI Chat Logic ---

const aiInput = document.getElementById('aiInput');
const chatHistory = document.getElementById('chatHistory');
const aiChatHistoryList = document.getElementById('aiChatHistoryList');
const aiStatusBadge = document.getElementById('aiStatusBadge');
const btnSend = document.getElementById('btnSend');
const aiChatView = document.getElementById('aiChatView');
const aiInputDock = document.getElementById('aiInputDock');
const presentationView = document.getElementById('presentationView');
const slidesContainer = document.getElementById('slidesContainer');
const modeConversationBtn = document.getElementById('mode-conversa');
const modePresentationBtn = document.getElementById('mode-apresentacao');
let isSendingAI = false;

let aiChatHistory = JSON.parse(localStorage.getItem('aiChatHistory') || '[]');

function getPresentationUiSnapshot() {
    const aiTab = document.getElementById('tab-ai');
    const activeTab = document.querySelector('.tab.active');
    const presentationStyle = presentationView ? window.getComputedStyle(presentationView) : null;
    const aiTabStyle = aiTab ? window.getComputedStyle(aiTab) : null;

    return {
        activeTab: activeTab?.dataset.tab || null,
        currentAiMode,
        presentationStage: presentationState.stage,
        isPresenting: presentationState.isPresenting,
        aiTabExists: Boolean(aiTab),
        aiTabActive: Boolean(aiTab?.classList.contains('active')),
        aiTabDisplay: aiTabStyle?.display || null,
        presentationViewExists: Boolean(presentationView),
        presentationViewHidden: Boolean(presentationView?.classList.contains('hidden')),
        presentationViewDisplay: presentationStyle?.display || null,
        presentationViewWidth: presentationView?.offsetWidth || 0,
        presentationViewHeight: presentationView?.offsetHeight || 0,
        slidesContainerExists: Boolean(slidesContainer),
        slidesContainerChildren: slidesContainer?.children.length || 0,
        slideCount: getPresentationSlides().length
    };
}

function ensurePresentationUiVisible(reason) {
    currentAiMode = 'apresentacao';
    setModeButtonClasses(modeConversationBtn, false);
    setModeButtonClasses(modePresentationBtn, true);

    if (aiChatView) aiChatView.classList.add('hidden');
    if (aiInputDock) aiInputDock.classList.add('hidden');
    if (presentationView) presentationView.classList.remove('hidden');

    if (document.querySelector('.tab.active')?.dataset.tab !== 'ai') {
        switchTab('ai');
    }

    logPresentationStep('Estado visual da apresentacao reforcado', {
        reason,
        ui: getPresentationUiSnapshot()
    });
}

function handleEnter(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendUserMessage();
    }
}

function escapeHtml(value) {
    return (value || '')
        .toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatInlineMarkdown(text) {
    return text
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/__([^_]+)__/g, '<strong>$1</strong>')
        .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
        .replace(/_([^_\n]+)_/g, '<em>$1</em>');
}

function parseTableRow(line) {
    const cells = line
        .split('|')
        .map(cell => cell.trim())
        .filter((cell, index, arr) => !(cell === '' && (index === 0 || index === arr.length - 1)));
    return cells.length ? cells : [''];
}

function isMarkdownTableHeader(lines, index) {
    if (index + 1 >= lines.length) return false;

    const header = lines[index].trim();
    const separator = lines[index + 1].trim();
    if (!header.includes('|')) return false;

    return separator.includes('|') && separator.includes('-') && /^[:\-\|\s]+$/.test(separator);
}

function consumeMarkdownTable(lines, startIndex) {
    const headerCells = parseTableRow(lines[startIndex]);
    const totalColumns = headerCells.length;

    let i = startIndex + 2;
    const bodyRows = [];

    while (i < lines.length) {
        const rowLine = lines[i].trim();
        if (!rowLine || !rowLine.includes('|')) break;
        if (/^[:\-\|\s]+$/.test(rowLine)) {
            i++;
            continue;
        }

        const rowCells = parseTableRow(rowLine).slice(0, totalColumns);
        while (rowCells.length < totalColumns) rowCells.push('');
        bodyRows.push(rowCells);
        i++;
    }

    let tableHtml = '<div class="ai-table-wrap"><table class="ai-markdown-table"><thead><tr>';
    tableHtml += headerCells.map(cell => `<th>${formatInlineMarkdown(cell)}</th>`).join('');
    tableHtml += '</tr></thead><tbody>';

    if (!bodyRows.length) {
        tableHtml += `<tr><td colspan="${totalColumns}">Sem dados</td></tr>`;
    } else {
        tableHtml += bodyRows
            .map(row => `<tr>${row.map(cell => `<td>${formatInlineMarkdown(cell)}</td>`).join('')}</tr>`)
            .join('');
    }

    tableHtml += '</tbody></table></div>';
    return { html: tableHtml, nextIndex: i };
}

function renderAIText(text) {
    const textStr = (text || '').toString();
    const source = escapeHtml(textStr.replace(/\r\n/g, '\n'));
    const lines = source.split('\n');
    const blocks = [];

    let i = 0;
    while (i < lines.length) {
        const line = lines[i].trim();
        if (!line) {
            i++;
            continue;
        }

        if (isMarkdownTableHeader(lines, i)) {
            const table = consumeMarkdownTable(lines, i);
            blocks.push(table.html);
            i = table.nextIndex;
            continue;
        }

        const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
        if (headingMatch) {
            const level = headingMatch[1].length <= 2 ? 'h2' : 'h3';
            blocks.push(`<${level}>${formatInlineMarkdown(headingMatch[2])}</${level}>`);
            i++;
            continue;
        }

        if (/^[-*•]\s+/.test(line)) {
            const items = [];
            while (i < lines.length) {
                const bulletLine = lines[i].trim();
                if (!/^[-*•]\s+/.test(bulletLine)) break;
                items.push(`<li>${formatInlineMarkdown(bulletLine.replace(/^[-*•]\s+/, ''))}</li>`);
                i++;
            }
            blocks.push(`<ul>${items.join('')}</ul>`);
            continue;
        }

        if (/^\d+\.\s+/.test(line)) {
            const items = [];
            while (i < lines.length) {
                const orderedLine = lines[i].trim();
                if (!/^\d+\.\s+/.test(orderedLine)) break;
                items.push(`<li>${formatInlineMarkdown(orderedLine.replace(/^\d+\.\s+/, ''))}</li>`);
                i++;
            }
            blocks.push(`<ol>${items.join('')}</ol>`);
            continue;
        }

        if (/^>\s?/.test(line)) {
            const quoteLines = [];
            while (i < lines.length) {
                const quoteLine = lines[i].trim();
                if (!/^>\s?/.test(quoteLine)) break;
                quoteLines.push(formatInlineMarkdown(quoteLine.replace(/^>\s?/, '')));
                i++;
            }
            blocks.push(`<blockquote>${quoteLines.join('<br>')}</blockquote>`);
            continue;
        }

        const paragraphLines = [];
        while (i < lines.length) {
            const paragraphLine = lines[i].trim();
            if (!paragraphLine) break;
            if (
                isMarkdownTableHeader(lines, i) ||
                /^(#{1,3})\s+/.test(paragraphLine) ||
                /^[-*•]\s+/.test(paragraphLine) ||
                /^\d+\.\s+/.test(paragraphLine) ||
                /^>\s?/.test(paragraphLine)
            ) {
                break;
            }
            paragraphLines.push(formatInlineMarkdown(paragraphLine));
            i++;
        }

        if (paragraphLines.length) {
            blocks.push(`<p>${paragraphLines.join('<br>')}</p>`);
            continue;
        }

        i++;
    }

    return blocks.length ? blocks.join('') : '<p>Sem resposta no momento.</p>';
}

function renderUserText(text) {
    return `<p>${escapeHtml((text || '').replace(/\r\n/g, '\n')).replace(/\n/g, '<br>')}</p>`;
}

function formatAIError(error) {
    const errorText = typeof error === 'string' ? error : (error?.message || '');
    const normalized = errorText.toLowerCase();

    if (
        normalized.includes('401') ||
        normalized.includes('user not found') ||
        normalized.includes('nao autorizado') ||
        normalized.includes('não autorizado')
    ) {
        return 'Falha de autenticacao da IA. Verifique a chave da API.';
    }

    if (normalized.includes('429') || normalized.includes('rate limit')) {
        return 'A IA esta ocupada agora. Tente novamente em alguns segundos.';
    }

    if (errorText) return errorText;
    return 'Desculpe, tive um erro ao processar sua pergunta.';
}

function normalizeAiMode(mode) {
    return String(mode || 'conversa')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function setModeButtonClasses(button, active) {
    if (!button) return;

    button.className = active
        ? 'mode-btn px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all bg-primary text-on-primary shadow-sm'
        : 'mode-btn px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all text-on-surface-variant hover:bg-white/60';
}

function setAiMode(mode) {
    const normalizedMode = normalizeAiMode(mode);
    const isPresentation = normalizedMode === 'apresentacao';
    logPresentationStep('Alterando modo da IA', {
        requestedMode: mode,
        normalizedMode,
        isPresentation,
        currentStage: presentationState.stage,
        isPresenting: presentationState.isPresenting
    });

    if (!isPresentation && presentationState.isPresenting) {
        stopPresentationShow();
    }

    currentAiMode = isPresentation ? 'apresentacao' : 'conversa';

    setModeButtonClasses(modeConversationBtn, !isPresentation);
    setModeButtonClasses(modePresentationBtn, isPresentation);

    if (aiChatView) aiChatView.classList.toggle('hidden', isPresentation);
    if (aiInputDock) aiInputDock.classList.toggle('hidden', isPresentation);
    if (presentationView) presentationView.classList.toggle('hidden', !isPresentation);

    if (isPresentation) {
        if (presentationState.stage === 'deck' && presentationState.data) {
            renderPresentationDeck(presentationState.data, presentationState.filters, presentationState.aiAnalysis);
        } else if (presentationState.stage === 'loading') {
            renderPresentationLoading(presentationState.filters);
        } else {
            renderPresentationFilterStep();
        }
        ensurePresentationUiVisible('setAiMode(apresentacao)');
        setAIStatus('Apresentação', 'ready');
        return;
    }

    setAIStatus('Pronto', 'ready');
}

function formatDateDisplay(isoStr) {
    if (!isoStr) return '';
    const [year, month, day] = isoStr.split('-');
    if (!year || !month || !day) return isoStr;
    return `${day}/${month}/${year}`;
}

function getBranchLabel(branchValue) {
    const option = Array.from(inputFilial?.options || []).find((item) => item.value === branchValue);
    return option ? option.textContent : 'Todas as Filiais';
}

function getPresentationBranchOptions(selectedValue) {
    const options = Array.from(inputFilial?.options || []);
    if (!options.length) {
        return '<option value="">Todas as Filiais</option>';
    }

    return options.map((option) => {
        const selected = option.value === selectedValue ? ' selected' : '';
        return `<option value="${escapeHtml(option.value)}"${selected}>${escapeHtml(option.textContent)}</option>`;
    }).join('');
}

function getPresentationFilterValues() {
    const previous = presentationState.filters || {};
    return {
        startDate: previous.startDate || inputDataInicial?.value || '',
        endDate: previous.endDate || inputDataFinal?.value || '',
        branch: previous.branch ?? inputFilial?.value ?? ''
    };
}

function renderPresentationFilterStep(errorMessage = '') {
    if (!slidesContainer) return;

    if (presentationState.isPresenting) {
        stopPresentationShow();
    }

    presentationState.stage = 'filters';
    const filters = getPresentationFilterValues();
    logPresentationStep('Renderizando etapa de filtros', {
        filters,
        hasError: Boolean(errorMessage),
        errorMessage
    });
    const errorHtml = errorMessage
        ? `<div class="presentation-form-error">${escapeHtml(errorMessage)}</div>`
        : '';

    slidesContainer.innerHTML = `
        <section class="presentation-start-shell">
            <div class="presentation-start-copy">
                <span class="presentation-eyebrow">Apresentação executiva</span>
                <h1>Monte um deck financeiro com os dados do período.</h1>
                <p>Selecione o recorte para gerar uma narrativa visual com indicadores, evolução mensal, principais despesas e próximos passos.</p>
            </div>
            <div class="presentation-filter-panel">
                <div class="presentation-form-header">
                    <span class="material-symbols-outlined">tune</span>
                    <div>
                        <strong>Filtros</strong>
                        <span>Etapa 1 de 2</span>
                    </div>
                </div>
                ${errorHtml}
                <div class="presentation-form-grid">
                    <label>
                        <span>Data início</span>
                        <input id="presentationStartDate" type="date" value="${escapeHtml(filters.startDate)}">
                    </label>
                    <label>
                        <span>Data fim</span>
                        <input id="presentationEndDate" type="date" value="${escapeHtml(filters.endDate)}">
                    </label>
                    <label class="presentation-field-wide">
                        <span>Filial</span>
                        <select id="presentationBranch">
                            ${getPresentationBranchOptions(filters.branch)}
                        </select>
                    </label>
                </div>
                <button id="presentationContinueBtn" class="presentation-continue-btn">
                    <span>Continuar</span>
                    <span class="material-symbols-outlined">arrow_forward</span>
                </button>
            </div>
        </section>
    `;

    document.getElementById('presentationContinueBtn')?.addEventListener('click', generatePresentationFromFilters);
}

function renderPresentationLoading(filters) {
    if (!slidesContainer) return;

    if (presentationState.isPresenting) {
        stopPresentationShow();
    }

    presentationState.stage = 'loading';
    logPresentationStep('Renderizando loading da apresentacao', { filters });
    slidesContainer.innerHTML = `
        <section class="presentation-loading-shell">
            <div class="presentation-loading-copy">
                <span class="presentation-eyebrow">Etapa 2 de 2</span>
                <h1>Criando sua apresentação</h1>
                <p>${escapeHtml(formatDateDisplay(filters.startDate))} a ${escapeHtml(formatDateDisplay(filters.endDate))} · ${escapeHtml(getBranchLabel(filters.branch))}</p>
            </div>
            <div class="paint-canvas" aria-hidden="true">
                <div class="paint-paper">
                    <div class="paint-layout-line paint-line-title"></div>
                    <div class="paint-layout-line paint-line-short"></div>
                    <div class="paint-layout-card paint-card-1"></div>
                    <div class="paint-layout-card paint-card-2"></div>
                    <div class="paint-layout-chart"></div>
                    <div class="paint-stroke paint-stroke-1"></div>
                    <div class="paint-stroke paint-stroke-2"></div>
                    <div class="paint-stroke paint-stroke-3"></div>
                    <div class="paint-brush">
                        <span class="material-symbols-outlined">brush</span>
                    </div>
                </div>
            </div>
            <div class="presentation-loading-steps">
                <span>Coletando indicadores</span>
                <span>Consultando IA</span>
                <span>Personalizando diagnóstico</span>
                <span>Desenhando slides</span>
            </div>
        </section>
    `;
    ensurePresentationUiVisible('renderPresentationLoading');
}

function parseMoney(value) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : 0;
}

function getMetricTone(expenseRatio) {
    if (expenseRatio >= 70) return 'Atenção alta';
    if (expenseRatio >= 45) return 'Controle relevante';
    return 'Boa folga operacional';
}

function getTrendLabel(value) {
    if (!Number.isFinite(value)) return 'Sem histórico suficiente';
    if (value > 8) return 'Despesas em aceleração';
    if (value < -8) return 'Despesas em queda';
    return 'Despesas estáveis';
}

function formatSignedPercent(value) {
    if (!Number.isFinite(value)) return '0,00%';
    const sign = value > 0 ? '+' : '';
    return `${sign}${formatPercent(value)}`;
}

function buildPresentationMetrics(data) {
    logPresentationStep('Montando metricas da apresentacao', getPresentationDataSummary(data));
    const main = Array.isArray(data?.main) ? data.main : [];
    const monthly = Array.isArray(data?.monthly) ? data.monthly : [];
    const top10 = Array.isArray(data?.top10) ? data.top10 : [];
    const firstRow = main[0] || {};

    const totalIncome = parseMoney(firstRow.total_faturamento);
    const totalExpense = parseMoney(firstRow.total_despesas);
    const netResult = totalIncome - totalExpense;
    const expenseRatio = totalIncome ? (totalExpense / totalIncome) * 100 : 0;

    const monthlyData = monthly.map((item) => ({
        label: `${String(item.mes).padStart(2, '0')}/${item.ano}`,
        income: parseMoney(item.total_faturamento_mes),
        expense: parseMoney(item.total_despesa_mes),
        ratio: parseMoney(item.perc_desp_fat_mes)
    }));

    const topExpenses = top10.map((item) => ({
        name: item.conta || 'Sem categoria',
        value: parseMoney(item.total_despesa)
    }));

    const topExpense = topExpenses[0] || { name: 'Sem dados', value: 0 };
    const topShare = totalExpense ? (topExpense.value / totalExpense) * 100 : 0;
    const firstMonth = monthlyData[0];
    const lastMonth = monthlyData[monthlyData.length - 1];
    const expenseTrend = firstMonth && firstMonth.expense
        ? ((lastMonth.expense - firstMonth.expense) / Math.abs(firstMonth.expense)) * 100
        : 0;
    const maxMonthlyValue = Math.max(...monthlyData.flatMap((item) => [item.income, item.expense]), 1);
    const maxExpenseValue = Math.max(...topExpenses.map((item) => item.value), 1);
    logPresentationStep('Metricas calculadas', {
        totalIncome,
        totalExpense,
        netResult,
        expenseRatio,
        topExpense,
        topRows: topExpenses.length,
        monthlyRows: monthlyData.length
    });

    return {
        totalIncome,
        totalExpense,
        netResult,
        expenseRatio,
        topExpense,
        topShare,
        expenseTrend,
        monthlyData,
        topExpenses,
        maxMonthlyValue,
        maxExpenseValue
    };
}

function renderMonthlyBars(metrics) {
    if (!metrics.monthlyData.length) {
        return '<div class="presentation-empty">Sem evolução mensal para o período selecionado.</div>';
    }

    return metrics.monthlyData.map((item) => {
        const incomeHeight = Math.max(6, Math.round((item.income / metrics.maxMonthlyValue) * 100));
        const expenseHeight = Math.max(6, Math.round((item.expense / metrics.maxMonthlyValue) * 100));

        return `
            <div class="presentation-month">
                <div class="presentation-bars">
                    <span class="bar-income" style="height:${incomeHeight}%"></span>
                    <span class="bar-expense" style="height:${expenseHeight}%"></span>
                </div>
                <strong>${escapeHtml(item.label)}</strong>
            </div>
        `;
    }).join('');
}

function renderTopExpenseRows(metrics) {
    if (!metrics.topExpenses.length) {
        return '<div class="presentation-empty">Sem despesas categorizadas para o período selecionado.</div>';
    }

    return metrics.topExpenses.slice(0, 8).map((item, index) => {
        const width = Math.max(5, Math.round((item.value / metrics.maxExpenseValue) * 100));
        const share = metrics.totalExpense ? (item.value / metrics.totalExpense) * 100 : 0;

        return `
            <div class="presentation-expense-row">
                <div>
                    <span>${String(index + 1).padStart(2, '0')}</span>
                    <strong>${escapeHtml(item.name)}</strong>
                </div>
                <div class="presentation-expense-track">
                    <span style="width:${width}%"></span>
                </div>
                <em>${formatCurrency(item.value)} · ${formatPercent(share)}</em>
            </div>
        `;
    }).join('');
}

function renderBpoMetricCards(items) {
    return items.map((item) => `
        <article>
            <span>${escapeHtml(item.label)}</span>
            <strong class="${item.tone || ''}">${escapeHtml(item.value)}</strong>
            ${item.note ? `<small>${escapeHtml(item.note)}</small>` : ''}
        </article>
    `).join('');
}

function renderBpoTableRows(rows) {
    return rows.map((row) => `
        <tr>
            ${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}
        </tr>
    `).join('');
}

function pickPresentationText(value, fallback) {
    const text = String(value || '').trim();
    return text || fallback;
}

function normalizePresentationTone(tone) {
    if (tone === 'positive' || tone === 'negative') return tone;
    return '';
}

function renderPresentationInsightCards(items) {
    return items.map((item) => `
        <article>
            <span>${escapeHtml(item.evidence || 'Evidência da IA')}</span>
            <strong>${escapeHtml(item.title || 'Insight')}</strong>
            <p>${escapeHtml(item.finding || 'A IA não retornou detalhe suficiente para este insight.')}</p>
        </article>
    `).join('');
}

function renderPresentationConclusionCards(items) {
    return items.map((item, index) => `
        <article>
            <span>${index + 1}</span>
            <strong>${escapeHtml(item.title || 'Próximo passo')}</strong>
            <p>${escapeHtml(item.text || 'A IA não retornou detalhe suficiente para esta conclusão.')}</p>
        </article>
    `).join('');
}

function renderPresentationLimitations(items) {
    if (!items?.length) return '';

    return `
        <div class="presentation-limitations">
            <span>Limitações dos dados</span>
            <p>${items.map(escapeHtml).join(' · ')}</p>
        </div>
    `;
}

function renderPresentationDeck(data, filters, aiAnalysis = null) {
    if (!slidesContainer) return;

    if (presentationState.isPresenting) {
        stopPresentationShow();
    }

    logPresentationStep('Iniciando renderizacao do deck BPO', {
        filters,
        dataSummary: getPresentationDataSummary(data),
        hasAiAnalysis: Boolean(aiAnalysis)
    });

    presentationState = {
        stage: 'deck',
        filters,
        data,
        aiAnalysis,
        currentSlideIndex: 0,
        isPresenting: false
    };
    const metrics = buildPresentationMetrics(data);
    const branchLabel = getBranchLabel(filters.branch);
    const periodLabel = `${formatDateDisplay(filters.startDate)} a ${formatDateDisplay(filters.endDate)}`;
    const ratioTone = getMetricTone(metrics.expenseRatio);
    const trendLabel = getTrendLabel(metrics.expenseTrend);
    const profitMargin = metrics.totalIncome ? (metrics.netResult / metrics.totalIncome) * 100 : 0;
    const monthlyCount = metrics.monthlyData.length || 1;
    const avgIncome = metrics.monthlyData.reduce((sum, item) => sum + item.income, 0) / monthlyCount;
    const avgExpense = metrics.monthlyData.reduce((sum, item) => sum + item.expense, 0) / monthlyCount;
    const avgNet = avgIncome - avgExpense;
    const firstMonth = metrics.monthlyData[0];
    const lastMonth = metrics.monthlyData[metrics.monthlyData.length - 1];
    const revenueTrend = firstMonth && firstMonth.income
        ? ((lastMonth.income - firstMonth.income) / Math.abs(firstMonth.income)) * 100
        : 0;
    const top3Total = metrics.topExpenses.slice(0, 3).reduce((sum, item) => sum + item.value, 0);
    const top3Share = metrics.totalExpense ? (top3Total / metrics.totalExpense) * 100 : 0;
    const cashRisk = avgNet < 0 || metrics.expenseRatio >= 85 ? 'Alto' : metrics.expenseRatio >= 65 ? 'Médio' : 'Controlado';
    const principalAlert = metrics.expenseRatio >= 75
        ? 'Despesa operacional elevada em relação ao faturamento.'
        : top3Share >= 60
            ? 'Concentração relevante nas três maiores despesas.'
            : revenueTrend < -8
                ? 'Receita em queda no recorte mensal.'
                : 'Sem alerta crítico no recorte analisado.';
    const forecastRealistic = avgNet;
    const forecastOptimistic = (avgIncome * 1.08) - (avgExpense * 0.98);
    const forecastPessimistic = (avgIncome * 0.92) - (avgExpense * 1.05);
    const companyName = pickPresentationText(aiAnalysis?.companyName, branchLabel);
    const coverSubtitle = pickPresentationText(aiAnalysis?.coverSubtitle, `Diagnóstico BPO personalizado de ${periodLabel}`);
    const executiveHeadline = pickPresentationText(aiAnalysis?.executiveHeadline, `${branchLabel} gerou ${formatCurrency(metrics.netResult)} de resultado operacional no período.`);
    const executiveNarrative = pickPresentationText(aiAnalysis?.executiveNarrative, `${principalAlert} O faturamento foi ${formatCurrency(metrics.totalIncome)}, as despesas foram ${formatCurrency(metrics.totalExpense)} e a margem líquida ficou em ${formatPercent(profitMargin)}.`);
    const revenueDiagnosis = pickPresentationText(aiAnalysis?.revenueDiagnosis, `O faturamento total foi ${formatCurrency(metrics.totalIncome)}, com média mensal de ${formatCurrency(avgIncome)} e variação de ${formatSignedPercent(revenueTrend)} entre o primeiro e o último mês disponível.`);
    const expenseDiagnosis = pickPresentationText(aiAnalysis?.expenseDiagnosis, `As despesas totalizaram ${formatCurrency(metrics.totalExpense)}, equivalentes a ${formatPercent(metrics.expenseRatio)} do faturamento. A maior categoria registrada foi ${metrics.topExpense.name}, com ${formatCurrency(metrics.topExpense.value)}.`);
    const topExpenseDiagnosis = pickPresentationText(aiAnalysis?.topExpenseDiagnosis, `O top 3 concentrou ${formatPercent(top3Share)} das despesas. A primeira linha de atenção é ${metrics.topExpense.name}, responsável por ${formatPercent(metrics.topShare)} do total de despesas.`);
    const operationalDiagnosis = pickPresentationText(aiAnalysis?.operationalDiagnosis, `O custo operacional consumiu ${formatPercent(metrics.expenseRatio)} do faturamento em ${branchLabel}, com leitura concentrada nas categorias disponíveis no plano de contas.`);
    const resultDiagnosis = pickPresentationText(aiAnalysis?.resultDiagnosis, `O resultado operacional estimado foi ${formatCurrency(metrics.netResult)}, com margem líquida de ${formatPercent(profitMargin)} no período analisado.`);
    const cashDiagnosis = pickPresentationText(aiAnalysis?.cashDiagnosis, `As entradas somaram ${formatCurrency(metrics.totalIncome)}, as saídas somaram ${formatCurrency(metrics.totalExpense)} e o saldo operacional estimado foi ${formatCurrency(metrics.netResult)}. Risco de caixa: ${cashRisk}.`);
    const aiInsights = Array.isArray(aiAnalysis?.insights) && aiAnalysis.insights.length
        ? aiAnalysis.insights.slice(0, 5)
        : [
            { title: 'Receita', finding: revenueDiagnosis, evidence: `Variação: ${formatSignedPercent(revenueTrend)}` },
            { title: 'Custos', finding: expenseDiagnosis, evidence: `${formatPercent(metrics.expenseRatio)} do faturamento` },
            { title: 'Concentração', finding: topExpenseDiagnosis, evidence: `Top 3: ${formatPercent(top3Share)}` }
        ];
    const aiRisks = Array.isArray(aiAnalysis?.risks) && aiAnalysis.risks.length
        ? aiAnalysis.risks.slice(0, 4)
        : [
            { label: 'Caixa crítico', value: cashRisk === 'Alto' ? 'Sim' : 'Não', tone: cashRisk === 'Alto' ? 'negative' : 'positive', note: `Risco: ${cashRisk}` },
            { label: 'Margem baixa', value: profitMargin < 10 ? 'Sim' : 'Não', tone: profitMargin < 10 ? 'negative' : 'positive', note: `Margem: ${formatPercent(profitMargin)}` },
            { label: 'Custos altos', value: metrics.expenseRatio > 70 ? 'Sim' : 'Não', tone: metrics.expenseRatio > 70 ? 'negative' : 'positive', note: `${formatPercent(metrics.expenseRatio)} da receita` },
            { label: 'Concentração', value: top3Share > 60 ? 'Alta' : 'Normal', tone: top3Share > 60 ? 'negative' : 'positive', note: `Top 3: ${formatPercent(top3Share)}` }
        ];
    const aiActionPlan = Array.isArray(aiAnalysis?.actionPlan) && aiAnalysis.actionPlan.length
        ? aiAnalysis.actionPlan.slice(0, 5)
        : [
            { action: `Auditar lançamentos de ${metrics.topExpense.name}`, owner: 'BPO financeiro', deadline: '7 dias', expectedImpact: `Validar ${formatCurrency(metrics.topExpense.value)} em despesas do período` },
            { action: 'Revisar queda de faturamento no último mês disponível', owner: 'Gestão comercial', deadline: '15 dias', expectedImpact: `Explicar variação de ${formatSignedPercent(revenueTrend)} na receita` },
            { action: 'Formalizar acompanhamento mensal por categoria', owner: 'Controladoria', deadline: 'Próximo fechamento', expectedImpact: `Monitorar top 3 que soma ${formatPercent(top3Share)} das despesas` }
        ];
    const aiForecast = Array.isArray(aiAnalysis?.forecast) && aiAnalysis.forecast.length
        ? aiAnalysis.forecast.slice(0, 3)
        : [
            { label: 'Otimista', value: formatCurrency(forecastOptimistic), tone: forecastOptimistic >= 0 ? 'positive' : 'negative', note: 'Receita +8% e despesa -2%' },
            { label: 'Realista', value: formatCurrency(forecastRealistic), tone: forecastRealistic >= 0 ? 'positive' : 'negative', note: 'Média mensal atual' },
            { label: 'Pessimista', value: formatCurrency(forecastPessimistic), tone: forecastPessimistic >= 0 ? 'positive' : 'negative', note: 'Receita -8% e despesa +5%' }
        ];
    const aiConclusion = Array.isArray(aiAnalysis?.conclusion) && aiAnalysis.conclusion.length
        ? aiAnalysis.conclusion.slice(0, 3)
        : [
            { title: 'Situação atual', text: `${principalAlert} Resultado do período: ${formatCurrency(metrics.netResult)}.` },
            { title: 'Próximo fechamento', text: `Revisar ${metrics.topExpense.name}, margem líquida e fluxo de caixa antes da próxima competência.` },
            { title: 'Mensagem final', text: 'A leitura da IA deve ser convertida em ações mensuráveis de margem, caixa e controle operacional.' }
        ];
    const slideTotal = 13;

    slidesContainer.innerHTML = `
        <div class="presentation-deck-toolbar">
            <div class="presentation-toolbar-actions">
                <button id="presentationBackToFilters" type="button" class="presentation-secondary-action">
                    <span class="material-symbols-outlined">tune</span>
                    Ajustar filtros
                </button>
                <button id="presentationStartShow" type="button" class="presentation-start-action">
                    <span class="material-symbols-outlined">slideshow</span>
                    Iniciar apresentação
                </button>
            </div>
            <span>${escapeHtml(periodLabel)} · ${escapeHtml(branchLabel)}</span>
        </div>
        <div id="presentationSlideCounter" class="presentation-slide-counter">1 / ${slideTotal}</div>

        <section class="presentation-slide presentation-cover-slide">
            <div>
                <div class="presentation-logo-mark">UniCloud</div>
                <span class="presentation-eyebrow">BPO Financeiro</span>
                <h1>${escapeHtml(companyName)}</h1>
                <p>${escapeHtml(coverSubtitle)} · ${escapeHtml(periodLabel)}</p>
            </div>
            <div class="presentation-cover-metrics">
                <strong>${formatCurrency(metrics.totalIncome)}</strong>
                <span>Faturamento</span>
                <strong>${formatCurrency(metrics.netResult)}</strong>
                <span>Resultado</span>
            </div>
        </section>

        <section class="presentation-slide">
            <div class="presentation-slide-header">
                <span>01</span>
                <h2>Resumo executivo</h2>
            </div>
            <div class="presentation-kpi-grid">
                ${renderBpoMetricCards([
                    { label: 'Faturamento total', value: formatCurrency(metrics.totalIncome) },
                    { label: 'Lucro / prejuízo', value: formatCurrency(metrics.netResult), tone: metrics.netResult >= 0 ? 'positive' : 'negative' },
                    { label: 'Margem líquida', value: formatPercent(profitMargin), tone: profitMargin >= 0 ? 'positive' : 'negative' },
                    { label: 'Caixa operacional', value: formatCurrency(metrics.netResult), note: 'Estimado pelo resultado do período' }
                ])}
            </div>
            <div class="presentation-insight-band">
                <span>${escapeHtml(ratioTone)}</span>
                <p><strong>${escapeHtml(executiveHeadline)}</strong> ${escapeHtml(executiveNarrative)}</p>
            </div>
            ${renderPresentationLimitations(aiAnalysis?.dataLimitations)}
        </section>

        <section class="presentation-slide">
            <div class="presentation-slide-header">
                <span>02</span>
                <h2>Faturamento</h2>
            </div>
            <div class="presentation-kpi-grid compact">
                ${renderBpoMetricCards([
                    { label: 'Receita total', value: formatCurrency(metrics.totalIncome) },
                    { label: 'Média por mês', value: formatCurrency(avgIncome) },
                    { label: 'Variação mensal', value: formatSignedPercent(revenueTrend), tone: revenueTrend >= 0 ? 'positive' : 'negative' },
                    { label: 'Filial analisada', value: branchLabel }
                ])}
            </div>
            <div class="presentation-chart-legend">
                <span><i class="legend-income"></i>Faturamento</span>
                <span><i class="legend-expense"></i>Despesas</span>
            </div>
            <div class="presentation-monthly-chart">
                ${renderMonthlyBars(metrics)}
            </div>
            <div class="presentation-insight-band compact">
                <span>Leitura IA</span>
                <p>${escapeHtml(revenueDiagnosis)}</p>
            </div>
        </section>

        <section class="presentation-slide">
            <div class="presentation-slide-header">
                <span>03</span>
                <h2>Despesas totais</h2>
            </div>
            <div class="presentation-kpi-grid compact">
                ${renderBpoMetricCards([
                    { label: 'Total de despesas', value: formatCurrency(metrics.totalExpense) },
                    { label: '% sobre faturamento', value: formatPercent(metrics.expenseRatio) },
                    { label: 'Variação das despesas', value: formatSignedPercent(metrics.expenseTrend), tone: metrics.expenseTrend <= 0 ? 'positive' : 'negative' },
                    { label: 'Média mensal', value: formatCurrency(avgExpense) }
                ])}
            </div>
            <div class="presentation-insight-band compact">
                <span>${escapeHtml(trendLabel)}</span>
                <p>${escapeHtml(expenseDiagnosis)}</p>
            </div>
        </section>

        <section class="presentation-slide">
            <div class="presentation-slide-header">
                <span>04</span>
                <h2>Top 10 despesas</h2>
            </div>
            <div class="presentation-expense-list dense">
                ${renderTopExpenseRows(metrics)}
            </div>
            <div class="presentation-insight-band compact">
                <span>Leitura IA</span>
                <p>${escapeHtml(topExpenseDiagnosis)}</p>
            </div>
        </section>

        <section class="presentation-slide presentation-two-column">
            <div>
                <div class="presentation-slide-header">
                    <span>05</span>
                    <h2>Custo operacional</h2>
                </div>
                <p class="presentation-lead">${escapeHtml(operationalDiagnosis)}</p>
            </div>
            <div class="presentation-priority-list">
                <article>
                    <span class="material-symbols-outlined">apartment</span>
                    <strong>Custo por filial</strong>
                    <p>${escapeHtml(branchLabel)} · consolidado pelo filtro selecionado.</p>
                </article>
                <article>
                    <span class="material-symbols-outlined">groups</span>
                    <strong>Custo por funcionário</strong>
                    <p>Base atual não contém quadro de funcionários para rateio automático.</p>
                </article>
                <article>
                    <span class="material-symbols-outlined">percent</span>
                    <strong>Custo vs receita</strong>
                    <p>${formatPercent(metrics.expenseRatio)} de comprometimento operacional.</p>
                </article>
            </div>
        </section>

        <section class="presentation-slide">
            <div class="presentation-slide-header">
                <span>06</span>
                <h2>Resultado</h2>
            </div>
            <div class="presentation-result-panel">
                <strong class="${metrics.netResult >= 0 ? 'positive' : 'negative'}">${formatCurrency(metrics.netResult)}</strong>
                <span>Lucro / prejuízo operacional estimado</span>
                <p>${escapeHtml(resultDiagnosis)}</p>
            </div>
            <div class="presentation-kpi-grid compact">
                ${renderBpoMetricCards([
                    { label: 'Margem líquida', value: formatPercent(profitMargin), tone: profitMargin >= 0 ? 'positive' : 'negative' },
                    { label: 'EBITDA', value: formatCurrency(metrics.netResult), note: 'Proxy operacional sem ajustes contábeis' },
                    { label: 'Tendência despesa', value: formatSignedPercent(metrics.expenseTrend), tone: metrics.expenseTrend <= 0 ? 'positive' : 'negative' },
                    { label: 'Tendência receita', value: formatSignedPercent(revenueTrend), tone: revenueTrend >= 0 ? 'positive' : 'negative' }
                ])}
            </div>
        </section>

        <section class="presentation-slide">
            <div class="presentation-slide-header">
                <span>07</span>
                <h2>Fluxo de caixa</h2>
            </div>
            <div class="presentation-kpi-grid compact">
                ${renderBpoMetricCards([
                    { label: 'Entradas', value: formatCurrency(metrics.totalIncome) },
                    { label: 'Saídas', value: formatCurrency(metrics.totalExpense) },
                    { label: 'Saldo acumulado', value: formatCurrency(metrics.netResult), tone: metrics.netResult >= 0 ? 'positive' : 'negative' },
                    { label: 'Risco de caixa', value: cashRisk, tone: cashRisk === 'Alto' ? 'negative' : cashRisk === 'Controlado' ? 'positive' : '' }
                ])}
            </div>
            <div class="presentation-insight-band">
                <span>Leitura IA</span>
                <p>${escapeHtml(cashDiagnosis)}</p>
            </div>
        </section>

        <section class="presentation-slide">
            <div class="presentation-slide-header">
                <span>08</span>
                <h2>Insights inteligentes</h2>
            </div>
            <div class="presentation-insight-grid">
                ${renderPresentationInsightCards(aiInsights)}
            </div>
        </section>

        <section class="presentation-slide">
            <div class="presentation-slide-header">
                <span>09</span>
                <h2>Alertas e riscos</h2>
            </div>
            <div class="presentation-alert-grid">
                ${renderBpoMetricCards(aiRisks.map((item) => ({
                    label: item.label || 'Risco',
                    value: item.value || 'Avaliar',
                    tone: normalizePresentationTone(item.tone),
                    note: item.note || 'A IA não retornou evidência detalhada para este risco.'
                })))}
            </div>
        </section>

        <section class="presentation-slide">
            <div class="presentation-slide-header">
                <span>10</span>
                <h2>Plano de ação</h2>
            </div>
            <table class="presentation-action-table">
                <thead>
                    <tr><th>Ação</th><th>Responsável</th><th>Prazo</th><th>Impacto esperado</th></tr>
                </thead>
                <tbody>
                    ${renderBpoTableRows(aiActionPlan.map((item) => [
                        item.action || `Auditar ${metrics.topExpense.name}`,
                        item.owner || 'BPO financeiro',
                        item.deadline || 'Próximo fechamento',
                        item.expectedImpact || `Controlar ${formatCurrency(metrics.topExpense.value)} em despesas`
                    ]))}
                </tbody>
            </table>
        </section>

        <section class="presentation-slide">
            <div class="presentation-slide-header">
                <span>11</span>
                <h2>Projeções / forecast</h2>
            </div>
            <div class="presentation-forecast-grid">
                ${renderBpoMetricCards(aiForecast.map((item) => ({
                    label: item.label || 'Cenário',
                    value: item.value || 'Sem valor projetado',
                    tone: normalizePresentationTone(item.tone),
                    note: item.note || 'A IA não retornou premissa detalhada para este cenário.'
                })))}
            </div>
        </section>

        <section class="presentation-slide presentation-close-slide">
            <span class="presentation-eyebrow">Conclusão</span>
            <h2>Situação atual e próximos passos</h2>
            <div class="presentation-action-grid">
                ${renderPresentationConclusionCards(aiConclusion)}
            </div>
        </section>
    `;

    document.getElementById('presentationBackToFilters')?.addEventListener('click', () => {
        presentationState.stage = 'filters';
        renderPresentationFilterStep();
    });
    document.getElementById('presentationStartShow')?.addEventListener('click', startPresentationShow);

    if (presentationView) {
        presentationView.scrollTop = 0;
    }

    ensurePresentationUiVisible('renderPresentationDeck');
    logPresentationStep('Deck BPO renderizado com sucesso', {
        slideCount: getPresentationSlides().length,
        ui: getPresentationUiSnapshot(),
        filters,
        metrics: {
            totalIncome: metrics.totalIncome,
            totalExpense: metrics.totalExpense,
            netResult: metrics.netResult,
            expenseRatio: metrics.expenseRatio
        }
    });
    setAIStatus('Apresentação pronta', 'ready');
}

function getPresentationSlides() {
    if (!slidesContainer) return [];
    return Array.from(slidesContainer.querySelectorAll('.presentation-slide'));
}

function updatePresentationSlideCounter(currentIndex, total) {
    const counter = document.getElementById('presentationSlideCounter');
    if (!counter) return;

    counter.textContent = `${currentIndex + 1} / ${total}`;
}

function setActivePresentationSlide(index) {
    const slides = getPresentationSlides();
    if (!slides.length) return;

    const lastIndex = slides.length - 1;
    const nextIndex = Math.max(0, Math.min(index, lastIndex));
    presentationState.currentSlideIndex = nextIndex;

    slides.forEach((slide, slideIndex) => {
        slide.classList.toggle('is-active', slideIndex === nextIndex);
    });

    updatePresentationSlideCounter(nextIndex, slides.length);
}

function movePresentationSlide(direction) {
    setActivePresentationSlide(presentationState.currentSlideIndex + direction);
}

function handlePresentationKeydown(event) {
    if (!presentationState.isPresenting) return;

    if (event.key === 'ArrowRight') {
        event.preventDefault();
        movePresentationSlide(1);
        return;
    }

    if (event.key === 'ArrowLeft') {
        event.preventDefault();
        movePresentationSlide(-1);
        return;
    }

    if (event.key === 'Escape') {
        stopPresentationShow();
    }
}

function startPresentationShow() {
    if (!presentationView || !slidesContainer) return;
    if (presentationState.isPresenting) return;

    const slides = getPresentationSlides();
    if (!slides.length) return;

    logPresentationStep('Iniciando modo apresentacao', {
        slideCount: slides.length,
        currentSlideIndex: presentationState.currentSlideIndex
    });
    presentationState.isPresenting = true;
    document.body.classList.add('presentation-mode-active');
    presentationView.classList.add('presentation-viewer-active');
    slidesContainer.classList.add('presentation-viewer-stage');
    setActivePresentationSlide(presentationState.currentSlideIndex || 0);

    document.addEventListener('keydown', handlePresentationKeydown);

    setAIStatus('Apresentando', 'ready');
}

function stopPresentationShow() {
    if (!presentationView || !slidesContainer) return;

    logPresentationStep('Encerrando modo apresentacao', {
        currentSlideIndex: presentationState.currentSlideIndex,
        stage: presentationState.stage
    });
    presentationState.isPresenting = false;
    document.body.classList.remove('presentation-mode-active');
    presentationView.classList.remove('presentation-viewer-active');
    slidesContainer.classList.remove('presentation-viewer-stage');
    getPresentationSlides().forEach((slide) => slide.classList.remove('is-active'));

    document.removeEventListener('keydown', handlePresentationKeydown);

    setAIStatus('Apresentação pronta', 'ready');
}

async function generatePresentationFromFilters() {
    if (!slidesContainer || presentationState.stage === 'loading') return;

    const startDate = document.getElementById('presentationStartDate')?.value || '';
    const endDate = document.getElementById('presentationEndDate')?.value || '';
    const branch = document.getElementById('presentationBranch')?.value || '';
    logPresentationStep('Clique em Continuar recebido', {
        startDate,
        endDate,
        branch,
        hasApi: Boolean(window.api),
        hasGetData: Boolean(window.api?.getData),
        hasGetPresentationAnalysis: Boolean(window.api?.getPresentationAnalysis),
        currentStage: presentationState.stage
    });

    if (!startDate || !endDate) {
        logPresentationStep('Validacao bloqueou geracao: datas incompletas', { startDate, endDate, branch });
        renderPresentationFilterStep('Informe a data início e a data fim.');
        return;
    }

    if (startDate > endDate) {
        logPresentationStep('Validacao bloqueou geracao: data inicial maior que final', { startDate, endDate, branch });
        renderPresentationFilterStep('A data início não pode ser maior que a data fim.');
        return;
    }

    const filters = { startDate, endDate, branch };
    presentationState.filters = filters;
    renderPresentationLoading(filters);
    setAIStatus('Criando...', 'analyzing');

    try {
        const startedAt = performance.now();
        const minimumLoading = new Promise((resolve) => setTimeout(resolve, 2600));
        logPresentationStep('Chamando window.api.getData', { filters });
        const request = window.api.getData({ startDate, endDate, branch });
        const [response] = await Promise.all([request, minimumLoading]);
        logPresentationStep('Resposta recebida de window.api.getData', {
            elapsedMs: Math.round(performance.now() - startedAt),
            success: Boolean(response?.success),
            error: response?.error || null,
            dataSummary: getPresentationDataSummary(response?.data)
        });

        if (!response?.success) {
            throw new Error(response?.error || 'Erro ao carregar dados para a apresentação.');
        }

        if (!window.api?.getPresentationAnalysis) {
            throw new Error('API de análise para apresentação não está disponível no preload.');
        }

        setAIStatus('Analisando com IA...', 'analyzing');
        logPresentationStep('Chamando IA para analise personalizada da apresentacao', {
            filters,
            branchLabel: getBranchLabel(branch),
            dataSummary: getPresentationDataSummary(response.data)
        });
        const aiResponse = await window.api.getPresentationAnalysis({
            startDate,
            endDate,
            branch,
            branchLabel: getBranchLabel(branch),
            dashboardData: response.data || {}
        });
        logPresentationStep('Resposta recebida da IA para apresentacao', {
            elapsedMs: Math.round(performance.now() - startedAt),
            success: Boolean(aiResponse?.success),
            error: aiResponse?.error || null,
            analysisSummary: {
                companyName: aiResponse?.analysis?.companyName || '',
                insights: Array.isArray(aiResponse?.analysis?.insights) ? aiResponse.analysis.insights.length : 0,
                risks: Array.isArray(aiResponse?.analysis?.risks) ? aiResponse.analysis.risks.length : 0,
                actions: Array.isArray(aiResponse?.analysis?.actionPlan) ? aiResponse.analysis.actionPlan.length : 0
            }
        });

        if (!aiResponse?.success) {
            throw new Error(aiResponse?.error || 'A IA não conseguiu gerar a análise personalizada da apresentação.');
        }

        renderPresentationDeck(response.data || {}, filters, aiResponse.analysis);
    } catch (error) {
        logPresentationError('Erro ao gerar apresentacao', error, {
            filters,
            currentStage: presentationState.stage
        });
        presentationState.stage = 'filters';
        renderPresentationFilterStep(formatAIError(error));
        setAIStatus('Erro', 'error');
    }
}

function setInputSendingState(sending) {
    isSendingAI = sending;
    if (aiInput) aiInput.disabled = sending;
    if (btnSend) btnSend.disabled = sending;

    if (!sending && aiInput) {
        aiInput.focus();
    }
}

async function sendUserMessage() {
    if (isSendingAI) return;

    // 0. Hide Welcome View if visible
    const welcomeView = document.getElementById('aiWelcomeView');
    if (welcomeView && !welcomeView.classList.contains('hidden')) {
        welcomeView.classList.add('hidden');
    }

    const message = aiInput.value.trim();
    if (!message) return;

    // 1. Save to History (Dynamic Sidebar)
    saveAIChat(message);

    // 2. Add User Message to Chat View
    addMessageToChat(message, 'user');
    aiInput.value = '';

    // Reset textarea height if it exists
    if (aiInput.tagName === 'TEXTAREA') {
        aiInput.style.height = '48px';
    }

    // 2. Set Status & Show Typing Indicator
    setAIStatus('Analisando...', 'analyzing');
    setInputSendingState(true);
    showTypingIndicator();

    // 3. Call Backend
    try {
        const context = {
            startDate: inputDataInicial.value,
            endDate: inputDataFinal.value,
            branch: inputFilial.value
        };

        let aiMessageBody = null;
        let aiMessageContent = "";

        let lastUpdate = 0;
        const chunkHandler = (event, chunk) => {
            if (document.getElementById('typingIndicator')) {
                removeTypingIndicator();
            }
            if (!aiMessageBody) {
                const msgDiv = document.createElement('div');
                msgDiv.className = 'flex gap-6 items-start ai-message-bubble';
                msgDiv.innerHTML = `
                    <div class="w-11 h-11 rounded-2xl bg-primary flex-shrink-0 flex items-center justify-center mt-1 shadow-liquid border border-white/20">
                        <span class="material-symbols-outlined text-white text-[22px]" style="font-variation-settings: 'FILL' 1;">auto_awesome</span>
                    </div>
                    <div class="flex-1 space-y-4 pt-1">
                        <div class="prose prose-slate max-w-none text-[16px] leading-8 text-on-surface font-medium message-body"></div>
                    </div>
                `;
                chatHistory.appendChild(msgDiv);
                aiMessageBody = msgDiv.querySelector('.message-body');
                aiMessageBody.classList.add('typing');
            }
            aiMessageContent += chunk;

            const now = Date.now();
            if (now - lastUpdate > 100) {
                aiMessageBody.innerHTML = renderAIText(aiMessageContent);
                chatHistory.scrollTop = chatHistory.scrollHeight;
                lastUpdate = now;
            }
        };

        if (window.api.onAIStreamChunk) {
            window.api.onAIStreamChunk(chunkHandler);
        }

        const response = await window.api.askAI({ message, context });

        if (window.api.removeAIStreamListeners) {
            window.api.removeAIStreamListeners();
        }

        // Remove typing indicator before showing response
        removeTypingIndicator();

        if (response.success) {
            if (!aiMessageBody) {
                addMessageToChat(response.answer, 'ai', response.analyzedAccount);
            } else {
                // Ensure final version is rendered (catch last throttled chunks)
                aiMessageBody.innerHTML = renderAIText(response.answer);
                chatHistory.scrollTop = chatHistory.scrollHeight;

                if (response.analyzedAccount) {
                    const badgeHtml = `<div class="mb-2 px-3 py-1 bg-primary/10 text-primary text-[11px] font-bold rounded-full w-fit">Análise por conta: ${escapeHtml(response.analyzedAccount)}</div>`;
                    aiMessageBody.insertAdjacentHTML('beforebegin', badgeHtml);
                }
                aiMessageBody.classList.remove('typing');
            }
            setAIStatus('Pronto', 'ready');
        } else {
            if (aiMessageBody) {
                aiMessageBody.innerHTML = renderAIText(formatAIError(response.error));
                aiMessageBody.classList.remove('typing');
            } else {
                addMessageToChat(formatAIError(response.error), 'ai');
            }
            setAIStatus('Erro', 'error');
            console.error(response.error);
        }

    } catch (err) {
        removeTypingIndicator(); // Ensure removal on error
        addMessageToChat(formatAIError(err), 'ai');
        setAIStatus('Erro', 'error');
        console.error(err);
    } finally {
        setInputSendingState(false);
    }
}

// Typing Indicator Helpers
function showTypingIndicator() {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'flex gap-6 items-start typing-indicator-wrapper';
    msgDiv.id = 'typingIndicator';
    msgDiv.innerHTML = `
        <div class="w-11 h-11 rounded-2xl bg-primary flex-shrink-0 flex items-center justify-center mt-1 shadow-liquid border border-white/20 animate-pulse">
            <span class="material-symbols-outlined text-white text-[22px]" style="font-variation-settings: 'FILL' 1;">auto_awesome</span>
        </div>
        <div class="flex-1 pt-4">
            <div class="typing-indicator flex gap-1.5 ml-1">
                <span class="w-2 h-2 bg-primary/40 rounded-full animate-bounce"></span>
                <span class="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span class="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:0.4s]"></span>
            </div>
        </div>
    `;
    chatHistory.appendChild(msgDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

// Helper to trigger predefined questions
function askAI(question) {
    if (isSendingAI) return;
    if (aiInput) {
        aiInput.value = question;
        // Trigger auto-resize if it's a textarea
        if (aiInput.tagName === 'TEXTAREA') {
            aiInput.style.height = 'auto';
            aiInput.style.height = aiInput.scrollHeight + 'px';
        }
    }
    sendUserMessage();
}

function startNewChat() {
    if (chatHistory) {
        chatHistory.innerHTML = '';
    }
    const welcomeView = document.getElementById('aiWelcomeView');
    if (welcomeView) {
        welcomeView.classList.remove('hidden');
    }

    if (currentAiMode !== 'conversa') {
        setAiMode('conversa');
        return;
    }

    setAIStatus('Pronto', 'ready');
}

// Expose to window
window.askAI = askAI;
window.startNewChat = startNewChat;
window.setAiMode = setAiMode;

// --- Dynamic AI History Management ---

function renderAIChatHistoryList() {
    if (!aiChatHistoryList) return;
    
    // Header for the sidebar
    const titleHtml = '<div class="text-[10px] font-bold text-on-surface-variant/60 px-5 py-4 uppercase tracking-[0.2em]">Recentes</div>';
    
    const itemsHtml = aiChatHistory.map((chat, index) => {
        const title = chat.title || 'Sem título';
        const escapedTitle = escapeHtml(title);
        
        return `
            <div class="group relative flex items-center w-full px-2">
                <button onclick="askAI('${escapedTitle}')" class="flex-1 text-left px-5 py-3 text-sm text-on-surface hover:bg-white/60 rounded-full transition-all truncate border border-transparent hover:border-white/40 hover:shadow-sm pr-12" title="${escapedTitle}">
                    ${escapedTitle}
                </button>
                <div onclick="window.deleteAIChatFromHistory(${index}, event)" class="absolute right-6 opacity-0 group-hover:opacity-100 p-2 text-on-surface-variant hover:text-red-500 transition-all cursor-pointer bg-white/40 hover:bg-red-50 rounded-full shadow-sm flex items-center justify-center border border-transparent hover:border-red-200" title="Excluir do histórico">
                    <span class="material-symbols-outlined text-[18px]">delete</span>
                </div>
            </div>
        `;
    }).join('');
    
    aiChatHistoryList.innerHTML = titleHtml + (itemsHtml || '<div class="px-5 py-4 text-[11px] text-on-surface-variant/40 italic text-center">Nenhum chat recente.</div>');
}

function saveAIChat(title) {
    if (!title || title.length < 3) return;
    
    // Clean title (remove newlines and trim)
    const cleanTitle = title.replace(/\n/g, ' ').trim().substring(0, 50);
    
    // Move to top if exists, or add new
    const existingIndex = aiChatHistory.findIndex(c => c.title === cleanTitle);
    if (existingIndex !== -1) {
        aiChatHistory.splice(existingIndex, 1);
    }
    
    aiChatHistory.unshift({ title: cleanTitle, timestamp: Date.now() });
    
    // Limit history to 15 items
    if (aiChatHistory.length > 15) {
        aiChatHistory.pop();
    }
    
    localStorage.setItem('aiChatHistory', JSON.stringify(aiChatHistory));
    renderAIChatHistoryList();
}

function deleteAIChatFromHistory(index, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    aiChatHistory.splice(index, 1);
    localStorage.setItem('aiChatHistory', JSON.stringify(aiChatHistory));
    renderAIChatHistoryList();
}

// Expose delete function to window
window.deleteAIChatFromHistory = deleteAIChatFromHistory;

function addMessageToChat(text, sender, analyzedAccount = null) {
    if (!chatHistory) return;

    const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const isAI = sender === 'ai';

    const msgDiv = document.createElement('div');
    
    if (isAI) {
        msgDiv.className = 'flex gap-6 items-start ai-message-bubble';
        const formattedText = renderAIText(text);
        let badgeHtml = '';
        if (analyzedAccount) {
            badgeHtml = `<div class="mb-2 px-3 py-1 bg-primary/10 text-primary text-[11px] font-bold rounded-full w-fit">Análise por conta: ${escapeHtml(analyzedAccount)}</div>`;
        }
        
        msgDiv.innerHTML = `
            <div class="w-11 h-11 rounded-2xl bg-primary flex-shrink-0 flex items-center justify-center mt-1 shadow-liquid border border-white/20">
                <span class="material-symbols-outlined text-white text-[22px]" style="font-variation-settings: 'FILL' 1;">auto_awesome</span>
            </div>
            <div class="flex-1 space-y-2 pt-1">
                ${badgeHtml}
                <div class="prose prose-slate max-w-none text-[16px] leading-8 text-on-surface font-medium message-body">
                    ${formattedText}
                </div>
            </div>
        `;
    } else {
        msgDiv.className = 'flex flex-col items-end gap-2 group user-message-bubble';
        msgDiv.innerHTML = `
            <div class="bubble-glass-user px-7 py-5 rounded-[2.5rem] rounded-tr-md max-w-[85%] text-[15px] leading-relaxed text-on-surface">
                ${renderUserText(text)}
            </div>
        `;
    }

    chatHistory.appendChild(msgDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight; // Auto scroll
}

function setAIStatus(text, statusClass) {
    if (!aiStatusBadge) return;

    aiStatusBadge.textContent = text;
    aiStatusBadge.className = 'status-badge';

    if (statusClass === 'analyzing') {
        aiStatusBadge.classList.add('status-analyzing');
    } else if (statusClass === 'ready') {
        aiStatusBadge.classList.add('status-ready');
    } else if (statusClass === 'error') {
        aiStatusBadge.classList.add('status-error');
    } else {
        aiStatusBadge.classList.add('status-ready');
    }
}

function initializeAIChat() {
    renderAIChatHistoryList();
    if (!chatHistory || chatHistory.children.length > 0) return;
    setAIStatus('Pronto', 'ready');
}

initializeAIChat();
