const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // checa a cada hora se já passou 5 dias

let started = false;

// Roda a verificação de manutenção a cada 5 dias, mesmo que o container
// reinicie no meio do caminho: em vez de contar 5 dias a partir do boot,
// consulta a última execução salva no banco e só dispara quando o intervalo
// já tiver vencido. Um setInterval de 1h é barato e cobre reinícios do
// EasyPanel sem duplicar execuções nem perder o ciclo.
export function startDbKeepAliveScheduler(): void {
  if (started) return;
  started = true;

  const tick = async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: last } = await supabaseAdmin
        .from("maintenance_runs")
        .select("ran_at")
        .order("ran_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastRunAt = last?.ran_at ? new Date(last.ran_at).getTime() : 0;
      if (Date.now() - lastRunAt < FIVE_DAYS_MS) return;

      const { runDbKeepAlive } = await import("./maintenance.functions");
      await runDbKeepAlive();
    } catch (err) {
      console.error("[maintenance-scheduler] falha ao verificar/rodar keep-alive", err);
    }
  };

  // Primeira checagem logo após o boot (cobre o caso de o container ter
  // ficado dias parado), depois repete a cada hora.
  void tick();
  setInterval(tick, CHECK_INTERVAL_MS);
}
