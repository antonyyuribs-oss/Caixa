# Caixa — controle financeiro semanal

Aplicativo web/PWA em português, em reais, feito com HTML, CSS e JavaScript puro. Funciona com **GitHub Pages**, sem servidor, contas ou dependências externas.

## O que faz

- Usa **mês financeiro do dia 26 do mês anterior até o dia 25 do mês de referência**, inclusive, independentemente do mês calendário.
- Divide os dias do período em **4 semanas o mais equilibradas possível**, distribuindo os dias extras primeiro nas semanas iniciais. Em outubro de 2026: **S1: 26/09–03/10; S2: 04/10–11/10; S3: 12/10–18/10; S4: 19/10–25/10**.
- Permite criar uma **meta mensal** e quatro metas semanais originais, cuja soma corresponde ao orçamento total.
- Recalcula quanto **ainda pode ser gasto em cada semana** usando o saldo bancário e a fatura de cartão em aberto. As semanas seguintes ficam protegidas primeiro.
- Registra quantas atualizações de **saldo atual da conta** e **fatura em aberto** forem necessárias, com data, hora e observação.
- Guarda o planejamento original e o histórico de cada atualização.
- Permite lançar despesas **futuras** de Cartão ou Pix, com data, valor e descrição; elas são consideradas dentro da meta da semana, sem desconto em duplicidade.
- Mostra se existe dinheiro suficiente para pagar a fatura em aberto.
- Inclui gráfico de evolução acumulada e backup em **JSON** para exportar/importar.
- Funciona offline depois de carregado no navegador, quando instalado ou via GitHub Pages com cache.

## Publicar no GitHub Pages

1. Crie um repositório público no GitHub, por exemplo `caixa-semanal`.
2. Envie **todos os arquivos desta pasta para a raiz do repositório**, incluindo `index.html`, `app.js`, `logic.js`, `styles.css`, `manifest.webmanifest`, `service-worker.js`, ícones e `.nojekyll`. A pasta `tests` e os arquivos de documentação são opcionais para publicação.
3. No repositório, abra **Settings → Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**, selecione **main** e a pasta **/(root)**, e salve.
5. Use o endereço publicado pelo GitHub, normalmente `https://SEU-USUARIO.github.io/caixa-semanal/`.
6. No iPhone, abra o site no Safari e use **Compartilhar → Adicionar à Tela de Início**, se desejar usar como app.

Não é necessário npm, instalação de dependências nem build.

## Como começar

1. Abra o mês financeiro (ex.: **Outubro 2026** significa **26/09/2026 a 25/10/2026**) e toque em **Criar planejamento mensal**.
2. Informe o **orçamento do mês**, o **saldo bancário do dia 26**, a **fatura em aberto naquele dia** e as quatro metas originais. No mês financeiro de outubro, o saldo inicial é o de **26 de setembro**.
3. Use **Atualizar posição** para registrar o saldo bancário e a fatura atual. O painel recalcula imediatamente as metas.
4. Se quiser, registre despesas futuras em **Metas → Lançamentos futuros** e marque-as como realizadas quando aparecerem no cartão ou saírem por Pix.
5. Acesse **Histórico** para consultar a evolução e fazer backup.

**Exemplo:** orçamento R$ 12.000, saldo inicial R$ 12.000, fatura inicial R$ 0, quatro metas de R$ 3.000. Depois de atualizar a fatura para R$ 8.000 e manter o saldo bancário em R$ 12.000, a terceira semana terá R$ 1.000 disponíveis, preservando R$ 3.000 para a quarta.

## Regras financeiras

- **Pix realizado**: reduz o saldo bancário imediatamente.
- **Compra no cartão**: aumenta a fatura em aberto, sem reduzir o saldo bancário naquele momento.
- **Pagamento da fatura**: diminui a conta e a fatura pelo mesmo valor; o resultado líquido não muda, portanto não conta como despesa nova.
- **Pix para investimento**: é tratado como qualquer outra saída do caixa, sem categoria separada.
- **Caixa livre = saldo bancário − fatura em aberto**. A meta é que, depois de pagar a fatura e destinar o restante aos gastos planejados, ele se aproxime de **R$ 0** no fechamento.
- **Gasto do mês = caixa livre inicial − caixa livre atual**. A conta pressupõe que o dinheiro destinado ao mês já foi colocado na conta no início. Se entrar dinheiro novo no meio do mês, o cálculo de gasto não consegue distinguir automaticamente a entrada de uma economia. Nesse caso, reveja o planejamento ou use um mês novo. **Não há integração bancária.**
- A reserva para cada semana inclui as despesas futuras daquela semana; o sistema usa o maior valor entre a meta original e o total futuro ainda pendente dessa semana. **Não soma a mesma despesa duas vezes.**
- Os valores **já refletidos na fatura ou no saldo** devem ser marcados como realizados na lista de futuros.
- **O aplicativo não realiza Pix nem paga faturas.** Ele apenas acompanha o planejamento.

**Observação sobre datas:** o dia 25 pertence ao mês financeiro que está terminando, e o dia 26 já pertence ao mês financeiro seguinte. A data da posição ou do lançamento futuro deve cair no período exibido no topo do aplicativo. Os registros históricos só identificam os gastos exatos de uma determinada semana se houve atualizações suficientes para separar os períodos. O aplicativo não cria transações que não foram informadas.

## Atualização da versão anterior (mês calendário)

Ao substituir os arquivos no mesmo endereço do GitHub Pages, o app procura os dados gravados pela versão antiga. **Ele cria automaticamente uma cópia no novo formato**, sem apagar o armazenamento antigo, e redistribui atualizações e futuros conforme suas datas reais:

- Uma posição de **30/09** passa a pertencer ao **outubro financeiro**.
- Uma posição de **26/10** passa a pertencer ao **novembro financeiro**.
- Orçamentos e quatro metas de meses já criados são conservados sob seus nomes originais, mas a **posição inicial não pode ser deduzida com segurança**: a versão antiga começava no dia 1 e a nova começa no dia 26.
- Por isso, nos meses que foram migrados, aparece um **aviso para conferir em Metas → Editar** o saldo bancário e a fatura do **dia 26**. Após salvar o planejamento revisado, o aviso desaparece.

**Antes de atualizar os arquivos, faça um backup JSON pelo Histórico.** Um backup exportado pela versão anterior também pode ser importado nesta nova versão. A nova versão exporta no formato atualizado. Ao importar um backup, ele substitui os dados que estão no navegador.

## Dados, privacidade e manutenção

- Tudo é salvo em `localStorage` no **navegador/dispositivo**. Os dados não vão automaticamente para o repositório GitHub.
- Trocar de aparelho ou limpar dados do navegador pode apagar os registros. **Exporte o JSON com frequência.**
- O backup contém seus valores financeiros em texto simples: guarde-o em local privado.
- Para atualizar o aplicativo, substitua os arquivos no repositório. Se a versão antiga continuar aparecendo por causa do cache offline/PWA, feche e reabra o app ou atualize a página após a publicação.
- O sistema não é um extrato bancário, nem um livro-caixa de partidas dobradas; é uma ferramenta de acompanhamento de metas semanais.

## Rodar localmente

Por usar módulos JavaScript, abra a pasta em um servidor HTTP estático, por exemplo:

```bash
python -m http.server 8000
```

Depois abra `http://localhost:8000` no navegador.

## Testes

Requer Node.js 18+ somente para testes (não para publicar):

```bash
npm test
```
