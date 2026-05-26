const fs = require('fs');
const path = require('path');
const db = require('./db');
const dbConfig = require('./db_config_service');

const DATA_ROOT = path.join(__dirname, '..', 'api', 'data');
const REQUIRED_TABLES = ['movimentoestoque', 'produto', 'sincprodutoestoque', 'entidade'];

function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toBigIntOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
}

function q(identifier) {
    return String(identifier).split('.').map((part) => `"${part.replace(/"/g, '""')}"`).join('.');
}

function tenantDir() {
    if (!fs.existsSync(DATA_ROOT)) return null;
    const dirs = fs.readdirSync(DATA_ROOT, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => /^\d{8,}$/.test(name))
        .sort();
    return dirs.length ? path.join(DATA_ROOT, dirs[0]) : null;
}

function readJson(file, fallback = []) {
    try {
        return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
    } catch (error) {
        console.error('[StockIntelligence] JSON read failed', { file, message: error.message });
        return fallback;
    }
}

function getFallbackData() {
    const dir = tenantDir();
    if (!dir) return { dir: null, products: [], stock: [], branches: [] };
    return {
        dir,
        products: readJson(path.join(dir, 'products.json')),
        stock: readJson(path.join(dir, 'saldoestoque.json')),
        branches: readJson(path.join(dir, 'filial.json'))
    };
}

function branchOptionsFromJson(branches) {
    return branches.map((row) => {
        const code = String(row.codigo ?? row.id ?? '').trim();
        const name = String(row.nome ?? '').trim();
        return code ? { value: code, label: name ? `${code} - ${name}` : code } : null;
    }).filter(Boolean);
}

function classifyRow(row) {
    if (toNumber(row.stockQty) <= 0) return 'Sem estoque';
    if (toNumber(row.soldQty) <= 0) return 'Sem venda';
    if (toNumber(row.marginPct) <= 0) return 'Margem crítica';
    if (toNumber(row.coverageDays) >= 60) return 'Estoque alto';
    return 'Saudável';
}

function summarize(rows) {
    const totalProducts = rows.length;
    const totalQtdComprada = rows.reduce((sum, row) => sum + toNumber(row.purchasedQty), 0);
    const totalQtdVendida = rows.reduce((sum, row) => sum + toNumber(row.soldQty), 0);
    const totalComprado = rows.reduce((sum, row) => sum + toNumber(row.costTotal), 0);
    const totalVendido = rows.reduce((sum, row) => sum + toNumber(row.saleTotal), 0);
    const lucroBruto = rows.reduce((sum, row) => sum + toNumber(row.profitValue), 0);
    const estoqueAtual = rows.reduce((sum, row) => sum + toNumber(row.stockQty), 0);
    return {
        totalProducts,
        totalQtdComprada,
        totalQtdVendida,
        totalComprado,
        totalVendido,
        lucroBruto,
        margemPercentual: totalVendido > 0 ? (lucroBruto / totalVendido) * 100 : 0,
        estoqueAtual,
        produtosSemGiro: rows.filter((row) => toNumber(row.soldQty) <= 0).length,
        maiorGiro: rows.reduce((max, row) => Math.max(max, toNumber(row.turnover)), 0),
        coberturaEstoque: totalQtdVendida > 0 ? estoqueAtual / (totalQtdVendida / 30) : 0
    };
}

function mergeSummaryWithSnapshot(summary, snapshot = {}) {
    const estoqueAtual = toNumber(snapshot.estoque_atual);
    const valorCusto = toNumber(snapshot.valor_custo);
    const valorVenda = toNumber(snapshot.valor_venda);
    const produtosAnalisados = toNumber(snapshot.produtos_analisados);
    const lucroBruto = valorVenda - valorCusto;
    return {
        ...summary,
        totalProducts: produtosAnalisados || summary.totalProducts,
        estoqueAtual,
        totalComprado: valorCusto,
        totalVendido: valorVenda,
        lucroBruto,
        margemPercentual: valorVenda > 0 ? (lucroBruto / valorVenda) * 100 : 0,
        coberturaEstoque: summary.totalQtdVendida > 0 ? estoqueAtual / (summary.totalQtdVendida / 30) : 0
    };
}

async function checkRequiredTables() {
    const result = await db.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          AND table_name = ANY($1::text[])
    `, [REQUIRED_TABLES]);
    const found = new Set(result.rows.map((row) => row.table_name));
    return REQUIRED_TABLES.filter((name) => !found.has(name));
}

async function stockMapping() {
    const mapping = await dbConfig.getCurrentMapping();
    return mapping?.stockIntelligence || {};
}

async function resolveStructuralMasterFilter(mapping) {
    const tableName = String(mapping.masterProductTable || 'fichatecnicadesagregacao').trim();
    const parentField = String(mapping.masterProductParentField || 'idprodutopai').trim();
    const childField = String(mapping.masterProductChildField || 'idproduto').trim();
    const mode = String(mapping.masterProductMode || 'fichatecnicadesagregacao').trim();
    const result = await db.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
    `, [tableName]);
    const columns = new Set(result.rows.map((row) => String(row.column_name).toLowerCase()));

    if (!result.rows.length) {
        const warning = 'Tabela fichatecnicadesagregacao não encontrada. Filtro estrutural desabilitado.';
        console.warn(`[StockIntelligence] ${warning}`);
        return { enabled: false, mode, tableName, parentField, childField, warning };
    }

    if (!columns.has(parentField.toLowerCase()) || !columns.has(childField.toLowerCase())) {
        const warning = 'Campos estruturais de fichatecnicadesagregacao não encontrados. Filtro estrutural desabilitado.';
        console.warn(`[StockIntelligence] ${warning}`);
        return { enabled: false, mode, tableName, parentField, childField, warning };
    }

    return {
        enabled: true,
        mode,
        tableName,
        parentField,
        childField,
        warning: null
    };
}

function buildMasterProductFilter(alias = 'p', structuralFilter) {
    if (!structuralFilter?.enabled) {
        return '';
    }
    return `
      AND NOT EXISTS (
        SELECT 1
        FROM ${q(structuralFilter.tableName)} ftd
        WHERE ftd.${q(structuralFilter.parentField)} = ${alias}.${q('id')}
      )
    `;
}

