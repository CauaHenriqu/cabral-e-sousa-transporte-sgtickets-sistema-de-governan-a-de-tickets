---
name: Android file picker fix
description: Dialogs de ticket usam onOpenChange no-op para evitar fechamento no Android
type: constraint
---
NUNCA usar onOpenChange com lógica de fechamento nos Dialogs que contêm file pickers.
Os Dialogs de criação de ticket e detalhe/chat usam `onOpenChange={() => {}}` (no-op).
O fechamento acontece APENAS via botões explícitos (X) ou sucesso da operação.
Isso resolve o bug onde o file picker do Android causava fechamento do modal.
NÃO readicionar guardas temporais, listeners de focus/visibility, ou drafts de file picker.
