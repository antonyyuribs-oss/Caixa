# RASTRO - C — V6

Aplicativo web estático, em português, pronto para GitHub Pages. Nenhuma instalação de servidor ou conta bancária é necessária.

## Atualizar no GitHub Pages

1. Faça **Histórico → Exportar JSON** no aplicativo atual e guarde o arquivo em local seguro.
2. Descompacte o ZIP e envie os arquivos **do interior da pasta** para a raiz do repositório `Caixa`, substituindo os arquivos existentes. Inclua o novo arquivo `themes.css`.
3. No GitHub, confirme em Settings → Pages que a publicação usa `main` e `/(root)`.
4. Reabra o aplicativo pelo mesmo endereço. Se o tema ou a tela não atualizar imediatamente, feche o app da tela inicial do iPhone e abra novamente; se necessário, reabra pelo Safari.

**Não apague os dados do navegador nem desinstale o aplicativo antes de ter um backup.** Os dados financeiros continuam sob a mesma chave (`caixa-semanal-v3`) e mantêm o mesmo formato JSON da versão anterior; não é preciso importar outra vez se usar o mesmo navegador e endereço. O tema visual fica guardado neste aparelho, separadamente dos dados financeiros.

## O que mudou na V6

- **Todos os registros tocáveis:** em **Metas**, toque na descrição de qualquer lançamento (previsto ou realizado) para editar descrição, valor, tipo e data; os realizados também permitem corrigir data/hora de realização. O botão **Marcar realizado / Voltar a previsto** foi preservado.
- **Histórico:** toque em qualquer posição de saldo e fatura para editar seus valores, data e observação. Os dados são **substituídos**, não duplicados. Para excluir, use o botão próprio.
- **Metas:** toque no quadro de uma semana para abrir a edição do planejamento original (a soma das quatro semanas deve corresponder ao orçamento mensal).
- **Ordem dos lançamentos:** de data mais recente para mais antiga, incluindo os realizados.
- **Cinco temas visuais em Metas → Aparência:** Nude, Rosé, Grafite, Marinho e Oliva. São alterações somente de cores; o funcionamento financeiro é o mesmo.
- **Histórico com gráficos ampliados:** escolha entre **Gastos** (acumulado x meta original) e **Conta × fatura**. Há também barras de comparação semanal. Sem posição anterior suficiente, o gasto semanal fica identificado como **sem referência**, em vez de estimado.

## Regras financeiras mantidas

- O mês financeiro vai do **dia 26 ao dia 25** do mês seguinte; suas quatro semanas se ajustam à duração do período.
- A meta original de cada semana fica preservada; a meta livre é recalculada com fatura, caixa e previsões.
- Despesas futuras são reservadas já no momento do lançamento; créditos futuros são considerados a partir de sua semana de previsão.
- Pagamentos por Pix reduzem o caixa. Compras no cartão aumentam a fatura. O pagamento posterior do cartão não é contado de novo como gasto.
- Ao marcar um lançamento realizado, ele afeta provisoriamente o caixa ou cartão. Quando você informar uma posição bancária posterior, os saldos registrados prevalecem, evitando duplicidade.

## Backup, privacidade e implantação

Os dados permanecem no armazenamento local do navegador. O GitHub Pages hospeda o código, **não o seu extrato bancário**. Histórico → Exportar JSON cria um backup que você pode importar mais tarde. Importar substitui todo o conteúdo existente naquele navegador.

Arquivos principais: `index.html`, `app.js`, `logic.js`, `styles.css`, `themes.css`, `service-worker.js`, `manifest.webmanifest` e ícones.

Para testar os cálculos com Node.js (opcional): `npm test`.