function sqlCtx(mapping, structuralFilter) {
    return {
        pt: q(mapping.productTable || 'produto'),
        pId: q(mapping.productIdField || 'id'),
        pCode: q(mapping.productCodeField || 'codigo'),
        pName: q(mapping.productNameField || 'nome'),
        pBar: q(mapping.productBarcodeField || 'ean'),
        pSup: q(mapping.productSupplierField || 'idfornecedor'),
        pGroup: q(mapping.productHierarchyField || 'idhierarquia'),
        pPrice: q(mapping.productSalePriceField || 'preco'),
        pCost: q(mapping.productCostField || 'precocusto'),
        st: q(mapping.supplierTable || 'entidade'),
        sId: q(mapping.supplierIdField || 'id'),
        sName: q(mapping.supplierNameField || 'nome'),
        ht: q(mapping.hierarchyTable || 'hierarquia'),
        hId: q(mapping.hierarchyIdField || 'id'),
        hName: q(mapping.hierarchyNameField || 'nome'),
        mt: q(mapping.movementTable || 'movimentoestoque'),
        mProd: q(mapping.movementProductField || 'idproduto'),
        mBranch: q(mapping.movementBranchField || 'idfilial'),
        mDate: q(mapping.movementDateField || 'data'),
        mDateTime: q(mapping.movementDateTimeField || 'datahora'),
        mIn: q(mapping.movementQtyInField || 'quantidadeentrada'),
        mOut: q(mapping.movementQtyOutField || 'quantidadesaida'),
        mCostTotal: q(mapping.movementCostTotalField || 'custototal'),
        mSaleTotal: q(mapping.movementSaleTotalField || 'valortotal'),
        mCostUnit: q(mapping.movementCostUnitField || 'precocusto'),
        mLastBuy: q(mapping.movementLastPurchasePriceField || 'precoultimacompra'),
        mCanceled: q(mapping.movementCancelledField || 'cancelado'),
        mDoc: q(mapping.movementDocumentTypeField || 'tipodocumento'),
        mOriginal: q(mapping.movementOriginalIdField || 'idoriginal'),
        mOriginalItem: q(mapping.movementOriginalItemField || 'iditemoriginal'),
        mObs: q(mapping.movementObservationField || 'observacao'),
        qt: q(mapping.stockTable || 'sincprodutoestoque'),
        qProd: q(mapping.stockProductField || 'idproduto'),
        qBranch: q(mapping.stockBranchField || 'idfilial'),
        qQty: q(mapping.stockQtyField || 'quantidade'),
        svt: q(mapping.stockSnapshotTable || 'total_estoque_movimento_view'),
        svProd: q(mapping.stockSnapshotProductField || 'idproduto'),
        svBranch: q(mapping.stockSnapshotBranchField || 'idfilial'),
        svQty: q(mapping.stockSnapshotQtyField || 'quantidade'),
        svCostTotal: q(mapping.stockSnapshotCostTotalField || 'totalcusto'),
        svSaleTotal: q(mapping.stockSnapshotSaleTotalField || 'totalvenda'),
        svSalePrice: q(mapping.stockSnapshotSalePriceField || 'precovenda'),
        svCostPrice: q(mapping.stockSnapshotCostPriceField || 'precocusto'),
        structuralTable: q((structuralFilter && structuralFilter.tableName) || mapping.masterProductTable || 'fichatecnicadesagregacao'),
        structuralParentField: q((structuralFilter && structuralFilter.parentField) || mapping.masterProductParentField || 'idprodutopai'),
        structuralChildField: q((structuralFilter && structuralFilter.childField) || mapping.masterProductChildField || 'idproduto'),
        masterFilterSql: buildMasterProductFilter('p', structuralFilter)
    };
}

function mapRow(row) {
    const purchasedQty = toNumber(row.comprado_periodo ?? row.quantidade_comprada);
    const soldQty = toNumber(row.vendido_periodo ?? row.quantidade_vendida);
    const periodBalance = toNumber(row.saldo_periodo);
    const mapped = {
        productId: toBigIntOrNull(row.id_produto),
        productCode: String(row.codigo_produto ?? '').trim(),
        productName: String(row.produto ?? '').trim(),
        barcode: String(row.codigo_barras ?? '').trim(),
        supplierId: toBigIntOrNull(row.id_fornecedor),
        supplierName: String(row.fornecedor ?? '').trim() || 'Sem fornecedor',
        groupId: toBigIntOrNull(row.id_hierarquia),
        groupName: String(row.grupo ?? '').trim() || 'Sem grupo',
        purchasedQty,
        soldQty,
        periodBalance,
        stockQty: toNumber(row.saldo_atual),
        balanceQty: periodBalance,
        avgCost: toNumber(row.preco_custo_snapshot || row.custo_medio_compra || row.preco_custo_atual),
        avgSale: toNumber(row.preco_venda_snapshot || row.preco_venda_medio || row.preco_venda_atual),
        marginPct: toNumber(row.margem_percentual),
        turnover: toNumber(row.giro),
        coverageDays: toNumber(row.cobertura_dias),
        costTotal: toNumber(row.valor_custo_periodo ?? row.valor_custo_total),
        saleTotal: toNumber(row.valor_venda_periodo ?? row.valor_venda_total),
        profitValue: toNumber(row.lucro_bruto_periodo ?? row.lucro_bruto),
        stockCostTotal: toNumber(row.snapshot_valor_custo),
        stockSaleTotal: toNumber(row.snapshot_valor_venda),
        lastPurchase: formatDate(row.ultima_compra),
        lastSale: formatDate(row.ultima_venda),
        lastStockChange: formatDate(row.ultima_alteracao || row.ultima_venda || row.ultima_compra),
        status: ''
    };
    mapped.status = classifyRow(mapped);
    return mapped;
}

