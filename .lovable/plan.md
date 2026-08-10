# Atender vários tickets ao mesmo tempo (painel lado a lado)

## Objetivo
Hoje a tela de Tickets abre **um** ticket por vez, num modal (`Dialog`) controlado por um único `detailTicketId`. Abrir outro ticket fecha o anterior e perde o que estava digitado.

A proposta: transformar o atendimento em um **workspace lado a lado**, onde o atendente mantém até 3 tickets abertos simultaneamente, alternando e digitando em qualquer um deles, com os tickets abertos restaurados após recarregar a página.

## Como vai funcionar (visão do usuário)

```text
┌──────────────────────────────────────────────────────────────┐
│  Lista de tickets (compacta)                                 │
├───────────────────┬───────────────────┬──────────────────────┤
│  Ticket #1042   ✕ │  Ticket #1050   ✕ │  Ticket #1061      ✕ │
│  histórico        │  histórico        │  histórico           │
│  ...              │  ...              │  ...                 │
│  [mensagem]  ▸    │  [mensagem]  ▸    │  [mensagem]  ▸       │
└───────────────────┴───────────────────┴──────────────────────┘
```

- Clicar num ticket da lista **adiciona um painel** ao workspace em vez de abrir um modal.
- Cada painel é independente: histórico próprio, campo de mensagem próprio, anexos próprios, botões de ação próprios (fechar, transferir, produtos da devolução, dados do formulário).
- Limite de **3 painéis** abertos ao mesmo tempo (acima disso a área fica ilegível). Ao tentar abrir o 4º, aviso: "Feche um ticket para abrir outro".
- Cada painel tem: **maximizar** (ocupa toda a área, os outros ficam como abas no topo) e **fechar**.
- Em telas estreitas / mobile: os painéis viram **abas** empilhadas, um visível por vez.
- Os painéis abertos e os rascunhos digitados são salvos localmente e **restaurados ao recarregar**.

## Regras preservadas (nada muda)
- Permissões de fechar/transferir por serviço e por motivo de devolução continuam avaliadas **por ticket**, dentro de cada painel.
- Ticket fechado não reabre; mensagens privadas, e-mails, SLA, avaliação e integrações de API seguem iguais.
- A atualização automática do histórico (polling) passa a valer para cada painel aberto.

## Detalhes técnicos
- Extrair todo o conteúdo do `Dialog` de detalhe de `src/pages/TicketsList.tsx` (hoje ~linhas 2339-2520 + estados/queries `detail*` espalhados) para um novo componente `src/components/tickets/TicketDetailPanel.tsx`, que recebe apenas `ticketId` e encapsula seu próprio estado: `messageInput`, `chatAttachments`, `isPrivateMessage`, `devolucaoEdit`, queries `ticket-detail-messages`, `ticket-attachments`, `detail-form-fields`, e as mutations de envio de mensagem/fechamento/transferência.
- Criar `src/components/tickets/TicketWorkspace.tsx`: recebe `openTicketIds: string[]`, renderiza um `TicketDetailPanel` por id em grid (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`) ou em `Tabs` no mobile, com controles de maximizar/fechar.
- Novo hook `src/hooks/useOpenTickets.ts`: estado dos ids abertos (máx. 3), ações `open/close/closeAll/maximize`, persistido em `localStorage` (chave por usuário) e reidratado no mount. Os rascunhos por ticket passam a usar chave `ticket-draft:<userId>:<ticketId>`, reaproveitando a lógica de draft já existente.
- `TicketsList.tsx`: substituir `detailTicketId` pelo hook; a lista continua com filtros, busca, kanban e criação de ticket intactos. `isAnyDialogOpen` (usado para pausar auto-refresh) passa a considerar apenas os modais reais, não os painéis.
- `ChatTicket.tsx` (visão do solicitante) permanece como está — a mudança é na tela de atendimento.

## Fora de escopo
- Abrir tickets em janelas separadas do navegador.
- Mudanças de banco de dados ou de regras de permissão.
