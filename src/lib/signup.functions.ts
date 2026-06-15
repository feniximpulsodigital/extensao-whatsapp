import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Público — cadastro self-service a partir da landing/vendas.
// Cria o usuário (o trigger handle_new_user cria profile + tenant + configs),
// marca o tenant como pending_payment e grava o plano escolhido. O pagamento
// acontece no /checkout (rota autenticada) e a ativação vem pelo webhook Asaas.
export const publicSignup = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        fullName: z.string().trim().min(2).max(120),
        companyName: z.string().trim().min(2).max(120),
        email: z.string().trim().toLowerCase().email(),
        phone: z.string().trim().min(10).max(20).optional(),
        password: z.string().min(8).max(72),
        planId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.planId) {
      const { data: plan } = await supabaseAdmin
        .from("plans")
        .select("id")
        .eq("id", data.planId)
        .eq("is_active", true)
        .eq("is_custom", false)
        .maybeSingle();
      if (!plan) throw new Error("Plano indisponível. Escolha outro plano.");
    }

    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
        company_name: data.companyName,
        phone: data.phone,
      },
    });
    if (created.error || !created.data.user) {
      const msg = created.error?.message ?? "";
      if (/already|registered|exists/i.test(msg)) {
        throw new Error("Este e-mail já tem uma conta. Faça login para continuar.");
      }
      throw new Error(msg || "Não foi possível criar sua conta. Tente novamente.");
    }

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("owner_id", created.data.user.id)
      .maybeSingle();
    if (!tenant) throw new Error("Falha ao preparar sua conta. Fale com o suporte.");

    await supabaseAdmin
      .from("tenants")
      .update({
        status: "pending_payment" as any,
        plan_id: data.planId ?? null,
      })
      .eq("id", tenant.id);

    return { ok: true, email: data.email };
  });
