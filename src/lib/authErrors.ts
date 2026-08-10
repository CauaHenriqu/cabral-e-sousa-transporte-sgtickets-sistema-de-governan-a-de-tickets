// Traduz mensagens de erro do Supabase Auth para português.
export function translateAuthError(message?: string | null): string {
  if (!message) return 'Ocorreu um erro inesperado. Tente novamente.';
  const m = message.toLowerCase();

  if (m.includes('password should be at least')) {
    const match = message.match(/at least (\d+)/i);
    const n = match?.[1] ?? '6';
    return `A senha deve ter pelo menos ${n} caracteres.`;
  }
  if (m.includes('password is too weak') || m.includes('weak password')) {
    return 'A senha é muito fraca. Escolha outra senha.';
  }
  if (m.includes('password is known to be weak') || m.includes('pwned') || m.includes('has been leaked')) {
    return 'Esta senha é muito comum ou já foi vazada. Escolha outra senha.';
  }
  if (m.includes('new password should be different')) {
    return 'A nova senha deve ser diferente da senha atual.';
  }
  if (m.includes('invalid login credentials')) {
    return 'E-mail ou senha inválidos.';
  }
  if (m.includes('email not confirmed')) {
    return 'E-mail ainda não confirmado.';
  }
  if (m.includes('user already registered')) {
    return 'Este e-mail já está cadastrado.';
  }
  if (m.includes('user not found')) {
    return 'Usuário não encontrado.';
  }
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return 'Muitas tentativas. Aguarde alguns instantes e tente novamente.';
  }
  if (m.includes('token has expired') || m.includes('jwt expired')) {
    return 'Sua sessão expirou. Faça login novamente.';
  }
  if (m.includes('invalid token') || m.includes('invalid jwt')) {
    return 'Token inválido. Solicite um novo link.';
  }
  if (m.includes('network') || m.includes('failed to fetch')) {
    return 'Falha de conexão. Verifique sua internet e tente novamente.';
  }

  return message;
}
