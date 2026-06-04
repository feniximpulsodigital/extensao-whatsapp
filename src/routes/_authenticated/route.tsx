import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login" });
    }

    // Check tenant status — block app until paid (except admins and checkout itself)
    const userId = data.user.id;
    const [{ data: roles }, { data: tenant }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("tenants").select("status").eq("owner_id", userId).maybeSingle(),
    ]);

    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    const path = location.pathname;
    const onCheckout = path.startsWith("/checkout");
    const onAdmin = path.startsWith("/admin");

    if (!isAdmin && tenant && tenant.status !== "active" && !onCheckout) {
      throw redirect({ to: "/checkout" });
    }

    if (!isAdmin && onAdmin) {
      throw redirect({ to: "/dashboard" });
    }

    return { user: data.user, isAdmin };
  },
  component: () => <Outlet />,
});
