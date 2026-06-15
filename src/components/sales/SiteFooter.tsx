import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-8 md:flex-row">
        <Link to="/" className="flex items-center">
          <Logo size={28} className="text-sm" />
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <Link to="/termos" className="hover:text-foreground">
            Termos de Uso
          </Link>
          <Link to="/privacidade" className="hover:text-foreground">
            Política de Privacidade
          </Link>
          <Link to="/login" className="hover:text-foreground">
            Entrar
          </Link>
        </nav>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Argos. Todos os direitos reservados.
        </p>
      </div>
      <div className="border-t border-border/60">
        <p className="container mx-auto px-4 py-3 text-center text-[11px] text-muted-foreground">
          A Argos não é afiliada, associada ou patrocinada pelo WhatsApp ou pela Meta Platforms,
          Inc.
        </p>
      </div>
    </footer>
  );
}
