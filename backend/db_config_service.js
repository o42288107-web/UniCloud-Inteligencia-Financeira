const { Pool } = require('pg');

let Store;
(async () => {
    const { default: electronStore } = await import('electron-store');
    Store = electronStore;
})();

class DbConfigService {
    constructor() {
        this.store = null;
        this.defaultMapping = {
            faturamento: {
                table: 'vendas_cabecalho_view',
                valueCol: 'valortotal',
                dateCol: 'emissao',
                branchCol: 'filial'
            },
            despesas: {
                table: 'contacorrentelancamento',
                valueCol: 'valor',
                dateCol: 'datahora',
                branchCol: 'idfilial',
                accountCol: 'idplanocontas',
                accountNameCol: 'conta',
                expenseType: '2'
            },
            stockIntelligence: {
                productTable: 'produto',
                productIdField: 'id',
                productCodeField: 'codigo',
                productNameField: 'nome',
                productBarcodeField: 'ean',
                productSupplierField: 'idfornecedor',
                productHierarchyField: 'idhierarquia',
                productSalePriceField: 'preco',
                productCostField: 'precocusto',
                masterProductMode: 'fichatecnicadesagregacao',
                masterProductTable: 'fichatecnicadesagregacao',
                masterProductParentField: 'idprodutopai',
                masterProductChildField: 'idproduto',
                supplierTable: 'entidade',
                supplierIdField: 'id',
                supplierNameField: 'nome',
                hierarchyTable: 'hierarquia',
                hierarchyIdField: 'id',
                hierarchyNameField: 'nome',
                movementTable: 'movimentoestoque',
                movementProductField: 'idproduto',
                movementBranchField: 'idfilial',
                movementDateField: 'data',
                movementDateTimeField: 'datahora',
                movementQtyInField: 'quantidadeentrada',
                movementQtyOutField: 'quantidadesaida',
                movementCostTotalField: 'custototal',
                movementSaleTotalField: 'valortotal',
                movementCostUnitField: 'precocusto',
                movementLastPurchasePriceField: 'precoultimacompra',
                movementCancelledField: 'cancelado',
                movementDocumentTypeField: 'tipodocumento',
                movementOriginalIdField: 'idoriginal',
                movementOriginalItemField: 'iditemoriginal',
                movementObservationField: 'observacao',
                stockTable: 'sincprodutoestoque',
                stockProductField: 'idproduto',
                stockBranchField: 'idfilial',
                stockQtyField: 'quantidade',
                stockSnapshotTable: 'total_estoque_movimento_view',
                stockSnapshotProductField: 'idproduto',
                stockSnapshotBranchField: 'idfilial',
                stockSnapshotQtyField: 'quantidade',
                stockSnapshotCostTotalField: 'totalcusto',
                stockSnapshotSaleTotalField: 'totalvenda',
                stockSnapshotSalePriceField: 'precovenda',
                stockSnapshotCostPriceField: 'precocusto'
            }
        };
    }

    mergeMapping(mapping = {}) {
        return {
            ...this.defaultMapping,
            ...mapping,
            faturamento: {
                ...this.defaultMapping.faturamento,
                ...(mapping.faturamento || {})
            },
            despesas: {
                ...this.defaultMapping.despesas,
                ...(mapping.despesas || {})
            },
            stockIntelligence: {
                ...this.defaultMapping.stockIntelligence,
                ...(mapping.stockIntelligence || {})
            }
        };
    }

    async _getStore() {
        if (this.store) return this.store;

        try {
            if (!Store) {
                const { default: electronStore } = await import('electron-store');
                Store = electronStore;
            }
            this.store = new Store({
                name: 'db-config',
                projectName: 'despesas-x-faturamento'
            });

            // Seed default if missing
            const connections = this.store.get('connections', []);
            const hasDefault = connections.some(c => c.id === 'default');
            
            if (!hasDefault) {
                const defaultConn = {
                    id: 'default',
                    name: 'Perfil Padrão (.env)',
                    type: 'postgres',
                    host: process.env.DB_HOST || 'localhost',
                    port: Number(process.env.DB_PORT || 5432),
                    database: process.env.DB_NAME || 'unico',
                    user: process.env.DB_USER || 'postgres',
                    password: process.env.DB_PASSWORD || 'postgres',
                    ssl: false
                };
                connections.push(defaultConn);
                this.store.set('connections', connections);
                
                // Set as active if no active exists
                if (!this.store.get('activeId')) {
                    this.store.set('activeId', 'default');
                }

                // Seed default mapping matching queries.js exactly
                const mappings = this.store.get('mappings', {});
                if (!mappings['default']) {
                    mappings['default'] = this.defaultMapping;
                    this.store.set('mappings', mappings);
                }
            }
        } catch (err) {
            console.error('[DbConfigService] Failed to init store:', err);
            // Non-critical: methods calling _getStore will fail gracefully or return empty
        }
        return this.store;
    }

