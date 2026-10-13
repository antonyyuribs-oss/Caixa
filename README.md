# RASTRO - C · V7 — Correção de trajetória financeira

App financeiro estático em português para GitHub Pages. O objetivo continua sendo **fechar o mês financeiro (26 a 25) com o caixa livre planejado em zero** e corrigir a trajetória dos gastos durante as quatro semanas, sem categorias excessivas.

## Atualizar a partir da V6

1. No aplicativo atual, abra **Histórico → Exportar JSON** e guarde uma cópia fora do aparelho.
2. Envie os arquivos deste ZIP para a **raiz** do repositório `Caixa` no GitHub, substituindo os anteriores (inclusive `app.js`, `logic.js`, `styles.css`, `themes.css`, `service-worker.js`).
3. Aguarde a atualização do GitHub Pages e reabra pelo **mesmo endereço** no iPhone. Caso a versão antiga apareça, feche e abra o atalho novamente ou abra no Safari para atualizar o cache.
4. Os registros financeiros permanecem no mesmo armazenamento do navegador (`caixa-semanal-v3`) e o mesmo esquema de backup JSON (`version:3`). Não é necessário importar o backup se os dados continuarem visíveis. Nunca apague o atalho e o armazenamento antes de guardar o backup.

## Novidades da V7

### 1. Resultado de cada atualização
Após **Histórico → Atualizar posição**, o app apresenta a margem projetada da semana, a disponibilidade sem créditos ainda não recebidos e, quando houver duas fotografias comparáveis **na mesma semana**, a variação desde a atualização anterior. Mostra também as mudanças no saldo bancário e na fatura. As fotografias ficam salvas no novo campo **opcional** `metrics` de cada posição, sem mudar a versão do JSON.

Posições anteriores à V7 **não ganham margens históricas estimadas**. A comparação e o gráfico específico começam conforme você fizer novas atualizações. Ao editar uma posição, a fotografia dessa posição é recalculada e assinalada como editada; as demais fotografias permanecem guardadas.

### 2. Dinheiro de hoje × projeção
O Painel preserva apenas o cabeçalho, as quatro semanas e o quadro principal. Quando créditos futuros alteram o limite da semana selecionada, um indicador secundário distingue o valor que pode ser usado **antes** de esses créditos serem recebidos. Em Histórico → Posição financeira, veja o saldo líquido atual, o projetado após pendências e o mínimo disponível na sequência de vencimentos. Isso considera as datas: um crédito de sexta não pode cobrir uma conta vencendo na quarta.

**Importante:** o cálculo protege os vencimentos cadastrados e preserva a alocação para as semanas seguintes. Lançamentos não cadastrados, valores que mudaram ou uma fatura desatualizada podem alterar a disponibilidade real.

### 3. Conciliação de realizados
Cada lançamento em Metas agora distingue **Previsto**, **Realizado · provisório** (ajusta saldo/fatura no app) e **Realizado · conciliado** (posição bancária posterior passou a valer). Isso evita recontar um pagamento após informar o saldo do banco e melhora o comportamento quando posições são editadas, removidas ou registradas retroativamente. **Marcar realizado / Voltar a previsto** continuam disponíveis.

### 4. Planejamento semanal preservado
As metas originais são editáveis e mantidas como referência. A página Metas orienta cadastrar obrigações conhecidas antes de iniciar e evidencia previsões pendentes. Uma transferência para investimentos continua sendo apenas **uma saída Pix**, como definido no projeto.

### 5. Histórico das margens
O Histórico oferece três gráficos: **Margem**, **Gastos** e **Conta × fatura**, além das barras por semana. O novo gráfico de margem é formado somente por posições que tenham a fotografia V7; ele não une com uma linha semanas diferentes. A lista das posições mostra essa margem registrada e, quando comparável, a variação desde a atualização anterior.

### 6. Backup e continuidade
Histórico: lembrete de backup quando há registros sem backup exportado ou quando passam sete dias da última exportação (contador no próprio navegador). Antes de importar, o app informa quantos meses, posições e lançamentos entrarão e quantos serão substituídos.

Ao abrir um mês ainda não criado, pode-se usar a **última posição do mês anterior como referência inicial**. É necessário **confirmar manualmente o saldo real e a fatura do dia 26**. Obrigações antigas não são copiadas automaticamente, para evitar repetir pagamentos sem autorização.

## Arquivos

- `index.html`: tela inicial e navegação.
- `app.js`: interface, formulário, gráficos e backups.
- `logic.js`: motor financeiro (valores em centavos).
- `styles.css` e `themes.css`: layout e cinco paletas de cores.
- `manifest.webmanifest`, `service-worker.js`, `.nojekyll`, ícones: instalação e GitHub Pages.
- `tests/`: testes financeiros e teste estrutural de navegação.

Para testar com Node.js: `npm test`.

## Limitações

Dados ficam apenas no armazenamento local deste navegador; **não são sincronizados** com o GitHub nem com o banco. O histórico anterior à V7 não contém as novas fotografias de margem. A projeção não garante saldo: depende dos valores, datas e registros informados pelo usuário. Revise regularmente fatura e conta bancária.