function analyticalRowsSql(ctx, hasTerm) {
    const termClause = hasTerm ? `AND (
        p.${ctx.pCode} ILIKE $7
        OR p.${ctx.pName} ILIKE $7
        OR COALESCE(p.${ctx.pBar}, '') ILIKE $7
    )` : '';

    return `
        WITH base AS (
            SELECT
                p.${ctx.pId} AS id_produto,
                p.${ctx.pCode} AS codigo_produto,
                p.${ctx.pName} AS produto,
                p.${ctx.pBar} AS codigo_barras,
                p.${ctx.pSup} AS id_fornecedor,
                f.${ctx.sName} AS fornecedor,
                p.${ctx.pGroup} AS id_hierarquia,
                h.${ctx.hName} AS grupo,
                SUM(COALESCE(me.${ctx.mIn}, 0)) AS comprado_periodo,
                SUM(COALESCE(me.${ctx.mOut}, 0)) AS vendido_periodo,
                SUM(COALESCE(me.${ctx.mIn}, 0)) - SUM(COALESCE(me.${ctx.mOut}, 0)) AS saldo_periodo,
                SUM(CASE WHEN COALESCE(me.${ctx.mOut}, 0) > 0 THEN COALESCE(me.${ctx.mCostTotal}, 0) ELSE 0 END) AS valor_custo_periodo,
                SUM(CASE WHEN COALESCE(me.${ctx.mOut}, 0) > 0 THEN COALESCE(me.${ctx.mSaleTotal}, 0) ELSE 0 END) AS valor_venda_periodo,
                SUM(CASE WHEN COALESCE(me.${ctx.mOut}, 0) > 0 THEN COALESCE(me.${ctx.mSaleTotal}, 0) ELSE 0 END)
                    - SUM(CASE WHEN COALESCE(me.${ctx.mOut}, 0) > 0 THEN COALESCE(me.${ctx.mCostTotal}, 0) ELSE 0 END) AS lucro_bruto_periodo,
                CASE WHEN SUM(COALESCE(me.${ctx.mOut}, 0)) > 0
                    THEN SUM(CASE WHEN COALESCE(me.${ctx.mOut}, 0) > 0 THEN COALESCE(me.${ctx.mSaleTotal}, 0) ELSE 0 END) / SUM(COALESCE(me.${ctx.mOut}, 0))
                    ELSE COALESCE(MAX(p.${ctx.pPrice}), 0) END AS preco_venda_medio,
                CASE WHEN SUM(COALESCE(me.${ctx.mIn}, 0)) > 0
                    THEN SUM(COALESCE(me.${ctx.mCostTotal}, 0)) / SUM(COALESCE(me.${ctx.mIn}, 0))
                    ELSE COALESCE(MAX(p.${ctx.pCost}), 0) END AS custo_medio_compra,
                CASE WHEN SUM(CASE WHEN COALESCE(me.${ctx.mOut}, 0) > 0 THEN COALESCE(me.${ctx.mSaleTotal}, 0) ELSE 0 END) > 0
                    AND SUM(CASE WHEN COALESCE(me.${ctx.mOut}, 0) > 0 THEN COALESCE(me.${ctx.mCostTotal}, 0) ELSE 0 END) > 0
                    THEN ((
                        SUM(CASE WHEN COALESCE(me.${ctx.mOut}, 0) > 0 THEN COALESCE(me.${ctx.mSaleTotal}, 0) ELSE 0 END)
                        - SUM(CASE WHEN COALESCE(me.${ctx.mOut}, 0) > 0 THEN COALESCE(me.${ctx.mCostTotal}, 0) ELSE 0 END)
                    ) / SUM(CASE WHEN COALESCE(me.${ctx.mOut}, 0) > 0 THEN COALESCE(me.${ctx.mSaleTotal}, 0) ELSE 0 END)) * 100
                    ELSE 0 END AS margem_percentual,
                MAX(CASE WHEN COALESCE(me.${ctx.mIn}, 0) > 0 THEN me.${ctx.mDate} END) AS ultima_compra,
                MAX(CASE WHEN COALESCE(me.${ctx.mOut}, 0) > 0 THEN me.${ctx.mDate} END) AS ultima_venda,
                MAX(me.${ctx.mDate}) AS ultima_alteracao,
                MAX(COALESCE(p.${ctx.pCost}, 0)) AS preco_custo_atual,
                MAX(COALESCE(p.${ctx.pPrice}, 0)) AS preco_venda_atual
            FROM ${ctx.mt} me
            JOIN ${ctx.pt} p ON p.${ctx.pId} = me.${ctx.mProd}
            LEFT JOIN ${ctx.st} f ON f.${ctx.sId} = p.${ctx.pSup}
            LEFT JOIN ${ctx.ht} h ON h.${ctx.hId} = p.${ctx.pGroup}
            WHERE COALESCE(me.${ctx.mCanceled}, 0) = 0
              AND me.${ctx.mDate} BETWEEN $1 AND $2
              AND ($3::bigint IS NULL OR me.${ctx.mBranch} = $3)
              AND ($4::bigint IS NULL OR p.${ctx.pId} = $4)
              AND ($5::bigint IS NULL OR p.${ctx.pSup} = $5)
              AND ($6::bigint IS NULL OR p.${ctx.pGroup} = $6)
              ${ctx.masterFilterSql}
              ${termClause}
            GROUP BY p.${ctx.pId}, p.${ctx.pCode}, p.${ctx.pName}, p.${ctx.pBar}, p.${ctx.pSup}, f.${ctx.sName}, p.${ctx.pGroup}, h.${ctx.hName}
        ),
        estoque AS (
            SELECT
                tev.${ctx.svProd} AS id_produto,
                SUM(COALESCE(tev.${ctx.svQty}, 0)) AS saldo_atual,
                SUM(COALESCE(tev.${ctx.svCostTotal}, 0)) AS snapshot_valor_custo,
                SUM(COALESCE(tev.${ctx.svSaleTotal}, 0)) AS snapshot_valor_venda,
                MAX(COALESCE(tev.${ctx.svCostPrice}, 0)) AS preco_custo_snapshot,
                MAX(COALESCE(tev.${ctx.svSalePrice}, 0)) AS preco_venda_snapshot
            FROM ${ctx.svt} tev
            JOIN ${ctx.pt} p ON p.${ctx.pId} = tev.${ctx.svProd}
            WHERE COALESCE(p.inativo, 0) = 0
              AND ($3::bigint IS NULL OR tev.${ctx.svBranch} = $3)
              ${ctx.masterFilterSql}
            GROUP BY tev.${ctx.svProd}
        )
        SELECT
            base.*,
            COALESCE(estoque.saldo_atual, 0) AS estoque_atual,
            COALESCE(estoque.snapshot_valor_custo, 0) AS snapshot_valor_custo,
            COALESCE(estoque.snapshot_valor_venda, 0) AS snapshot_valor_venda,
            COALESCE(estoque.preco_custo_snapshot, 0) AS preco_custo_snapshot,
            COALESCE(estoque.preco_venda_snapshot, 0) AS preco_venda_snapshot,
            CASE WHEN base.vendido_periodo > 0
                THEN COALESCE(estoque.saldo_atual, 0) / NULLIF(base.vendido_periodo / GREATEST(($2::date - $1::date) + 1, 1), 0)
                ELSE 0 END AS cobertura_dias,
            CASE WHEN COALESCE(estoque.saldo_atual, 0) > 0
                THEN base.vendido_periodo / COALESCE(estoque.saldo_atual, 0)
                ELSE 0 END AS giro
        FROM base
        LEFT JOIN estoque ON estoque.id_produto = base.id_produto
        ORDER BY base.vendido_periodo DESC, base.produto ASC
    `;
}

function stockSnapshotSummarySql(ctx) {
    return `
        SELECT
            COUNT(DISTINCT tev.${ctx.svProd}) AS produtos_analisados,
            SUM(COALESCE(tev.${ctx.svQty}, 0)) AS estoque_atual,
            SUM(COALESCE(tev.${ctx.svCostTotal}, 0)) AS valor_custo,
            SUM(COALESCE(tev.${ctx.svSaleTotal}, 0)) AS valor_venda
        FROM ${ctx.svt} tev
        JOIN ${ctx.pt} p ON p.${ctx.pId} = tev.${ctx.svProd}
        WHERE COALESCE(p.inativo, 0) = 0
          AND ($1::bigint IS NULL OR tev.${ctx.svBranch} = $1)
          ${ctx.masterFilterSql}
    `;
}

