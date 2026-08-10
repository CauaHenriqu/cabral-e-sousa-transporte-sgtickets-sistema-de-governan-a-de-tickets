import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check caller is admin
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { password, name, role, sector, function: fn, phone, leaderName, leaderEmail } = body;

    // Normalize email: trim + lowercase para evitar "invalid format" do Supabase Auth
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const normalizedLeaderEmail = typeof leaderEmail === "string" ? leaderEmail.trim().toLowerCase() : "";

    if (!email || !password || !name || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "E-mail inválido. Verifique se não há espaços ou caracteres inválidos." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["admin", "user", "attendant", "tv"].includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create auth user
    const { data: newUser, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = newUser.user.id;

    // Upsert profile (trigger may or may not have created it)
    await adminClient.from("profiles").upsert({
      user_id: userId,
      name,
      email,
      sector: sector || "",
      function: fn || "",
      phone: phone || "",
      leader_name: leaderName || "",
      leader_email: normalizedLeaderEmail,
    }, { onConflict: "user_id" });

    // Assign role
    await adminClient.from("user_roles").insert({
      user_id: userId,
      role,
    });

    // Send welcome email via the central send-transactional-email function.
    // We call it via fetch using the ADMIN's JWT (authHeader) — not the service
    // role key — because send-transactional-email validates the caller JWT via
    // getClaims, which rejects the service role token as "Invalid JWT structure".
    try {
      const origin = req.headers.get('origin') || req.headers.get('referer') || 'https://cabralesousa.sgtickets.app';
      const loginUrl = origin.replace(/\/$/, '');
      const resp = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          templateName: "user-welcome",
          recipientEmail: email,
          idempotencyKey: `welcome-${userId}`,
          templateData: {
            userName: name,
            userEmail: email,
            userPassword: password,
            roleName: role,
            loginUrl,
          },
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error("send-transactional-email returned non-2xx:", resp.status, errText);
      }
    } catch (emailErr) {
      console.error("Failed to send welcome email:", emailErr);
      // Don't fail the user creation if email fails
    }

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
