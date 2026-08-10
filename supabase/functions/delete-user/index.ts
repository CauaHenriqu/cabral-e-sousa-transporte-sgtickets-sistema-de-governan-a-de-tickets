import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: caller.id, _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem excluir usuários." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "ID do usuário não informado." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (userId === caller.id) {
      return new Response(JSON.stringify({ error: "Não é possível excluir a si mesmo." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is the only admin
    const { data: userRole } = await adminClient.from("user_roles").select("role").eq("user_id", userId).single();
    if (userRole?.role === "admin") {
      const { count } = await adminClient.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
      if (count !== null && count <= 1) {
        return new Response(JSON.stringify({ error: "Este é o único administrador do sistema e não pode ser excluído." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check all associations
    const associations: string[] = [];

    const { count: ticketsAsUser } = await adminClient.from("tickets").select("id", { count: "exact", head: true }).eq("user_id", userId);
    if (ticketsAsUser && ticketsAsUser > 0) associations.push("tickets (como solicitante)");

    const { count: ticketsAsAttendant } = await adminClient.from("tickets").select("id", { count: "exact", head: true }).eq("attendant_id", userId);
    if (ticketsAsAttendant && ticketsAsAttendant > 0) associations.push("tickets (como atendente)");

    const { count: ticketsAsCreator } = await adminClient.from("tickets").select("id", { count: "exact", head: true }).eq("created_by", userId);
    if (ticketsAsCreator && ticketsAsCreator > 0) associations.push("tickets (como criador)");

    const { count: messages } = await adminClient.from("ticket_messages").select("id", { count: "exact", head: true }).eq("sender_id", userId);
    if (messages && messages > 0) associations.push("mensagens de tickets");

    const { count: attachments } = await adminClient.from("ticket_attachments").select("id", { count: "exact", head: true }).eq("uploaded_by", userId);
    if (attachments && attachments > 0) associations.push("anexos de tickets");

    const { count: attServices } = await adminClient.from("attendant_services").select("id", { count: "exact", head: true }).eq("attendant_id", userId);
    if (attServices && attServices > 0) associations.push("associações de serviços");

    const { count: schedules } = await adminClient.from("work_schedules").select("id", { count: "exact", head: true }).eq("attendant_id", userId);
    if (schedules && schedules > 0) associations.push("expedientes de trabalho");

    const { count: logs } = await adminClient.from("system_logs").select("id", { count: "exact", head: true }).eq("user_id", userId);
    if (logs && logs > 0) associations.push("logs do sistema");

    if (associations.length > 0) {
      const { data: profile } = await adminClient.from("profiles").select("name").eq("user_id", userId).single();
      const name = profile?.name || userId;
      return new Response(JSON.stringify({
        error: `Não é possível excluir "${name}" porque está vinculado a: ${associations.join(", ")}. Remova ou transfira esses registros antes de excluir.`,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Safe to delete
    await adminClient.from("user_roles").delete().eq("user_id", userId);
    await adminClient.from("profiles").delete().eq("user_id", userId);

    const { error } = await adminClient.auth.admin.deleteUser(userId);
    if (error) {
      // If the auth user no longer exists, treat as success (idempotent) —
      // profiles/user_roles were already cleaned up above.
      const msg = (error.message || "").toLowerCase();
      const notFound = msg.includes("not found") || (error as any).status === 404;
      if (!notFound) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
