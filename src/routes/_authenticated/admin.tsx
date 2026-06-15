import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  Settings,
  Package,
  Users,
  Mail,
  Zap,
  BarChart3,
  Brain,
  Palette,
  LifeBuoy,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";
import { adminSupportBadge } from "@/lib/support.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Argos" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const badgeFn = useServerFn(adminSupportBadge);

  // Notificação de novos tickets: badge na aba + toast quando a fila cresce
  const { data: support } = useQuery({
    queryKey: ["admin-support-badge"],
    queryFn: () => badgeFn(),
    refetchInterval: 30_000,
  });
  const prevOpen = useRef<number | null>(null);
  useEffect(() => {
    const open = support?.open;
    if (open === undefined) return;
    if (prevOpen.current !== null && open > prevOpen.current) {
      toast.info("Novo ticket de suporte aguardando resposta.");
    }
    prevOpen.current = open;
  }, [support?.open]);

  const tabs = [
    { to: "/admin/settings", label: "Configurações", icon: Settings },
    { to: "/admin/branding", label: "Visual", icon: Palette },
    { to: "/admin/ai-config", label: "IA / Prompts", icon: Brain },
    { to: "/admin/plans", label: "Planos", icon: Package },
    { to: "/admin/tenants", label: "Clientes", icon: Users },
    { to: "/admin/invites", label: "Convites", icon: Mail },
    { to: "/admin/ai-credits", label: "Créditos IA", icon: Zap },
    { to: "/admin/usage", label: "Uso & Margem", icon: BarChart3 },
    { to: "/admin/support", label: "Suporte", icon: LifeBuoy },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/admin/settings" className="flex items-center gap-2">
            <Logo size={28} showText={false} />
            <span className="font-bold">Argos Zap · Super Admin</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard">App do cliente</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const { invalidateAuthGate } = await import("./route");
                invalidateAuthGate();
                await supabase.auth.signOut();
                navigate({ to: "/login", replace: true });
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6 grid gap-6 md:grid-cols-[200px_1fr]">
        <nav className="space-y-1">
          {tabs.map((t) => {
            const active = location.pathname === t.to;
            const Icon = t.icon;
            const showBadge = t.to === "/admin/support" && (support?.open ?? 0) > 0;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex items-center gap-2 rounded px-3 py-2 text-sm ${
                  active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
                {showBadge && (
                  <span
                    className={`ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                      active
                        ? "bg-primary-foreground text-primary"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {support!.open}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