    async getSupportedTypes() {
        return {
            success: true,
            data: [
                { type: 'postgres', label: 'PostgreSQL', defaultPort: 5432, installed: true }
            ]
        };
    }

    async getActiveConnection() {
        const store = await this._getStore();
        if (!store) return { success: false, error: 'Store not initialized' };
        
        const connections = store.get('connections', []);
        const activeId = store.get('activeId', null);
        
        if (!activeId) return { success: false, error: 'No active connection' };
        
        const active = connections.find(c => c.id === activeId);
        return { success: !!active, data: active || null };
    }

    async listConnections() {
        const store = await this._getStore();
        const connections = store.get('connections', []);
        const activeConnectionId = store.get('activeId', null);
        return { 
            success: true, 
            data: { 
                connections, 
                activeConnectionId 
            } 
        };
    }

    async upsertConnection(payload) {
        try {
            const store = await this._getStore();
            const connections = store.get('connections', []);
            
            let id = payload.id;
            if (id) {
                const index = connections.findIndex(c => c.id === id);
                if (index !== -1) {
                    connections[index] = { ...connections[index], ...payload };
                } else {
                    connections.push(payload);
                }
            } else {
                id = `conn_${Date.now()}`;
                connections.push({ ...payload, id });
            }

            store.set('connections', connections);

            if (payload.setActive) {
                store.set('activeId', id);
            }

            return { success: true, data: { id } };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async deleteConnection(id) {
        try {
            const store = await this._getStore();
            let connections = store.get('connections', []);
            connections = connections.filter(c => c.id !== id);
            store.set('connections', connections);
            
            if (store.get('activeId') === id) {
                store.delete('activeId');
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async setActiveConnection(id) {
        try {
            const store = await this._getStore();
            store.set('activeId', id);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async testConnection(payload) {
        let pool;
        try {
            pool = new Pool({
                user: payload.user,
                host: payload.host,
                database: payload.database,
                password: payload.password,
                port: payload.port,
                ssl: payload.ssl ? { rejectUnauthorized: false } : false,
                connectionTimeoutMillis: 5000
            });

            await pool.query('SELECT 1');
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        } finally {
            if (pool) await pool.end();
        }
    }

    async getSchema(id) {
        const store = await this._getStore();
        const connections = store.get('connections', []);
        const conn = connections.find(c => c.id === id);
        if (!conn) return { success: false, error: 'Conexão não encontrada.' };

        let pool;
        try {
            pool = new Pool({
                ...conn,
                ssl: conn.ssl ? { rejectUnauthorized: false } : false,
                connectionTimeoutMillis: 10000
            });

            const query = `
                SELECT 
                    table_schema || '.' || table_name as "fullName",
                    table_name as "name",
                    array_agg(column_name::text ORDER BY ordinal_position) as "columns"
                FROM information_schema.columns
                WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
                GROUP BY table_schema, table_name
                ORDER BY table_schema, table_name;
            `;

            const res = await pool.query(query);
            return { success: true, data: { tables: res.rows } };
        } catch (error) {
            return { success: false, error: error.message };
        } finally {
            if (pool) await pool.end();
        }
    }

    async getMappingTemplate(id) {
        const store = await this._getStore();
        const mappings = store ? store.get('mappings', {}) : {};
        
        // Dashboard expects an object with definition and mapping
        return { 
            success: true, 
            data: {
                definition: [
                    { key: 'faturamento', label: 'Tabela de Faturamento', tablePath: 'faturamento.table', columns: [
                        { label: 'Valor', path: 'faturamento.valueCol' },
                        { label: 'Data', path: 'faturamento.dateCol' },
                        { label: 'Filial', path: 'faturamento.branchCol' }
                    ]},
                    { key: 'despesas', label: 'Tabela de Despesas', tablePath: 'despesas.table', columns: [
                        { label: 'Valor', path: 'despesas.valueCol' },
                        { label: 'Data', path: 'despesas.dateCol' },
                        { label: 'Filial', path: 'despesas.branchCol' },
                        { label: 'Conta (ID)', path: 'despesas.accountCol' },
                        { label: 'Nome da Conta', path: 'despesas.accountNameCol' },
                        { label: 'Tipo de Conta Despesa (Flag)', path: 'despesas.expenseType' }
                    ]},
                    { key: 'stockIntelligence', label: 'Estoque Inteligente', tablePath: 'stockIntelligence.productTable', columns: [
                        { label: 'Tabela Produto', path: 'stockIntelligence.productTable' },
                        { label: 'ID Produto', path: 'stockIntelligence.productIdField' },
                        { label: 'Código Produto', path: 'stockIntelligence.productCodeField' },
                        { label: 'Nome Produto', path: 'stockIntelligence.productNameField' },
                        { label: 'Código de Barras', path: 'stockIntelligence.productBarcodeField' },
                        { label: 'Fornecedor do Produto', path: 'stockIntelligence.productSupplierField' },
                        { label: 'Hierarquia do Produto', path: 'stockIntelligence.productHierarchyField' },
                        { label: 'Preço de Venda', path: 'stockIntelligence.productSalePriceField' },
                        { label: 'Preço de Custo', path: 'stockIntelligence.productCostField' },
                        { label: 'Modo Produto Mestre', path: 'stockIntelligence.masterProductMode' },
                        { label: 'Tabela Produto Mestre', path: 'stockIntelligence.masterProductTable' },
                        { label: 'Campo Produto Pai', path: 'stockIntelligence.masterProductParentField' },
                        { label: 'Campo Produto Filho', path: 'stockIntelligence.masterProductChildField' },
                        { label: 'Tabela Fornecedor', path: 'stockIntelligence.supplierTable' },
                        { label: 'ID Fornecedor', path: 'stockIntelligence.supplierIdField' },
                        { label: 'Nome Fornecedor', path: 'stockIntelligence.supplierNameField' },
                        { label: 'Tabela Hierarquia', path: 'stockIntelligence.hierarchyTable' },
                        { label: 'ID Hierarquia', path: 'stockIntelligence.hierarchyIdField' },
                        { label: 'Nome Hierarquia', path: 'stockIntelligence.hierarchyNameField' },
                        { label: 'Tabela Movimentação', path: 'stockIntelligence.movementTable' },
                        { label: 'Produto na Movimentação', path: 'stockIntelligence.movementProductField' },
                        { label: 'Filial na Movimentação', path: 'stockIntelligence.movementBranchField' },
                        { label: 'Data da Movimentação', path: 'stockIntelligence.movementDateField' },
                        { label: 'Data/Hora da Movimentação', path: 'stockIntelligence.movementDateTimeField' },
                        { label: 'Quantidade Entrada', path: 'stockIntelligence.movementQtyInField' },
                        { label: 'Quantidade Saída', path: 'stockIntelligence.movementQtyOutField' },
                        { label: 'Custo Total', path: 'stockIntelligence.movementCostTotalField' },
                        { label: 'Valor Total Venda', path: 'stockIntelligence.movementSaleTotalField' },
                        { label: 'Custo Unitário', path: 'stockIntelligence.movementCostUnitField' },
                        { label: 'Preço Última Compra', path: 'stockIntelligence.movementLastPurchasePriceField' },
                        { label: 'Cancelado', path: 'stockIntelligence.movementCancelledField' },
                        { label: 'Tipo Documento', path: 'stockIntelligence.movementDocumentTypeField' },
                        { label: 'ID Original', path: 'stockIntelligence.movementOriginalIdField' },
                        { label: 'ID Item Original', path: 'stockIntelligence.movementOriginalItemField' },
                        { label: 'Observação', path: 'stockIntelligence.movementObservationField' },
                        { label: 'Tabela Estoque', path: 'stockIntelligence.stockTable' },
                        { label: 'Produto no Estoque', path: 'stockIntelligence.stockProductField' },
                        { label: 'Filial no Estoque', path: 'stockIntelligence.stockBranchField' },
                        { label: 'Quantidade Estoque', path: 'stockIntelligence.stockQtyField' },
                        { label: 'View Snapshot Estoque', path: 'stockIntelligence.stockSnapshotTable' },
                        { label: 'Produto Snapshot Estoque', path: 'stockIntelligence.stockSnapshotProductField' },
                        { label: 'Filial Snapshot Estoque', path: 'stockIntelligence.stockSnapshotBranchField' },
                        { label: 'Quantidade Snapshot', path: 'stockIntelligence.stockSnapshotQtyField' },
                        { label: 'Total Custo Snapshot', path: 'stockIntelligence.stockSnapshotCostTotalField' },
                        { label: 'Total Venda Snapshot', path: 'stockIntelligence.stockSnapshotSaleTotalField' }
                    ]}
                ],
                mapping: this.mergeMapping(mappings[id] || {})
            }
        };
    }

    async saveMapping(payload) {
        try {
            const { connectionId, mapping } = payload;
            const store = await this._getStore();
            const mappings = store.get('mappings', {});
            mappings[connectionId] = mapping;
            store.set('mappings', mappings);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getCurrentMapping() {
        const store = await this._getStore();
        if (!store) {
            return this.defaultMapping;
        }
        const activeId = store.get('activeId');
        if (!activeId) return this.defaultMapping;
        const mappings = store.get('mappings', {});
        return this.mergeMapping(mappings[activeId] || {});
    }
}

module.exports = new DbConfigService();
