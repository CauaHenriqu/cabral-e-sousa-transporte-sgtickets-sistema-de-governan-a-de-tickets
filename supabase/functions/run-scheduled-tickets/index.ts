import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const now = new Date().toISOString();
    const { data: due, error } = await supabase
      .from('scheduled_tickets')
      .select('*')
      .eq('active', true)
      .lte('next_run_at', now);

    if (error) throw error;

    console.log(`[run-scheduled-tickets] now=${now} due_count=${due?.length || 0}`);

    const results: any[] = [];

    // Helper: persistir log no system_logs (best-effort)
    const logAction = async (action: string, details: string, recordId?: string) => {
      try {
        await supabase.from('system_logs').insert({
          action,
          table_name: 'scheduled_tickets',
          record_id: recordId,
          details,
        });
      } catch (e) {
        console.error('failed to log', e);
      }
    };

    // Helper: avança next_run_at via update (dispara o trigger BEFORE UPDATE)
    const advanceNextRun = async (schedId: string, frequency: string) => {
      const updates: any = { last_run_at: now };
      if (frequency === 'once') {
        updates.active = false;
        updates.next_run_at = null;
      } else {
        // Toca em active=true para forçar o trigger BEFORE UPDATE a recalcular next_run_at
        updates.active = true;
      }
      await supabase.from('scheduled_tickets').update(updates).eq('id', schedId);
    };

    for (const sched of due || []) {
      try {
        console.log(`[run-scheduled-tickets] processing schedule=${sched.id} name="${sched.name}" service=${sched.service_id}`);

        // Find attendants for the service
        const { data: attServices } = await supabase
          .from('attendant_services')
          .select('attendant_id')
          .eq('service_id', sched.service_id);

        if (!attServices || attServices.length === 0) {
          console.warn(`[run-scheduled-tickets] schedule=${sched.id} skipped: no attendant for service=${sched.service_id}`);
          await logAction(
            'SCHEDULED_TICKET_SKIPPED',
            `Agendamento "${sched.name}" não criou ticket: serviço não possui atendentes vinculados.`,
            sched.id,
          );
          // Avança next_run_at mesmo assim, para não ficar preso tentando o mesmo horário.
          await advanceNextRun(sched.id, sched.frequency);
          results.push({ id: sched.id, skipped: 'no_attendant' });
          continue;
        }

        const rawAttIds = attServices.map((a: any) => a.attendant_id);
        // Somente atendentes que recebem tickets abertos por solicitantes entram no sorteio
        const { data: activeProfiles } = await supabase
          .from('profiles')
          .select('user_id')
          .in('user_id', rawAttIds)
          .eq('status', 'Ativo')
          .eq('receives_new_tickets', true);
        const attIds = (activeProfiles || []).map((p: any) => p.user_id);

        if (attIds.length === 0) {
          console.warn(`[run-scheduled-tickets] schedule=${sched.id} skipped: no ACTIVE attendant for service=${sched.service_id}`);
          await logAction(
            'SCHEDULED_TICKET_SKIPPED',
            `Agendamento "${sched.name}" não criou ticket: nenhum atendente ativo vinculado ao serviço.`,
            sched.id,
          );
          await advanceNextRun(sched.id, sched.frequency);
          results.push({ id: sched.id, skipped: 'no_active_attendant' });
          continue;
        }

        const { data: openTickets } = await supabase
          .from('tickets')
          .select('attendant_id')
          .eq('status', 'ABERTO')
          .in('attendant_id', attIds);

        const counts: Record<string, number> = {};
        attIds.forEach((id: string) => { counts[id] = 0; });
        (openTickets || []).forEach((t: any) => { counts[t.attendant_id] = (counts[t.attendant_id] || 0) + 1; });
        const chosenId = attIds.reduce((a: string, b: string) => (counts[a] || 0) <= (counts[b] || 0) ? a : b);

        // Create ticket
        const { data: ticket, error: tErr } = await supabase.from('tickets').insert({
          user_id: sched.user_id,
          attendant_id: chosenId,
          service_id: sched.service_id,
          created_by: sched.created_by,
        }).select().single();
        if (tErr) throw tErr;

        // Get names for system message
        const { data: svc } = await supabase.from('services').select('name').eq('id', sched.service_id).single();
        const { data: att } = await supabase.from('profiles').select('name').eq('user_id', chosenId).single();

        await supabase.from('ticket_messages').insert({
          ticket_id: ticket.id,
          sender_name: 'Sistema',
          sender_role: 'system',
          content: `🤖 Ticket criado automaticamente pelo agendamento "${sched.name}". Serviço: ${svc?.name || ''}. Atendente: ${att?.name || 'N/A'}.`,
        });

        await logAction(
          'SCHEDULED_TICKET_CREATED',
          `Agendamento "${sched.name}" criou o ticket #${ticket.code} (atendente: ${att?.name || 'N/A'}).`,
          sched.id,
        );

        // Enviar e-mails para os envolvidos (usuário, líder e atendente)
        try {
          const [userProfileRes, attProfileRes] = await Promise.all([
            supabase.from('profiles').select('name, email, leader_email').eq('user_id', sched.user_id).single(),
            supabase.from('profiles').select('name, email').eq('user_id', chosenId).single(),
          ]);

          const recipientEmails = new Set<string>();
          if (userProfileRes.data?.email) recipientEmails.add(userProfileRes.data.email);
          if (userProfileRes.data?.leader_email) recipientEmails.add(userProfileRes.data.leader_email);
          if (attProfileRes.data?.email) recipientEmails.add(attProfileRes.data.email);

          const templateData = {
            ticketCode: String(ticket.code),
            serviceName: svc?.name || '',
            userName: userProfileRes.data?.name || 'N/A',
            attendantName: attProfileRes.data?.name || att?.name || 'N/A',
            description: `Ticket criado automaticamente pelo agendamento "${sched.name}".`,
            createdAt: new Date(ticket.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
          };

          for (const email of recipientEmails) {
            try {
              const { error: mailErr } = await supabase.functions.invoke('send-transactional-email', {
                body: {
                  templateName: 'ticket-created',
                  recipientEmail: email,
                  idempotencyKey: `ticket-created-${ticket.id}-${email}`,
                  templateData,
                },
              });
              if (mailErr) {
                console.error(`[run-scheduled-tickets] mail error to ${email}:`, mailErr.message);
              }
            } catch (mErr: any) {
              console.error(`[run-scheduled-tickets] mail invoke failed for ${email}:`, mErr?.message);
            }
          }
        } catch (mailFatal: any) {
          console.error('[run-scheduled-tickets] mail dispatch fatal:', mailFatal?.message);
          await logAction(
            'SCHEDULED_TICKET_EMAIL_ERROR',
            `Falha ao enviar e-mails do ticket #${ticket.code}: ${mailFatal?.message || 'desconhecido'}.`,
            sched.id,
          );
        }

        await advanceNextRun(sched.id, sched.frequency);

        console.log(`[run-scheduled-tickets] schedule=${sched.id} created ticket=${ticket.id} code=${ticket.code}`);
        results.push({ id: sched.id, ticket_id: ticket.id, ticket_code: ticket.code });
      } catch (e: any) {
        console.error('[run-scheduled-tickets] schedule error', sched.id, e?.message);
        await logAction(
          'SCHEDULED_TICKET_ERROR',
          `Erro ao executar agendamento "${sched.name}": ${e?.message || 'desconhecido'}.`,
          sched.id,
        );
        results.push({ id: sched.id, error: e?.message });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[run-scheduled-tickets] fatal', e?.message);
    return new Response(JSON.stringify({ error: e?.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
