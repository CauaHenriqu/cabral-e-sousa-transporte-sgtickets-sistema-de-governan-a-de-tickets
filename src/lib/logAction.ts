import { supabase } from '@/integrations/supabase/client';

export async function logAction(
  action: 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'CLOSE' | 'TRANSFER',
  tableName?: string,
  recordId?: string,
  details?: string
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('system_logs').insert({
      user_id: user.id,
      user_email: user.email || '',
      action,
      table_name: tableName || null,
      record_id: recordId || null,
      details: details || null,
    });
  } catch (err) {
    console.error('Erro ao registrar log:', err);
  }
}