function stockSnapshotTopValueSql(ctx) {
    return `
        SELECT
            p.${ctx.pId} AS id_produto,
            p.${ctx.pName} AS produto,
            SUM(COALESCE(tev.${ctx.svSaleTotal}, 0)) AS valor_venda
        FROM ${ctx.svt} tev
        JOIN ${ctx.pt} p ON p.${ctx.pId} = tev.${ctx.svProd}
        WHERE COALESCE(p.inativo, 0) = 0
          AND ($1::bigint IS NULL OR tev.${ctx.svBranch} = $1)
          ${ctx.masterFilterSql}
        GROUP BY p.${ctx.pId}, p.${ctx.pName}
        ORDER BY valor_venda DESC NULLS LAST
        LIMIT 5
    `;
}

function stockSnapshotTopMarginSql(ctx) {
    return `
        SELECT
            p.${ctx.pId} AS id_produto,
            p.${ctx.pName} AS produto,
            CASE
                WHEN SUM(COALESCE(tev.${ctx.svSaleTotal}, 0)) > 0
                THEN ((SUM(COALESCE(tev.${ctx.svSaleTotal}, 0)) - SUM(COALESCE(tev.${ctx.svCostTotal}, 0))) / SUM(COALESCE(tev.${ctx.svSaleTotal}, 0))) * 100
                ELSE 0
            END AS margem_potencial
        FROM ${ctx.svt} tev
        JOIN ${ctx.pt} p ON p.${ctx.pId} = tev.${ctx.svProd}
        WHERE COALESCE(p.inativo, 0) = 0
          AND ($1::bigint IS NULL OR tev.${ctx.svBranch} = $1)
          ${ctx.masterFilterSql}
        GROUP BY p.${ctx.pId}, p.${ctx.pName}
        HAVING SUM(COALESCE(tev.${ctx.svSaleTotal}, 0)) > 0
           AND SUM(COALESCE(tev.${ctx.svCostTotal}, 0)) > 0
        ORDER BY margem_potencial DESC NULLS LAST, produto ASC
        LIMIT 5
    `;
}

function periodTopMarginSql(ctx, hasTerm = false) {
    const termClause = hasTerm ? `AND (
        p.${ctx.pCode} ILIKE $4
        OR p.${ctx.pName} ILIKE $4
        OR COALESCE(p.${ctx.pBar}, '') ILIKE $4
    )` : '';

    return `
        SELECT
            p.${ctx.pId} AS id_produto,
            p.${ctx.pName} AS produto,
            CASE
                WHEN SUM(CASE WHEN COALESCE(me.${ctx.mOut}, 0) > 0 THEN COALESCE(me.${ctx.mSaleTotal}, 0) ELSE 0 END) > 0
                 AND SUM(CASE WHEN COALESCE(me.${ctx.mOut}, 0) > 0 THEN COALESCE(me.${ctx.mCostTotal}, 0) ELSE 0 END) > 0
                THEN ((
                    SUM(CASE WHEN COALESCE(me.${ctx.mOut}, 0) > 0 THEN COALESCE(me.${ctx.mSaleTotal}, 0) ELSE 0 END)
                    - SUM(CASE WHEN COALESCE(me.${ctx.mOut}, 0) > 0 THEN COALESCE(me.${ctx.mCostTotal}, 0) ELSE 0 END)
                ) / SUM(CASE WHEN COALESCE(me.${ctx.mOut}, 0) > 0 THEN COALESCE(me.${ctx.mSaleTotal}, 0) ELSE 0 END)) * 100
                ELSE 0
            END AS margem_periodo
        FROM ${ctx.mt} me
        JOIN ${ctx.pt} p ON p.${ctx.pId} = me.${ctx.mProd}
        WHERE COALESCE(me.${ctx.mCanceled}, 0) = 0
          AND me.${ctx.mDate} BETWEEN $1 AND $2
          AND ($3::bigint IS NULL OR me.${ctx.mBranch} = $3)
          ${ctx.masterFilterSql}
          ${termClause}
        GROUP BY p.${ctx.pId}, p.${ctx.pName}
        HAVING SUM(CASE WHEN COALESCE(me.${ctx.mOut}, 0) > 0 THEN COALESCE(me.${ctx.mSaleTotal}, 0) ELSE 0 END) > 0
           AND SUM(CASE WHEN COALESCE(me.${ctx.mOut}, 0) > 0 THEN COALESCE(me.${ctx.mCostTotal}, 0) ELSE 0 END) > 0
        ORDER BY margem_periodo DESC NULLS LAST, produto ASC
        LIMIT 5
    `;
}

function cadastralTopMarginSql(ctx, hasTerm = false) {
    const termClause = hasTerm ? `AND (
        p.${ctx.pCode} ILIKE $2
        OR p.${ctx.pName} ILIKE $2
        OR COALESCE(p.${ctx.pBar}, '') ILIKE $2
    )` : '';

    return `
        SELECT
            p.${ctx.pId} AS id_produto,
            p.${ctx.pName} AS produto,
            ((MAX(COALESCE(p.${ctx.pPrice}, 0)) - MAX(COALESCE(p.${ctx.pCost}, 0))) / NULLIF(MAX(COALESCE(p.${ctx.pPrice}, 0)), 0)) * 100 AS margem_cadastral
        FROM ${ctx.svt} tev
        JOIN ${ctx.pt} p ON p.${ctx.pId} = tev.${ctx.svProd}
        WHERE COALESCE(p.inativo, 0) = 0
          AND ($1::bigint IS NULL OR tev.${ctx.svBranch} = $1)
          AND COALESCE(tev.${ctx.svQty}, 0) > 0
          AND COALESCE(p.${ctx.pCost}, 0) > 0
          AND COALESCE(p.${ctx.pPrice}, 0) > 0
          ${ctx.masterFilterSql}
          ${termClause}
        GROUP BY p.${ctx.pId}, p.${ctx.pName}
        ORDER BY margem_cadastral DESC NULLS LAST, produto ASC
        LIMIT 5
    `;
}

function kpisSql(ctx) {
    return `
        SELECT
            SUM(COALESCE(me.${ctx.mIn}, 0)) AS total_qtd_comprada,
            SUM(COALESCE(me.${ctx.mOut}, 0)) AS total_qtd_vendida,
            SUM(CASE WHEN COALESCE(me.${ctx.mIn}, 0) > 0 THEN COALESCE(me.${ctx.mCostTotal}, 0) ELSE 0 END) AS total_comprado,
            SUM(CASE WHEN COALESCE(me.${ctx.mOut}, 0) > 0 THEN COALESCE(me.${ctx.mSaleTotal}, 0) ELSE 0 END) AS total_vendido,
            SUM(COALESCE(me.${ctx.mSaleTotal}, 0)) - SUM(COALESCE(me.${ctx.mCostTotal}, 0)) AS lucro_bruto,
            CASE WHEN SUM(COALESCE(me.${ctx.mSaleTotal}, 0)) > 0
                THEN ((SUM(COALESCE(me.${ctx.mSaleTotal}, 0)) - SUM(COALESCE(me.${ctx.mCostTotal}, 0))) / SUM(COALESCE(me.${ctx.mSaleTotal}, 0))) * 100
                ELSE 0 END AS margem_percentual
        FROM ${ctx.mt} me
        JOIN ${ctx.pt} p ON p.${ctx.pId} = me.${ctx.mProd}
        WHERE COALESCE(me.${ctx.mCanceled}, 0) = 0
          AND me.${ctx.mDate} BETWEEN $1 AND $2
          AND ($3::bigint IS NULL OR me.${ctx.mBranch} = $3)
          ${ctx.masterFilterSql}
    `;
}

