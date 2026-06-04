import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Cache user gate results in-memory per session to avoid refetching
// roles + tenant on every client-side navigation.
type GateCache = {
  userId: string;
  isAdmin: boolean;
  tenantStatus: string | null;
  expiresAt: number;
};
let gateCache: GateCache | null = null;
const GATE_TTL_MS = 5 * 60_000;

export function invalidateAuthGate() {
  gateCache = null;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Fast path: getSession() reads from localStorage (sync-ish, no network).
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session?.user) {
      throw redirect({ to: "/login" });
    }
    const userId = session.user.id;
    const path = location.pathname;
    const onCheckout = path.startsWith("/checkout");
    const onAdmin = path.startsWith("/admin");

    // Use cache if fresh and same user
    let isAdmin: boolean;
    let tenantStatus: string | null;
    const now = Date.now();
    if (gateCache && gateCache.userId === userId && gateCache.expiresAt > now) {
      isAdmin = gateCache.isAdmin;
      tenantStatus = gateCache.tenantStatus;
    } else {
      const [{ data: roles }, { data: tenant }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("tenants").select("status").eq("owner_id", userId).maybeSingle(),
      ]);
      isAdmin = (roles ?? []).some((r) => r.role === "admin");
      tenantStatus = tenant?.status ?? null;
      gateCache = { userId, isAdmin, tenantStatus, expiresAt: now + GATE_TTL_MS };
    }

    if (!isAdmin && tenantStatus && tenantStatus !== "active" && !onCheckout) {
      throw redirect({ to: "/checkout" });
    }
    if (!isAdmin && onAdmin) {
      throw redirect({ to: "/dashboard" });
    }

    return { user: session.user, isAdmin };
  },
  component: () => <Outlet />,
});
