# Caixa — controle financeiro semanal

Aplicativo PWA em português, com valores em reais, para GitHub Pages. Não precisa de conta, servidor ou bibliotecas externas. Os dados ficam apenas no navegador.

## Calendário e metas

- Cada mês financeiro começa no **dia 26 do mês anterior** e termina no **dia 25** do mês de referência.
- As quatro semanas são divididas de maneira equilibrada; outubro de 2026: 26/09–03/10, 04/10–11/10, 12/10–18/10 e 19/10–25/10.
- As **metas originais** são definidas uma vez por mês e permanecem visíveis. A **meta disponível** se recalcula com gastos, créditos e previsões.
- O aplicativo considera **caixa livre = dinheiro na conta − fatura em aberto**. O fechamento pretendido é zero depois de destinar todos os recursos, inclusive eventual Pix para investimento.

## Primeira configuração

1. Entre em **Metas → Editar**, defina o orçamento mensal e as quatro metas semanais. A soma das quatro metas deve ser igual ao orçamento mensal.
2. Preencha o **saldo bancário inicial** e a **fatura inicial** na abertura financeira (dia 26).
3. Em **Painel → Atualizar posição**, informe o **saldo total atual** e a **fatura total em aberto**, não apenas a diferença da última atualização.
4. Consulte no Painel quanto **resta para novos gastos na semana**. Pode atualizar a posição quantas vezes quiser.

## Despesas previstas e créditos

Em **Metas → Lançamentos → Adicionar**, cadastre:

- **Saída · Pix:** pagamento que futuramente reduzirá o saldo da conta.
- **Saída · Cartão:** compra que aumentará o valor da fatura em aberto.
- **Entrada · Crédito:** dinheiro esperado na conta, como recebimento ou reembolso.

O campo **data** indica quando o lançamento é esperado. Uma despesa futura já é abatida **imediatamente do dinheiro livre das semanas ainda abertas**, distribuindo a dedução proporcionalmente à disponibilidade de cada uma; não precisa aguardar o vencimento. Um crédito previsto aumenta a projeção **a partir da semana do recebimento programado**.

Para lançar dinheiro que **já entrou**, vá ao **Painel → Registrar crédito recebido**. Ele entra como realizado e atualiza o cálculo imediatamente.

### Botão “Marcar realizado”

Esta opção foi mantida e **altera os cálculos de verdade**:

- Despesa por Pix realizada → reduz provisoriamente o dinheiro em conta.
- Despesa no cartão realizada → aumenta provisoriamente a fatura em aberto.
- Crédito realizado → aumenta provisoriamente o dinheiro em conta.
- O lançamento deixa de ser **Previsto** e passa a **Realizado**, sem ser somado duas vezes à previsão.
- **Voltar a previsto** permite desfazer a marcação.

**Ordem recomendada:** primeiro marque os lançamentos como realizados; depois confira **Painel → Atualizar posição** e registre os saldos bancários verdadeiros. A nova posição bancária **substitui os efeitos provisórios** dos lançamentos já realizados, evitando duplicação. Se você já atualizou o banco/fatura e só depois marcou a despesa como realizada, **atualize a posição novamente** com os valores atuais para que o aplicativo não a desconte duas vezes.

Ao pagar uma fatura, o saldo bancário e a fatura caem simultaneamente pelo mesmo valor. Isso não representa um novo gasto. Um Pix para investimento é considerado uma saída normal, conforme sua preferência.

### Exemplo

Orçamento: R$ 12.000; quatro metas de R$ 3.000. Se até o fim da segunda semana a fatura chegar a R$ 8.000, restam R$ 4.000 para as semanas 3 e 4: R$ 1.000 para S3 e R$ 3.000 para S4. Se você cadastrar um Pix futuro de R$ 1.800 para S4, ele será reservado **desde já**: passam a sobrar R$ 550 para S3 e R$ 1.650 para S4. Marcá-lo realizado altera o saldo, porém não cobra o valor duas vezes.

## Atualizar no GitHub Pages

1. **Antes de atualizar:** acesse **Histórico → Exportar JSON** e faça uma cópia do seu backup.
2. Extraia o ZIP e envie o conteúdo da pasta para a **raiz** do repositório. Substitua `index.html`, `app.js`, `logic.js`, `styles.css`, `service-worker.js`, `README.md` e os demais arquivos.
3. Em **Settings → Pages**, selecione **Deploy from a branch → main → /(root)**.
4. No iPhone, abra o site publicado no Safari e use **Compartilhar → Adicionar à Tela de Início**, se desejar.
5. Se uma versão anterior continuar aparecendo, atualize a página e feche/reabra o aplicativo para renovar o cache.

A nova versão lê os registros anteriores automaticamente e mantém uma cópia não modificada do armazenamento antigo. Também aceita backups JSON antigos para importação. **Não apague o armazenamento do navegador.** O backup contém informações financeiras em texto simples: guarde-o em local privado.

## Histórico e testes

**Histórico** apresenta as posições registradas, as despesas acumuladas e o gráfico. Os lançamentos realizados também influenciam o gráfico. O aplicativo não acessa sua conta bancária nem envia Pix.

Para rodar testes unitários (Node.js 18+), execute `npm test`. Para abrir localmente, use um servidor estático (`python -m http.server 8000`).
