const axios = require('axios');
const { getAccountDetails } = require('./service');
require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const MODEL = process.env.AI_MODEL || "minimax/minimax-m2.5:free";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_REFERER = process.env.OPENROUTER_HTTP_REFERER || "http://localhost";
const OPENROUTER_APP_TITLE = process.env.OPENROUTER_APP_TITLE || "UniCloud - Custos Operacionais";
const OPENROUTER_MAX_RETRIES = 1;

const SYSTEM_PROMPT = `
Você é um Analista Financeiro Virtual experiente e objetivo assistindo o gestor de uma empresa.
Seu objetivo é analisar os dados financeiros fornecidos (Contexto) e responder às perguntas do usuário.

REGRAS:
1. Responda de forma direta e concisa. Evite "embromação".
2. Use os números do Contexto para embasar suas respostas. Cite valores e % explicitamente.
3. Se o Contexto não tiver a informação, diga "Não tenho dados suficientes para responder a essa pergunta específica com o pacote atual." e sugira o que falta (ex: "preciso de detalhe por dia").
4. Formate a resposta usando Markdown para clareza (títulos, negrito, listas).
5. Se for solicitado "Insights" ou "Alertas", procure por:
    - Variações bruscas de despesa ou faturamento.
    - Categorias que representam grande parte dos custos.
    - Margem de "lucro" (Faturamento - Despesas).
6. Não dê conselhos legais ou tributários complexos, foque na gestão de fluxo de caixa e controle.
7. Quando a resposta usar dados de origem manual, diga isso explicitamente usando os termos "manual", "ERP" ou "consolidado", conforme o caso.
8. Quando houver mistura entre lançamentos do ERP e lançamentos manuais, deixe claro o que veio de cada origem antes de apresentar o total consolidado.
9. Quando mencionar uma transação detalhada, inclua a origem do dado ('manual' ou 'erp') se essa informação estiver no Contexto.

ESTRUTURA DO CONTEXTO (JSON):
- summary: Totais agregados (Faturamento, Despesa) do período.
- montlyTrend: Série histórica mensal do período.
- topExpenses: Top categorias de despesa do período.
- expenses: Totais de despesas ERP, manual e consolidado; pode incluir 'manualExpenses'.
- manualAccounts: Contas locais criadas manualmente no app.
- detailedTransactions: Transações detalhadas com possível origem 'erp' ou 'manual'.
- detailContext: (OPCIONAL) Contém transações detalhadas de uma conta específica ("focusAccount"). USE ISSO para responder "quem", "quanto", "quando", "documento" e "origem" para essa conta.

Responda sempre em Português do Brasil.
`;

// Intent Detection Support
const INTENT_KEYWORDS = [
    'quem', 'qual', 'detalhe', 'maior', 'salário', 'folha',
    'pagamento', 'fornecedor', 'cliente', 'recebeu', 'gastou', 'listar'
];