function rankingSupplierSql(ctx) {
    return `
        SELECT
            f.${ctx.sId} AS id_fornecedor,
            f.${ctx.sName} AS fornecedor,
            SUM(COALESCE(me.${ctx.mIn}, 0)) AS quantidade_comprada,
            SUM(COALESCE(me.${ctx.mOut}, 0)) AS quantidade_vendida,
            SUM(CASE WHEN COALESCE(me.${ctx.mIn}, 0) > 0 THEN COALESCE(me.${ctx.mCostTotal}, 0) ELSE 0 END) AS valor_comprado,
            SUM(CASE WHEN COALESCE(me.${ctx.mOut}, 0) > 0 THEN COALESCE(me.${ctx.mSaleTotal}, 0) ELSE 0 END) AS valor_vendido
        FROM ${ctx.mt} me
        JOIN ${ctx.pt} p ON p.${ctx.pId} = me.${ctx.mProd}
        LEFT JOIN ${ctx.st} f ON f.${ctx.sId} = p.${ctx.pSup}
        WHERE COALESCE(me.${ctx.mCanceled}, 0) = 0
          AND me.${ctx.mDate} BETWEEN $1 AND $2
          AND ($3::bigint IS NULL OR me.${ctx.mBranch} = $3)
          ${ctx.masterFilterSql}
        GROUP BY f.${ctx.sId}, f.${ctx.sName}
        ORDER BY valor_vendido DESC NULLS LAST
        LIMIT 20
    `;
}

function rankingGroupSql(ctx) {
    return `
        SELECT
            h.${ctx.hId} AS id_grupo,
            h.${ctx.hName} AS grupo,
            SUM(COALESCE(me.${ctx.mIn}, 0)) AS quantidade_comprada,
            SUM(COALESCE(me.${ctx.mOut}, 0)) AS quantidade_vendida,
            SUM(CASE WHEN COALESCE(me.${ctx.mIn}, 0) > 0 THEN COALESCE(me.${ctx.mCostTotal}, 0) ELSE 0 END) AS valor_comprado,
            SUM(CASE WHEN COALESCE(me.${ctx.mOut}, 0) > 0 THEN COALESCE(me.${ctx.mSaleTotal}, 0) ELSE 0 END) AS valor_vendido
        FROM ${ctx.mt} me
        JOIN ${ctx.pt} p ON p.${ctx.pId} = me.${ctx.mProd}
        LEFT JOIN ${ctx.ht} h ON h.${ctx.hId} = p.${ctx.pGroup}
        WHERE COALESCE(me.${ctx.mCanceled}, 0) = 0
          AND me.${ctx.mDate} BETWEEN $1 AND $2
          AND ($3::bigint IS NULL OR me.${ctx.mBranch} = $3)
          ${ctx.masterFilterSql}
        GROUP BY h.${ctx.hId}, h.${ctx.hName}
        ORDER BY valor_vendido DESC NULLS LAST
        LIMIT 20
    `;
}

function drillDownSql(ctx) {
    return `
        SELECT
            me.${ctx.mDate} AS data,
            me.${ctx.mDateTime} AS datahora,
            me.${ctx.mBranch} AS idfilial,
            me.${ctx.mDoc} AS tipodocumento,
            me.${ctx.mOriginal} AS idoriginal,
            me.${ctx.mOriginalItem} AS iditemoriginal,
            COALESCE(me.${ctx.mIn}, 0) AS entrada,
            COALESCE(me.${ctx.mOut}, 0) AS saida,
            COALESCE(me.${ctx.mCostUnit}, 0) AS custo_unitario,
            COALESCE(me.${ctx.mCostTotal}, 0) AS custo_total,
            COALESCE(me.${ctx.mSaleTotal}, 0) AS valor_total,
            me.${ctx.mObs} AS observacao
        FROM ${ctx.mt} me
        JOIN ${ctx.pt} p ON p.${ctx.pId} = me.${ctx.mProd}
        WHERE COALESCE(me.${ctx.mCanceled}, 0) = 0
          AND me.${ctx.mProd} = $1
          AND me.${ctx.mDate} BETWEEN $2 AND $3
          AND ($4::bigint IS NULL OR me.${ctx.mBranch} = $4)
          ${ctx.masterFilterSql}
        ORDER BY me.${ctx.mDateTime} DESC
    `;
}

async function filterOptionsSql(ctx) {
    const [branches, suppliers, groups] = await Promise.all([
        db.query(`SELECT id, codigo, nome FROM filial ORDER BY nome`),
        db.query(`
            SELECT DISTINCT f.${ctx.sId} AS value, f.${ctx.sName} AS label
            FROM ${ctx.pt} p
            JOIN ${ctx.st} f ON f.${ctx.sId} = p.${ctx.pSup}
            WHERE COALESCE(f.inativo, 0) = 0
              ${ctx.masterFilterSql}
            ORDER BY label
        `),
        db.query(`
            SELECT DISTINCT h.${ctx.hId} AS value, h.${ctx.hName} AS label
            FROM ${ctx.pt} p
            JOIN ${ctx.ht} h ON h.${ctx.hId} = p.${ctx.pGroup}
            WHERE 1 = 1
              ${ctx.masterFilterSql}
            ORDER BY label
        `)
    ]);

    return {
        branches: branches.rows.map((row) => ({
            value: String(row.id),
            label: row.codigo ? `${row.codigo} - ${row.nome}` : row.nome
        })),
        suppliers: suppliers.rows.filter((row) => row.value && row.label).map((row) => ({
            value: String(row.value),
            label: row.label
        })),
        groups: groups.rows.filter((row) => row.value && row.label).map((row) => ({
            value: String(row.value),
            label: row.label
        })),
        statuses: [
            { value: 'Saudável', label: 'Saudável' },
            { value: 'Sem venda', label: 'Sem venda' },
            { value: 'Sem estoque', label: 'Sem estoque' },
            { value: 'Margem crítica', label: 'Margem crítica' },
            { value: 'Estoque alto', label: 'Estoque alto' }
        ]
    };
}

