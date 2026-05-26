const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const { getData, getBranches, getAccountHistory, getAIContext } = require('../backend/service');
const { getAIResponse, getPresentationAnalysis } = require('../backend/ai_service');
const { loadStockIntelligence, loadStockKpis, loadStockDrillDown, loadStockMasterProducts, loadStockImpact, loadStockFilterOptions } = require('../backend/stock_intelligence_service');
const sync = require('../backend/sync');
const db = require('../backend/db');
const dbConfig = require('../backend/db_config_service');
const manualExpenseService = require('../backend/manual_expense_service');

let mainWindow;
let tray = null;
let isQuitting = false;
const MAIN_LOG_PREFIX = '[Electron Main]';

process.on('uncaughtException', (error) => {
    console.error(`${MAIN_LOG_PREFIX} uncaughtException`, {
        message: error.message,
        stack: error.stack
    });
});

process.on('unhandledRejection', (reason) => {
    console.error(`${MAIN_LOG_PREFIX} unhandledRejection`, reason);
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1000,
        minHeight: 700,
        title: 'Dashboard Financeiro',
        backgroundColor: '#0f172a',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        },
        autoHideMenuBar: true
    });

    // In production this would be standard file loading, for dev we load the file directly
    mainWindow.loadFile(path.join(__dirname, '../frontend/index.html'));

    // Optional: Open DevTools
    // mainWindow.webContents.openDevTools();

    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        const levels = ['verbose', 'info', 'warning', 'error'];
        const label = levels[level] || `level-${level}`;
        console.log(`[Renderer ${label}] ${message}`, {
            sourceId,
            line
        });
    });

    mainWindow.webContents.on('render-process-gone', (event, details) => {
        console.error(`${MAIN_LOG_PREFIX} Renderer process gone`, details);
    });

    mainWindow.webContents.on('unresponsive', () => {
        console.warn(`${MAIN_LOG_PREFIX} Window became unresponsive`);
    });

    // Handle Close (Minimize to Tray)
    mainWindow.on('close', (event) => {
        console.log(`${MAIN_LOG_PREFIX} Window close requested`, {
            isQuitting,
            hasTray: Boolean(tray)
        });
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            return false;
        }
    });
}

function createTray() {
    // You'd typically use an icon file here (e.g., icon.ico)
    // For now we rely on default or no icon, which might fail if path implies file.
    // If no icon file exists, Tray might not show properly.
    // We will assume 'app_icon.png' exists or use just title if possible (win restriction).
    // Using empty for now or standard electron icon if available?
    // Usually requires an image resource.

    // Attempting to create simple tray
    tray = new Tray(path.join(__dirname, 'icon.png')); // Placeholder path
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Abrir Dashboard', click: () => mainWindow.show() },
        {
            label: 'Sair', click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('Dashboard Financeiro - Sincronizador Ativo');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        mainWindow.show();
    });
}

