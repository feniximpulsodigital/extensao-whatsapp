import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Bot, LogOut, Settings, Package, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Argos" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const tabs = [
    { to: "/admin/settings", label: "Configurações", icon: Settings },
    { to: "/admin/plans", label: "Planos", icon: Package },
    { to: "/admin/tenants", label: "Clientes", icon: Users },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/admin/settings" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground">
              <Bot className="h-5 w-5" />
            </div>
            <span className="font-bold">Argos · Super Admin</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/dashboard">App do cliente</Link></Button>
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
              <LogOut className="h-4 w-4 mr-2" />Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6 grid gap-6 md:grid-cols-[200px_1fr]">
        <nav className="space-y-1">
          {tabs.map((t) => {
            const active = location.pathname === t.to;
            const Icon = t.icon;
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
              </Link>
            );
          })}
        </nav>
        <main><Outlet /></main>
      </div>
    </div>
  );
}