async function buildMasterDiagnostics(ctx, filters, structuralFilter) {
    if (!structuralFilter?.enabled) {
        return {
            enabled: false,
            mode: structuralFilter?.mode || 'fichatecnicadesagregacao',
            table: structuralFilter?.tableName || null,
            parentField: structuralFilter?.parentField || null,
            childField: structuralFilter?.childField || null,
            ignoredParentProducts: 0,
            movementImpact: null,
            stockImpact: null
        };
    }

    const movementParams = [filters.startDate, filters.endDate, toBigIntOrNull(filters.branch)];
    const [ignoredProductsResult, movementImpactResult, stockImpactResult] = await Promise.all([
        db.query(`
            SELECT COUNT(DISTINCT ftd.${ctx.structuralParentField}) AS total
            FROM ${ctx.structuralTable} ftd
        `),
        db.query(`
            WITH sem_filtro AS (
                SELECT
                    COUNT(DISTINCT p.${ctx.pId}) AS produtos,
                    SUM(COALESCE(me.${ctx.mIn}, 0)) AS comprado,
                    SUM(COALESCE(me.${ctx.mOut}, 0)) AS vendido,
                    SUM(COALESCE(me.${ctx.mCostTotal}, 0)) AS custo,
                    SUM(COALESCE(me.${ctx.mSaleTotal}, 0)) AS venda
                FROM ${ctx.mt} me
                JOIN ${ctx.pt} p ON p.${ctx.pId} = me.${ctx.mProd}
                WHERE COALESCE(me.${ctx.mCanceled}, 0) = 0
                  AND me.${ctx.mDate} BETWEEN $1 AND $2
                  AND ($3::bigint IS NULL OR me.${ctx.mBranch} = $3)
            ),
            com_filtro AS (
                SELECT
                    COUNT(DISTINCT p.${ctx.pId}) AS produtos,
                    SUM(COALESCE(me.${ctx.mIn}, 0)) AS comprado,
                    SUM(COALESCE(me.${ctx.mOut}, 0)) AS vendido,
                    SUM(COALESCE(me.${ctx.mCostTotal}, 0)) AS custo,
                    SUM(COALESCE(me.${ctx.mSaleTotal}, 0)) AS venda
                FROM ${ctx.mt} me
                JOIN ${ctx.pt} p ON p.${ctx.pId} = me.${ctx.mProd}
                WHERE COALESCE(me.${ctx.mCanceled}, 0) = 0
                  AND me.${ctx.mDate} BETWEEN $1 AND $2
                  AND ($3::bigint IS NULL OR me.${ctx.mBranch} = $3)
                  ${ctx.masterFilterSql}
            )
            SELECT
                COALESCE(sem_filtro.produtos, 0) AS produtos_antes,
                COALESCE(com_filtro.produtos, 0) AS produtos_depois,
                COALESCE(sem_filtro.comprado, 0) AS comprado_antes,
                COALESCE(com_filtro.comprado, 0) AS comprado_depois,
                COALESCE(sem_filtro.vendido, 0) AS vendido_antes,
                COALESCE(com_filtro.vendido, 0) AS vendido_depois,
                COALESCE(sem_filtro.custo, 0) AS custo_antes,
                COALESCE(com_filtro.custo, 0) AS custo_depois,
                COALESCE(sem_filtro.venda, 0) AS venda_antes,
                COALESCE(com_filtro.venda, 0) AS venda_depois
            FROM sem_filtro, com_filtro
        `, movementParams),
        db.query(`
            WITH sem_filtro AS (
                SELECT SUM(COALESCE(se.${ctx.qQty}, 0)) AS estoque
                FROM ${ctx.qt} se
                WHERE ($1::bigint IS NULL OR se.${ctx.qBranch} = $1)
            ),
            com_filtro AS (
                SELECT SUM(COALESCE(se.${ctx.qQty}, 0)) AS estoque
                FROM ${ctx.qt} se
                JOIN ${ctx.pt} p ON p.${ctx.pId} = se.${ctx.qProd}
                WHERE ($1::bigint IS NULL OR se.${ctx.qBranch} = $1)
                  ${ctx.masterFilterSql}
            )
            SELECT COALESCE(sem_filtro.estoque, 0) AS estoque_antes, COALESCE(com_filtro.estoque, 0) AS estoque_depois
            FROM sem_filtro, com_filtro
        `, [toBigIntOrNull(filters.branch)])
    ]);

    const ignoredProducts = toNumber(ignoredProductsResult.rows[0]?.total);
    console.info(`[StockIntelligence] Produtos pai ignorados: ${ignoredProducts}`);

    return {
        enabled: true,
        mode: structuralFilter.mode,
        table: structuralFilter.tableName,
        parentField: structuralFilter.parentField,
        childField: structuralFilter.childField,
        ignoredParentProducts: ignoredProducts,
        movementImpact: movementImpactResult.rows[0] || null,
        stockImpact: stockImpactResult.rows[0] || null
    };
}

async function loadMasterProductsReport(mapping, structuralFilter) {
    if (!structuralFilter?.enabled) {
        return {
            success: true,
            data: {
                total: 0,
                products: [],
                warning: structuralFilter?.warning || 'Filtro estrutural desabilitado.'
            }
        };
    }

    const productTable = q(mapping.productTable || 'produto');
    const productId = q(mapping.productIdField || 'id');
    const productCode = q(mapping.productCodeField || 'codigo');
    const productName = q(mapping.productNameField || 'nome');
    const result = await db.query(`
        SELECT
            p.${productId} AS id,
            p.${productCode} AS codigo,
            p.${productName} AS nome,
            COUNT(*) AS qtd_filhos
        FROM ${ctxForMaster(mapping, structuralFilter).structuralTable} ftd
        JOIN ${productTable} p ON p.${productId} = ftd.${q(structuralFilter.parentField)}
        GROUP BY p.${productId}, p.${productCode}, p.${productName}
        ORDER BY p.${productName}
    `);

    return {
        success: true,
        data: {
            total: result.rows.length,
            products: result.rows.map((row) => ({
                id: toBigIntOrNull(row.id),
                codigo: String(row.codigo ?? '').trim(),
                nome: String(row.nome ?? '').trim(),
                qtd_filhos: toNumber(row.qtd_filhos)
            }))
        }
    };
}

function ctxForMaster(mapping, structuralFilter) {
    return {
        structuralTable: q((structuralFilter && structuralFilter.tableName) || mapping.masterProductTable || 'fichatecnicadesagregacao')
    };
}