app.whenReady().then(() => {
    createWindow();

    // Start Background Sync
    // sync.startSyncService().catch(console.error); // Disabled at user request

    // Create Tray (Warning: Needs icon file or it might throw or be invisible)
    // To avoid crash without icon, we'll try/catch or skip if no icon asset yet.
    // Since I don't have an icon, I'll comment out the IMAGE part but enable the logic logic if possible?
    // Electron Tray REQUIRES an image. I will create a dummy empty file or reuse something.
    // I can't create an image easily. I will skip Tray visual creation to avoid crash and just implement background logic (hidden window).
    // The user requested "app ficar em segundo plano". Without Tray icon, user can't restore it easily.
    // I will try to find an icon or warn the user.
    // I'll proceed with Sync logic tied to app ready.
    // I will simulate Tray behavior with just window hide/show if I can.
    // Create Tray (Safe Mode)
    try {
        createTray();
    } catch (err) {
        console.warn('Failed to create Tray icon. Ensure icon.png exists in electron folder.', err.message);
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // If Tray exists, don't quit. If no Tray (error), quit.
    // However, user wants background. So we only quit if explicitly requested (isQuitting)
    // or if not on Darwin.
    // For background app, we effectively do nothing here if we want to stay alive.
    // But without Tray, user can't exit. So safety:
    if (!tray && process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC Handler
ipcMain.handle('get-data', async (event, { startDate, endDate, branch }) => {
    const startedAt = Date.now();
    console.log('[IPC get-data] start', { startDate, endDate, branch });

    try {
        const result = await getData(startDate, endDate, branch);
        console.log('[IPC get-data] done', {
            elapsedMs: Date.now() - startedAt,
            success: Boolean(result?.success),
            error: result?.error || null,
            rows: {
                main: Array.isArray(result?.data?.main) ? result.data.main.length : 0,
                monthly: Array.isArray(result?.data?.monthly) ? result.data.monthly.length : 0,
                top10: Array.isArray(result?.data?.top10) ? result.data.top10.length : 0
            }
        });
        return result;
    } catch (error) {
        console.error('[IPC get-data] failed', {
            elapsedMs: Date.now() - startedAt,
            message: error.message,
            stack: error.stack
        });
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-branches', async () => {
    return await getBranches();
});

ipcMain.handle('get-stock-intelligence', async (event, payload) => {
    return await loadStockIntelligence(payload);
});

ipcMain.handle('get-stock-filter-options', async () => {
    return await loadStockFilterOptions();
});

ipcMain.handle('get-stock-kpis', async (event, payload) => {
    return await loadStockKpis(payload);
});

ipcMain.handle('get-stock-drilldown', async (event, { productId, params }) => {
    return await loadStockDrillDown(productId, params);
});

ipcMain.handle('get-stock-master-products', async () => {
    return await loadStockMasterProducts();
});

ipcMain.handle('get-stock-impact', async (event, payload) => {
    return await loadStockImpact(payload);
});

ipcMain.handle('get-account-history', async (event, { startDate, endDate, branch, accountId }) => {
    return await getAccountHistory(startDate, endDate, branch, accountId);
});

ipcMain.handle('manual-list-accounts', async () => await manualExpenseService.listAccounts());
ipcMain.handle('manual-create-account', async (event, payload) => await manualExpenseService.createAccount(payload));
ipcMain.handle('manual-update-account', async (event, { id, payload }) => await manualExpenseService.updateAccount(id, payload));
ipcMain.handle('manual-delete-account', async (event, id) => await manualExpenseService.deleteAccount(id));
ipcMain.handle('manual-list-expenses', async (event, filters) => await manualExpenseService.listExpenses(filters));
ipcMain.handle('manual-create-expense', async (event, payload) => await manualExpenseService.createExpense(payload));
ipcMain.handle('manual-update-expense', async (event, { id, payload }) => await manualExpenseService.updateExpense(id, payload));
ipcMain.handle('manual-delete-expense', async (event, id) => await manualExpenseService.deleteExpense(id));

ipcMain.handle('ai-chat', async (event, { message, context }) => {
    try {
        // 1. Get Financial Context (BASE)
        const contextResult = await getAIContext(context.startDate, context.endDate, context.branch);

        if (!contextResult.success) {
            throw new Error("Falha ao gerar contexto financeiro: " + contextResult.error);
        }

        // 2. Check for Connection-Specific API Key
        const activeConnResult = await dbConfig.getActiveConnection();
        const overrideApiKey = activeConnResult.success ? activeConnResult.data?.apiKey : null;

        // 3. Call AI Service with streaming callback and optional override Key
        const aiResponse = await getAIResponse(message, contextResult.data, (chunk) => {
            event.sender.send('ai-stream-chunk', chunk);
        }, overrideApiKey);

        // aiResponse is now object { text, analyzedAccount }
        return {
            success: true,
            answer: aiResponse.text,
            analyzedAccount: aiResponse.analyzedAccount
        };

    } catch (err) {
        console.error("IPC AI Error:", err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('ai-presentation', async (event, payload) => {
    const startedAt = Date.now();
    const { startDate, endDate, branch, branchLabel, dashboardData } = payload || {};
    console.log('[IPC ai-presentation] start', { startDate, endDate, branch, branchLabel });

    try {
        const contextResult = await getAIContext(startDate, endDate, branch);

        if (!contextResult.success) {
            throw new Error("Falha ao gerar contexto financeiro: " + contextResult.error);
        }

        const activeConnResult = await dbConfig.getActiveConnection();
        const overrideApiKey = activeConnResult.success ? activeConnResult.data?.apiKey : null;
        const aiResult = await getPresentationAnalysis({
            filters: { startDate, endDate, branch },
            branchLabel,
            dashboardData,
            financialContext: contextResult.data
        }, overrideApiKey);

        console.log('[IPC ai-presentation] done', {
            elapsedMs: Date.now() - startedAt,
            success: Boolean(aiResult?.success),
            error: aiResult?.error || null,
            insights: Array.isArray(aiResult?.analysis?.insights) ? aiResult.analysis.insights.length : 0,
            risks: Array.isArray(aiResult?.analysis?.risks) ? aiResult.analysis.risks.length : 0,
            actions: Array.isArray(aiResult?.analysis?.actionPlan) ? aiResult.analysis.actionPlan.length : 0
        });

        return aiResult;
    } catch (err) {
        console.error('[IPC ai-presentation] failed', {
            elapsedMs: Date.now() - startedAt,
            message: err.message,
            stack: err.stack
        });
        return { success: false, error: err.message };
    }
});

// Database Config IPC Handlers
ipcMain.handle('db-get-supported-types', async () => await dbConfig.getSupportedTypes());
ipcMain.handle('db-list-connections', async () => await dbConfig.listConnections());
ipcMain.handle('db-upsert-connection', async (event, payload) => await dbConfig.upsertConnection(payload));
ipcMain.handle('db-test-connection', async (event, payload) => await dbConfig.testConnection(payload));
ipcMain.handle('db-delete-connection', async (event, id) => await dbConfig.deleteConnection(id));
ipcMain.handle('db-set-active-connection', async (event, id) => {
    const result = await dbConfig.setActiveConnection(id);
    if (result.success) {
        db.resetPool();
    }
    return result;
});
ipcMain.handle('db-get-schema', async (event, id) => await dbConfig.getSchema(id));
ipcMain.handle('db-get-mapping-template', async (event, id) => await dbConfig.getMappingTemplate(id));
ipcMain.handle('db-save-mapping', async (event, payload) => await dbConfig.saveMapping(payload));