const SYNONYMS = {

    /* =======================
       PESSOAL / FOLHA / RH
    ======================= */
    'salario': 'Salários',
    'salarios': 'Salários',
    'salário': 'Salários',
    'salários': 'Salários',
    'folha': 'Salários',
    'folha pagamento': 'Salários',
    'pagamento pessoal': 'Salários',
    'pessoal': 'Salários',
    'funcionario': 'Salários',
    'funcionarios': 'Salários',
    'funcionário': 'Salários',
    'funcionários': 'Salários',
    'empregado': 'Salários',
    'empregados': 'Salários',
    'colaborador': 'Salários',
    'colaboradores': 'Salários',
    'rh': 'Salários',

    'decimo terceiro': '13º Salário',
    '13 salario': '13º Salário',
    '13º': '13º Salário',
    'gratificacao natalina': '13º Salário',

    'ferias': 'Férias',
    'férias': 'Férias',
    'descanso': 'Férias',

    'hora extra': 'Horas extras',
    'horas extras': 'Horas extras',
    'extra': 'Horas extras',

    'rescisao': 'Rescisão',
    'rescisão': 'Rescisão',
    'demissao': 'Rescisão',
    'demissão': 'Rescisão',

    'vale alimentacao': 'Vale alimentação',
    'vale refeicao': 'Plano refeição',
    'refeicao': 'Plano refeição',
    'refeição': 'Plano refeição',
    'alimentacao funcionario': 'Vale alimentação',
    'alimentação funcionario': 'Vale alimentação',

    'vale transporte': 'Vale transporte',
    'vt': 'Vale transporte',
    'onibus': 'Vale transporte',
    'ônibus': 'Vale transporte',

    'plano saude': 'Plano de saúde',
    'plano saúde': 'Plano de saúde',
    'saude': 'Plano de saúde',
    'saúde': 'Plano de saúde',

    /* =======================
       ENCARGOS / IMPOSTOS
    ======================= */
    'fgts': 'FGTS',
    'fundo garantia': 'FGTS',
    'multa fgts': 'FGTS - Multa FGTS',

    'inss': 'INSS - nada 2',
    'previdencia': 'INSS - nada 2',
    'previdência': 'INSS - nada 2',

    'irrf': 'IRRF Retido',
    'imposto renda': 'IRRF Retido',
    'darf': 'DARF INSS/IRRF',

    'iptu': 'IPTU',
    'ipva': 'IPVA',
    'taxas detran': 'TAXAS DETRAN',

    /* =======================
       ENERGIA / ÁGUA / GÁS
    ======================= */
    'luz': 'Luz',
    'energia': 'Luz',
    'energia eletrica': 'Luz',
    'energia elétrica': 'Luz',

    'agua': 'Agua',
    'água': 'Agua',

    'gas': 'Gás',
    'gás': 'Gás',
    'glp': 'Gás',

    /* =======================
       TELECOM / INTERNET
    ======================= */
    'internet': 'Internet',
    'wifi': 'Internet',
    'wi-fi': 'Internet',
    'banda larga': 'Internet',

    'telefone': 'Telefone movel',
    'celular': 'Telefone movel',
    'telefone movel': 'Telefone movel',
    'telefone móvel': 'Telefone movel',
    'telefonia': 'Telefone movel',

    /* =======================
       IMÓVEIS / ALUGUEL
    ======================= */
    'aluguel': 'Aluguel',
    'locacao': 'Aluguel',
    'locação': 'Aluguel',
    'ponto comercial': 'Aluguel',

    'condominio': 'Condomínio',
    'condomínio': 'Condomínio',

    'imovel': 'Imoveis',
    'imóvel': 'Imoveis',
    'imoveis': 'Imoveis',
    'imóveis': 'Imoveis',

    /* =======================
       VEÍCULOS / TRANSPORTE
    ======================= */
    'veiculo': 'Veiculos',
    'veiculo empresa': 'Veiculos',
    'carro': 'Veiculos',
    'caminhao': 'Veiculos',
    'caminhão': 'Veiculos',
    'moto': 'Veiculos',

    'combustivel': 'Combustiveis e Lubrificantes',
    'combustível': 'Combustiveis e Lubrificantes',
    'diesel': 'Combustiveis e Lubrificantes',
    'gasolina': 'Combustiveis e Lubrificantes',
    'etanol': 'Combustiveis e Lubrificantes',

    'frete': 'Fretes',
    'fretes': 'Fretes',
    'entrega': 'Fretes',

    /* =======================
       CARTÕES / BANCOS
    ======================= */
    'cartao': 'Taxas de Cartão',
    'cartão': 'Taxas de Cartão',
    'credito': 'Taxas de Cartão',
    'crédito': 'Taxas de Cartão',
    'debito': 'Taxas de Cartão',
    'débito': 'Taxas de Cartão',
    'maquininha': 'Aluguel Maquininhas',

    'tarifa bancaria': 'Tarifas bancárias',
    'tarifas bancarias': 'Tarifas bancárias',
    'juros': 'Juros bancários',
    'juros boleto': 'Juros Pagos (boletos)',

    /* =======================
       CONTABIL / JURIDICO
    ======================= */
    'contador': 'Contabilidade Externa',
    'contabilidade': 'Contabilidade Externa',

    'advogado': 'Advogados externos',
    'juridico': 'Advogados externos',
    'jurídico': 'Advogados externos',

    /* =======================
       MANUTENÇÃO / EQUIPAMENTOS
    ======================= */
    'manutencao': 'Manutenção',
    'manutenção': 'Manutenção',
    'conserto': 'Manutenção',
    'reparo': 'Manutenção',

    'equipamento': 'Maquinas e Equipamentos',
    'maquina': 'Maquinas e Equipamentos',
    'máquina': 'Maquinas e Equipamentos',

    'balanca': 'Manutenção Balança',
    'balança': 'Manutenção Balança',

    'camara fria': 'Manutenção e concerto camara fria',
    'câmara fria': 'Manutenção e concerto camara fria',

    'gerador': 'CONSERTO E MANUNTENCAO GERADOR',

    /* =======================
       LIMPEZA / MATERIAIS
    ======================= */
    'limpeza': 'Material de limpeza',
    'higiene': 'Material de limpeza',
    'material limpeza': 'Material de limpeza',

    'material escritorio': 'Material de escritório',
    'papelaria': 'Material de escritório',

    'uso consumo': 'Material de Uso e Consumo',
    'consumo': 'Material de Uso e Consumo',

    /* =======================
       TI / SOFTWARE
    ======================= */
    'informatica': 'Informática e TI',
    'ti': 'Informática e TI',
    'tecnologia': 'Informática e TI',

    'software': 'Software',
    'sistema': 'Software',
    'licenca software': 'Software',

    /* =======================
       MARKETING / SERVIÇOS
    ======================= */
    'propaganda': 'Propaganda',
    'publicidade': 'Propaganda e Publicidade',
    'marketing': 'Propaganda e Publicidade',

    'servico': 'Prestadores de serviço',
    'serviço': 'Prestadores de serviço',
    'terceirizado': 'Prestação de Serviço Tercerizado',

    /* =======================
       OUTROS / GENÉRICOS
    ======================= */
    'outros': 'Outros',
    'diversos': 'Outras Despesas Operacionais',
    'despesa diversa': 'Outras Despesas Operacionais',
    'despesas diversas': 'Outras Despesas Operacionais',

    'erro pagamento': 'Pagamento Conta Errada',
    'pagamento errado': 'Pagamento Conta Errada',
    'duplicado': 'Pagamento duplicado de boleto',

    'ajuste': 'Ajuste de Saldo',
    'ajuste saldo': 'Ajuste de Saldo'
};