async function loadSqlBundle(filters = {}) {
    const mapping = await stockMapping();
    const structuralFilter = await resolveStructuralMasterFilter(mapping);
    const ctx = sqlCtx(mapping, structuralFilter);
    const branch = toBigIntOrNull(filters.branch);
    const productId = toBigIntOrNull(filters.productId);
    const supplierId = toBigIntOrNull(filters.supplierId);
    const groupId = toBigIntOrNull(filters.groupId);
    const term = String(filters.productTerm ?? '').trim();
    const supplierTerm = String(filters.supplierTerm ?? '').trim().toLowerCase();
    const groupTerm = String(filters.groupTerm ?? '').trim().toLowerCase();
    const status = String(filters.status ?? '').trim();
    const params = [filters.startDate, filters.endDate, branch, productId, supplierId, groupId];
    if (term) params.push(`%${term}%`);

    const [rowsResult, kpisResult, supplierRanking, groupRanking, filterOptions, stockSnapshotSummary, topStockValue, topMargin, periodTopMargin, cadastralTopMargin] = await Promise.all([
        db.query(analyticalRowsSql(ctx, Boolean(term)), params),
        db.query(kpisSql(ctx), [filters.startDate, filters.endDate, branch]),
        db.query(rankingSupplierSql(ctx), [filters.startDate, filters.endDate, branch]),
        db.query(rankingGroupSql(ctx), [filters.startDate, filters.endDate, branch]),
        filterOptionsSql(ctx),
        db.query(stockSnapshotSummarySql(ctx), [branch]),
        db.query(stockSnapshotTopValueSql(ctx), [branch]),
        db.query(stockSnapshotTopMarginSql(ctx), [branch]),
        db.query(periodTopMarginSql(ctx, Boolean(term)), term ? [filters.startDate, filters.endDate, branch, `%${term}%`] : [filters.startDate, filters.endDate, branch]),
        db.query(cadastralTopMarginSql(ctx, Boolean(term)), term ? [branch, `%${term}%`] : [branch])
    ]);

    let rows = rowsResult.rows.map(mapRow);
    if (!supplierId && supplierTerm) {
        rows = rows.filter((row) => String(row.supplierName || '').toLowerCase().includes(supplierTerm));
    }
    if (!groupId && groupTerm) {
        rows = rows.filter((row) => String(row.groupName || '').toLowerCase().includes(groupTerm));
    }
    if (status) {
        rows = rows.filter((row) => row.status === status);
    }

    return {
        ctx,
        structuralFilter,
        rows,
        kpis: kpisResult.rows[0] || {},
        stockSnapshot: stockSnapshotSummary.rows[0] || {},
        supplierRanking: supplierRanking.rows || [],
        groupRanking: groupRanking.rows || [],
        topStockValue: topStockValue.rows || [],
        topMargin: topMargin.rows?.length
            ? topMargin.rows
            : (periodTopMargin.rows?.length ? periodTopMargin.rows : (cadastralTopMargin.rows || [])),
        topMarginSource: topMargin.rows?.length
            ? 'snapshot'
            : (periodTopMargin.rows?.length ? 'period' : (cadastralTopMargin.rows?.length ? 'cadastral' : 'none')),
        filterOptions,
        masterDiagnostics: await buildMasterDiagnostics(ctx, filters, structuralFilter)
    };
}

function fallbackRows(products, stock, branch) {
    const byProductBranch = new Map();
    stock.forEach((row) => {
        const key = `${row.codigoproduto || row.idproduto}::${row.idfilial || ''}`;
        const current = byProductBranch.get(key) || { qty: 0, last: null };
        current.qty += toNumber(row.quantidade);
        current.last = formatDate(row.ultimaalteracao) || current.last;
        byProductBranch.set(key, current);
    });

    return products.map((product) => {
        const code = String(product.sku ?? '').trim();
        const item = branch ? byProductBranch.get(`${code}::${branch}`) : null;
        const stockQty = item ? item.qty : toNumber(product.quantidade_estoque);
        const avgSale = toNumber(product.preco_produto);
        const avgCost = toNumber(product.preco_custo);
        const row = {
            productId: null,
            productCode: code,
            productName: String(product.nome ?? '').trim(),
            barcode: String(product.codigo_ean ?? '').trim(),
            supplierId: null,
            supplierName: 'Não mapeado',
            groupId: null,
            groupName: product.categoria ? `Categoria ${product.categoria}` : 'Sem grupo',
            purchasedQty: 0,
            soldQty: 0,
            stockQty,
            balanceQty: stockQty,
            avgCost,
            avgSale,
            marginPct: avgSale > 0 ? ((avgSale - avgCost) / avgSale) * 100 : 0,
            turnover: 0,
            coverageDays: 0,
            costTotal: avgCost * stockQty,
            saleTotal: avgSale * stockQty,
            profitValue: (avgSale - avgCost) * stockQty,
            lastPurchase: null,
            lastSale: null,
            lastStockChange: item?.last || null,
            status: ''
        };
        row.status = classifyRow(row);
        return row;
    });
}

async function fallbackPayload(filters = {}, mode = 'fallback_local') {
    const data = getFallbackData();
    const rows = fallbackRows(data.products, data.stock, String(filters.branch ?? '').trim())
        .filter((row) => {
            const term = String(filters.productTerm ?? '').trim().toLowerCase();
            const supplierTerm = String(filters.supplierTerm ?? '').trim().toLowerCase();
            const groupTerm = String(filters.groupTerm ?? '').trim().toLowerCase();
            const matchesTerm = !term
                || row.productCode.toLowerCase().includes(term)
                || row.productName.toLowerCase().includes(term)
                || row.barcode.toLowerCase().includes(term);
            const matchesSupplier = !supplierTerm || row.supplierName.toLowerCase().includes(supplierTerm);
            const matchesGroup = !groupTerm || row.groupName.toLowerCase().includes(groupTerm);
            const matchesStatus = !filters.status || row.status === filters.status;
            return matchesTerm && matchesSupplier && matchesGroup && matchesStatus;
        });

    return {
        success: true,
        data: {
            meta: {
                mode,
                tenantPath: data.dir,
                generatedAt: new Date().toISOString(),
                limitations: [
                    'SQL real do ERP indisponível para este carregamento.',
                    'O módulo recuou para products.json + saldoestoque.json.',
                    'Compras, vendas e drill-down detalhado não estão disponíveis no fallback.'
                ]
            },
            summary: { ...summarize(rows), partialAnalytics: true },
            rows,
            charts: {
                topStockValue: [...rows].sort((a, b) => (b.stockQty * b.avgSale) - (a.stockQty * a.avgSale)).slice(0, 5).map((row) => ({ label: row.productName, value: row.stockQty * row.avgSale })),
                topMargin: [...rows].sort((a, b) => b.marginPct - a.marginPct).slice(0, 5).map((row) => ({ label: row.productName, value: row.marginPct })),
                supplierRanking: [],
                groupRanking: []
            },
            filterOptions: {
                branches: branchOptionsFromJson(data.branches),
                suppliers: [],
                groups: [],
                statuses: [
                    { value: 'Saudável', label: 'Saudável' },
                    { value: 'Sem venda', label: 'Sem venda' },
                    { value: 'Sem estoque', label: 'Sem estoque' },
                    { value: 'Margem crítica', label: 'Margem crítica' },
                    { value: 'Estoque alto', label: 'Estoque alto' }
                ]
            }
        }
    };
}

