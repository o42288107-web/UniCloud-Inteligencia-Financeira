# Versão 2.3.0 - Plano de Contas Manual e Despesas Indiretas

## Novidades

- Adicionado cadastro local de plano de contas manual.
- Adicionado lançamento de despesas manuais em contas manuais.
- Permitido lançar despesas manuais vinculadas a contas importadas do ERP.
- Dashboard passa a consolidar despesas do ERP com despesas manuais locais.
- Cards e tabelas exibem separação entre valores ERP e valores manuais.
- Histórico por conta mostra lançamentos ERP e manuais com identificação de origem.
- IA financeira recebe contas manuais, despesas manuais, totais manuais e total consolidado.

## Observações

- Os lançamentos manuais ficam salvos somente no app via electron-store.
- Nenhum lançamento manual é gravado no banco do ERP.
- Recomenda-se backup periódico dos dados locais do app antes de atualizações ou rollback.

## Rollback

- Restaurar a build anterior preservando o arquivo local do electron-store.
- Não apagar dados locais de despesas manuais durante o rollback.
