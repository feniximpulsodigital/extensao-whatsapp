import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Argos" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  // alterna entre o formulário de login e o de recuperação de senha
  const [mode, setMode] = useState<"login" | "recover">("login");
  const [recoverSent, setRecoverSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Bem-vindo!");
    navigate({ to: "/dashboard", replace: true });
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    // Não revela se o e-mail existe (evita enumeração de contas).
    if (error) {
      toast.error("Não foi possível enviar agora. Tente novamente em instantes.");
      return;
    }
    setRecoverSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center">
          <Logo size={40} className="text-xl" />
        </Link>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>{mode === "login" ? "Bem-vindo" : "Recuperar senha"}</CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Acesse sua conta"
                : "Enviaremos um link para você criar uma nova senha"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Senha</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("recover");
                        setRecoverSent(false);
                      }}
                      className="text-xs text-muted-foreground underline hover:text-foreground"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            ) : recoverSent ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Se houver uma conta com esse e-mail, enviamos um link para redefinir a senha.
                  Verifique sua caixa de entrada (e o spam).
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setMode("login");
                    setRecoverSent(false);
                  }}
                >
                  Voltar ao login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleRecover} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recover-email">E-mail da conta</Label>
                  <Input
                    id="recover-email"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Enviando..." : "Enviar link de recuperação"}
                </Button>
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="w-full text-center text-sm text-muted-foreground underline hover:text-foreground"
                >
                  Voltar ao login
                </button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Ainda não tem conta?{" "}
          <Link to="/assinar" className="underline hover:text-foreground">
            Crie sua conta em minutos
          </Link>
          .
        </p>
        <p className="mt-2 text-center text-sm">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            ← Voltar ao site
          </Link>
        </p>
      </div>
    </div>
  );
}