async function loadStockFilterOptions() {
    try {
        const missing = await checkRequiredTables();
        if (missing.length) {
            const data = getFallbackData();
            return {
                success: true,
                data: {
                    branches: branchOptionsFromJson(data.branches),
                    suppliers: [],
                    groups: [],
                    statuses: [
                        { value: 'Saudável', label: 'Saudável' },
                        { value: 'Sem venda', label: 'Sem venda' },
                        { value: 'Sem estoque', label: 'Sem estoque' },
                        { value: 'Margem crítica', label: 'Margem crítica' },
                        { value: 'Estoque alto', label: 'Estoque alto' }
                    ]
                }
            };
        }

        const mapping = await stockMapping();
        const structuralFilter = await resolveStructuralMasterFilter(mapping);
        const ctx = sqlCtx(mapping, structuralFilter);
        return {
            success: true,
            data: await filterOptionsSql(ctx)
        };
    } catch (error) {
        console.error('[StockIntelligence] Filter options failed', error);
        return { success: false, error: error.message };
    }
}

async function loadStockIntelligence(filters = {}) {
    try {
        const missing = await checkRequiredTables();
        if (missing.length) {
            return await fallbackPayload(filters, 'fallback_missing_tables');
        }

        const bundle = await loadSqlBundle(filters);
        const summary = mergeSummaryWithSnapshot(summarize(bundle.rows), bundle.stockSnapshot);
        const limitations = [];
        if (bundle.structuralFilter?.warning) limitations.push(bundle.structuralFilter.warning);
        return {
            success: true,
            data: {
                meta: {
                    mode: 'sql_erp',
                    generatedAt: new Date().toISOString(),
                    limitations,
                    topMarginSource: bundle.topMarginSource,
                    topMarginEmptyReason: bundle.topMarginSource === 'none' ? 'Sem produtos com custo valido para calcular a margem.' : null,
                    masterFilter: {
                        enabled: bundle.structuralFilter?.enabled || false,
                        mode: bundle.masterDiagnostics?.mode || null,
                        table: bundle.masterDiagnostics?.table || null,
                        parentField: bundle.masterDiagnostics?.parentField || null,
                        childField: bundle.masterDiagnostics?.childField || null,
                        ignoredProducts: bundle.masterDiagnostics?.ignoredParentProducts || 0
                    },
                    impact: bundle.masterDiagnostics
                },
                summary: { ...summary, partialAnalytics: false },
                rows: bundle.rows,
                charts: {
                    topStockValue: bundle.topStockValue.map((row) => ({ label: row.produto, value: toNumber(row.valor_venda) })),
                    topMargin: bundle.topMargin.map((row) => ({ label: row.produto, value: toNumber(row.margem_potencial ?? row.margem_periodo ?? row.margem_cadastral) })),
                    supplierRanking: bundle.supplierRanking.map((row) => ({ label: row.fornecedor || 'Sem fornecedor', value: toNumber(row.valor_vendido), purchasedQty: toNumber(row.quantidade_comprada), soldQty: toNumber(row.quantidade_vendida) })),
                    groupRanking: bundle.groupRanking.map((row) => ({ label: row.grupo || 'Sem grupo', value: toNumber(row.valor_vendido), purchasedQty: toNumber(row.quantidade_comprada), soldQty: toNumber(row.quantidade_vendida) }))
                },
                filterOptions: bundle.filterOptions
            }
        };
    } catch (error) {
        console.error('[StockIntelligence] SQL failed, using fallback', error);
        return await fallbackPayload(filters, 'fallback_connection_or_sql_error');
    }
}

async function loadStockKpis(filters = {}) {
    try {
        const missing = await checkRequiredTables();
        if (missing.length) {
            const fallback = await fallbackPayload(filters, 'fallback_missing_tables');
            return { success: true, data: fallback.data.summary };
        }
        const bundle = await loadSqlBundle(filters);
        const summary = mergeSummaryWithSnapshot(summarize(bundle.rows), bundle.stockSnapshot);
        return {
            success: true,
            data: {
                ...summary,
                partialAnalytics: false
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function loadStockDrillDown(productId, filters = {}) {
    try {
        const missing = await checkRequiredTables();
        if (missing.length) {
            return { success: false, error: `Drill-down indisponível. Tabelas ausentes: ${missing.join(', ')}` };
        }
        const mapping = await stockMapping();
        const structuralFilter = await resolveStructuralMasterFilter(mapping);
        const drillCtx = sqlCtx(mapping, structuralFilter);
        const result = await db.query(drillDownSql(drillCtx), [
            toBigIntOrNull(productId),
            filters.startDate,
            filters.endDate,
            toBigIntOrNull(filters.branch)
        ]);
        return {
            success: true,
            data: result.rows.map((row) => ({
                date: formatDate(row.data),
                dateTime: row.datahora,
                branchId: toBigIntOrNull(row.idfilial),
                documentType: row.tipodocumento,
                originalId: row.idoriginal,
                originalItemId: row.iditemoriginal,
                qtyIn: toNumber(row.entrada),
                qtyOut: toNumber(row.saida),
                costUnit: toNumber(row.custo_unitario),
                costTotal: toNumber(row.custo_total),
                saleTotal: toNumber(row.valor_total),
                observation: row.observacao || ''
            }))
        };
    } catch (error) {
        console.error('[StockIntelligence] Drill-down failed', error);
        return { success: false, error: error.message };
    }
}

async function loadStockMasterProducts() {
    try {
        const mapping = await stockMapping();
        const structuralFilter = await resolveStructuralMasterFilter(mapping);
        return await loadMasterProductsReport(mapping, structuralFilter);
    } catch (error) {
        console.error('[StockIntelligence] Master products report failed', error);
        return { success: false, error: error.message };
    }
}

async function loadStockImpact(filters = {}) {
    try {
        const missing = await checkRequiredTables();
        if (missing.length) {
            return { success: false, error: `Impacto indisponível. Tabelas ausentes: ${missing.join(', ')}` };
        }
        const bundle = await loadSqlBundle(filters);
        const impact = bundle.masterDiagnostics || {};
        const movement = impact.movementImpact || {};
        const stock = impact.stockImpact || {};
        return {
            success: true,
            data: {
                before: {
                    products: toNumber(movement.produtos_antes),
                    stock: toNumber(stock.estoque_antes),
                    sales: toNumber(movement.venda_antes),
                    purchased: toNumber(movement.comprado_antes),
                    soldQty: toNumber(movement.vendido_antes),
                    cost: toNumber(movement.custo_antes)
                },
                after: {
                    products: toNumber(movement.produtos_depois),
                    stock: toNumber(stock.estoque_depois),
                    sales: toNumber(movement.venda_depois),
                    purchased: toNumber(movement.comprado_depois),
                    soldQty: toNumber(movement.vendido_depois),
                    cost: toNumber(movement.custo_depois)
                },
                removed_master_products: toNumber(impact.ignoredParentProducts)
            }
        };
    } catch (error) {
        console.error('[StockIntelligence] Impact report failed', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    loadStockIntelligence,
    loadStockKpis,
    loadStockDrillDown,
    loadStockMasterProducts,
    loadStockImpact,
    loadStockFilterOptions,
    getStockIntelligence: loadStockIntelligence
};