function analyzeIntent(message) {
    const lower = message.toLowerCase();
    return INTENT_KEYWORDS.some(kw => lower.includes(kw));
}

function resolveAccount(message, accountsIndex) {
    if (!accountsIndex || accountsIndex.length === 0) return null;
    const lowerMsg = message.toLowerCase();

    // 1. Synonym Match
    for (const [term, target] of Object.entries(SYNONYMS)) {
        if (lowerMsg.includes(term)) {
            // Find the actual account object that loosely matches the target synonym
            const match = accountsIndex.find(acc => acc.name.toLowerCase().includes(target.toLowerCase()));
            if (match) return match;
        }
    }

    // 2. Direct Name Match (Substring)
    // Sort by name length desc to match "Taxas de Cartão" before "Taxas"
    const sortedAccounts = [...accountsIndex].sort((a, b) => b.name.length - a.name.length);

    for (const acc of sortedAccounts) {
        if (lowerMsg.includes(acc.name.toLowerCase())) {
            return acc;
        }
    }

    return null;
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getAIErrorMessage(error) {
    const status = error?.response?.status;
    const apiMessage = error?.response?.data?.error?.message || "";
    const providerRaw = error?.response?.data?.error?.metadata?.raw || "";
    const details = (providerRaw || apiMessage || "").trim();

    if (status === 401) {
        return "Falha de autenticação com a OpenRouter (401). Atualize a OPENROUTER_API_KEY no arquivo .env e reinicie o app.";
    }

    if (status === 429) {
        return "A IA está temporariamente em limite de uso (429). Aguarde alguns segundos e tente novamente.";
    }

    if (status === 402) {
        return "A conta OpenRouter está sem crédito para este modelo. Verifique saldo/plano no painel da OpenRouter.";
    }

    if (details) {
        return `Erro da IA: ${details}`;
    }

    return "Desculpe, ocorreu um erro ao processar sua solicitação pela IA.";
}

async function requestOpenRouterCompletion(messages, onStreamChunk, overrideApiKey, options = {}) {
    const apiKeyToUse = overrideApiKey || OPENROUTER_API_KEY;
    if (!apiKeyToUse) {
        throw new Error("API Key OpenRouter não configurada.");
    }
    let attempt = 0;

    while (true) {
        try {
            const response = await axios.post(OPENROUTER_URL, {
                model: MODEL,
                messages,
                temperature: options.temperature ?? 0.5,
                max_tokens: options.maxTokens ?? 1500,
                stream: !!onStreamChunk
            }, {
                responseType: onStreamChunk ? 'stream' : 'json',
                headers: {
                    "Authorization": `Bearer ${apiKeyToUse}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": OPENROUTER_REFERER,
                    "X-Title": OPENROUTER_APP_TITLE
                }
            });

            if (onStreamChunk) {
                return new Promise((resolve, reject) => {
                    let fullText = "";
                    response.data.on('data', (chunk) => {
                        const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
                        for (const line of lines) {
                            if (line.includes('data: [DONE]')) return;
                            if (line.startsWith('data: ')) {
                                try {
                                    const json = JSON.parse(line.replace('data: ', ''));
                                    const content = json.choices[0]?.delta?.content || "";
                                    if (content) {
                                        fullText += content;
                                        onStreamChunk(content);
                                    }
                                } catch (e) {
                                    // Ignore parse errors for partial chunks
                                }
                            }
                        }
                    });
                    response.data.on('end', () => {
                        resolve({
                            data: {
                                choices: [{ message: { content: fullText } }]
                            }
                        });
                    });
                    response.data.on('error', reject);
                });
            }

            return response;

        } catch (error) {
            const isRateLimit = error?.response?.status === 429;
            if (isRateLimit && attempt < OPENROUTER_MAX_RETRIES) {
                attempt += 1;
                await wait(1200 * attempt);
                continue;
            }
            throw error;
        }
    }
}

function cleanAIContent(content) {
    return (content || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function extractJsonObject(content) {
    const cleaned = cleanAIContent(content)
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();

    try {
        return JSON.parse(cleaned);
    } catch (directError) {
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");

        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
            throw directError;
        }

        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }
}

function normalizeArray(value, limit) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, limit);
}

function normalizePresentationAnalysis(value) {
    const analysis = value && typeof value === "object" ? value : {};

    return {
        companyName: String(analysis.companyName || "").trim(),
        coverSubtitle: String(analysis.coverSubtitle || "").trim(),
        executiveHeadline: String(analysis.executiveHeadline || "").trim(),
        executiveNarrative: String(analysis.executiveNarrative || "").trim(),
        revenueDiagnosis: String(analysis.revenueDiagnosis || "").trim(),
        expenseDiagnosis: String(analysis.expenseDiagnosis || "").trim(),
        topExpenseDiagnosis: String(analysis.topExpenseDiagnosis || "").trim(),
        operationalDiagnosis: String(analysis.operationalDiagnosis || "").trim(),
        resultDiagnosis: String(analysis.resultDiagnosis || "").trim(),
        cashDiagnosis: String(analysis.cashDiagnosis || "").trim(),
        insights: normalizeArray(analysis.insights, 5).map(item => ({
            title: String(item?.title || "").trim(),
            finding: String(item?.finding || "").trim(),
            evidence: String(item?.evidence || "").trim()
        })),
        risks: normalizeArray(analysis.risks, 4).map(item => ({
            label: String(item?.label || "").trim(),
            value: String(item?.value || "").trim(),
            tone: ["positive", "negative", "neutral"].includes(item?.tone) ? item.tone : "neutral",
            note: String(item?.note || "").trim()
        })),
        actionPlan: normalizeArray(analysis.actionPlan, 5).map(item => ({
            action: String(item?.action || "").trim(),
            owner: String(item?.owner || "").trim(),
            deadline: String(item?.deadline || "").trim(),
            expectedImpact: String(item?.expectedImpact || "").trim()
        })),
        forecast: normalizeArray(analysis.forecast, 3).map(item => ({
            label: String(item?.label || "").trim(),
            value: String(item?.value || "").trim(),
            tone: ["positive", "negative", "neutral"].includes(item?.tone) ? item.tone : "neutral",
            note: String(item?.note || "").trim()
        })),
        conclusion: normalizeArray(analysis.conclusion, 3).map(item => ({
            title: String(item?.title || "").trim(),
            text: String(item?.text || "").trim()
        })),
        dataLimitations: normalizeArray(analysis.dataLimitations, 4).map(item => String(item || "").trim()).filter(Boolean)
    };
}

async function getPresentationAnalysis(payload, overrideApiKey) {
    const apiKeyToUse = overrideApiKey || OPENROUTER_API_KEY;
    if (!apiKeyToUse) {
        return {
            success: false,
            error: "Chave de API da OpenRouter não configurada. Configure no .env ou nas Configurações de Banco."
        };
    }

    try {
        const { filters, branchLabel, financialContext, dashboardData } = payload || {};
        const messages = [
            {
                role: "system",
                content: `
Você é um consultor sênior de BPO Financeiro.
Sua tarefa é gerar o conteúdo de uma apresentação executiva personalizada para UMA empresa/filial específica.

REGRAS OBRIGATÓRIAS:
1. Não use frases genéricas como "acompanhar indicadores", "reduzir custos" ou "melhorar gestão" sem citar dado concreto.
2. Cada diagnóstico deve citar pelo menos um elemento real do contexto: valor em R$, percentual, mês, categoria, filial, fornecedor/cliente, histórico ou transação.
3. Se o dado não existir, escreva a limitação específica em "dataLimitations" e adapte a recomendação ao que existe.
4. O plano de ação precisa ser dedicado ao cenário analisado, usando as categorias, variações e valores do contexto.
5. Não invente nomes de fornecedor, produto, imposto ou filial. Use somente o contexto.
6. Responda somente JSON válido, sem Markdown e sem texto fora do JSON.
7. Português do Brasil, tom profissional de consultoria financeira.
`
            },
            {
                role: "user",
                content: `
Gere um JSON neste schema exato:
{
  "companyName": "nome da empresa/filial analisada",
  "coverSubtitle": "subtítulo executivo específico do período",
  "executiveHeadline": "frase de decisão principal com números",
  "executiveNarrative": "resumo executivo em 2 frases, com valores e alerta principal",
  "revenueDiagnosis": "diagnóstico do faturamento com meses/variações",
  "expenseDiagnosis": "diagnóstico das despesas com categorias/percentuais",
  "topExpenseDiagnosis": "leitura do top despesas com concentração e anomalias",
  "operationalDiagnosis": "diagnóstico do custo operacional dedicado à empresa",
  "resultDiagnosis": "diagnóstico do lucro/prejuízo e margem",
  "cashDiagnosis": "diagnóstico de caixa com entradas, saídas, saldo e risco",
  "insights": [
    { "title": "curto", "finding": "insight específico", "evidence": "evidência numérica/contextual" }
  ],
  "risks": [
    { "label": "risco", "value": "nível/valor", "tone": "positive|negative|neutral", "note": "por que isso importa" }
  ],
  "actionPlan": [
    { "action": "ação específica", "owner": "responsável sugerido", "deadline": "prazo", "expectedImpact": "impacto esperado com número ou hipótese explícita" }
  ],
  "forecast": [
    { "label": "cenário", "value": "valor/resultado projetado", "tone": "positive|negative|neutral", "note": "premissa usando dados do contexto" }
  ],
  "conclusion": [
    { "title": "próximo passo", "text": "mensagem objetiva" }
  ],
  "dataLimitations": ["limitação específica, se houver"]
}

Limites:
- No máximo 3 insights.
- No máximo 4 riscos.
- No máximo 4 ações.
- No máximo 3 cenários de forecast.
- No máximo 3 conclusões.
- Textos curtos, diretos e com números.

FILTROS:
${JSON.stringify({ filters, branchLabel })}

DADOS DO DASHBOARD:
${JSON.stringify(dashboardData)}

CONTEXTO FINANCEIRO DETALHADO:
${JSON.stringify(financialContext)}
`
            }
        ];

        // Usa a mesma configuração padrão da função CONVERSAS:
        // mesmo MODEL, mesma chave, temperatura e max_tokens padrão.
        const response = await requestOpenRouterCompletion(messages, null, apiKeyToUse);

        const rawContent = response.data?.choices?.[0]?.message?.content || "";
        const parsed = extractJsonObject(rawContent);
        return {
            success: true,
            analysis: normalizePresentationAnalysis(parsed),
            raw: rawContent
        };
    } catch (error) {
        const status = error?.response?.status || "N/A";
        console.error(`AI Presentation Error [${status}]:`, error.response ? error.response.data : error.message);
        return {
            success: false,
            error: getAIErrorMessage(error)
        };
    }
}

async function getAIResponse(userMessage, contextData, onStreamChunk, overrideApiKey) {
    const apiKeyToUse = overrideApiKey || OPENROUTER_API_KEY;
    if (!apiKeyToUse) {
        return {
            text: "Erro: Chave de API da OpenRouter não configurada. Por favor, configure-a no arquivo .env ou nas Configurações de Banco.",
            analyzedAccount: null
        };
    }

    try {
        let finalContext = { ...contextData }; // Shallow copy
        let analyzedAccountName = null;

        // --- ORCHESTRATOR LOGIC ---
        const needsDetail = analyzeIntent(userMessage);

        if (needsDetail && contextData.accountsIndex) {
            const focusedAccount = resolveAccount(userMessage, contextData.accountsIndex);

            if (focusedAccount) {
                console.log(`[AI Orchestrator] Drill-down to account: ${focusedAccount.name} (${focusedAccount.id})`);

                const { start, end } = contextData.period || {};

                if (start && end) {
                    const detailResult = await getAccountDetails(start, end, null, focusedAccount.id);

                    if (detailResult.success) {
                        finalContext.detailContext = {
                            focusAccount: focusedAccount,
                            transactions: detailResult.data
                        };
                        analyzedAccountName = focusedAccount.name;
                    }
                }
            }
        }

        const messages = [
            { role: "system", content: SYSTEM_PROMPT },
            {
                role: "system",
                content: `CONTEXTO FINANCEIRO (JSON): \n${JSON.stringify(finalContext)}`
            },
            { role: "user", content: userMessage }
        ];

        // Step 4: Final Completion
        const response = await requestOpenRouterCompletion(messages, onStreamChunk, apiKeyToUse);

        if (response.data && response.data.choices && response.data.choices.length > 0) {
            let content = response.data.choices[0].message.content || "";

            // Clean up <think> tags if present (DeepSeek R1 specific)
            content = cleanAIContent(content);

            if (!content) {
                // If content is empty after cleanup, try to use raw content or fallback
                const raw = response.data.choices[0].message.content;
                if (raw && raw.length > 0) {
                    content = "*Pensamento da IA:* " + raw.replace(/<think>/g, "").replace(/<\/think>/g, "");
                } else {
                    content = "Não consegui gerar uma resposta textual detalhada. Por favor, verifique os dados no dashboard.";
                }
            }

            return { text: content, analyzedAccount: analyzedAccountName };
        } else {
            console.error("OpenRouter Empty Response:", response.data);
            return { text: "Desculpe, não recebi uma resposta válida do modelo.", analyzedAccount: null };
        }

    } catch (error) {
        const status = error?.response?.status || "N/A";
        console.error(`AI Service Error [${status}]:`, error.response ? error.response.data : error.message);
        return { text: getAIErrorMessage(error), analyzedAccount: null };
    }
}

module.exports = {
    getAIResponse,
    getPresentationAnalysis
};
