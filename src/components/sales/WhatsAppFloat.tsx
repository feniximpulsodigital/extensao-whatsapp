import { MessageCircle } from "lucide-react";
import { SALES_WHATSAPP, SALES_WHATSAPP_MESSAGE } from "./sales-config";

// Botão flutuante "Falar no WhatsApp" — captura quem tem dúvida e não
// compraria sozinho. Só aparece se SALES_WHATSAPP estiver configurado.
export function WhatsAppFloat() {
  if (!SALES_WHATSAPP) return null;
  const href = `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(SALES_WHATSAPP_MESSAGE)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 font-semibold text-primary-foreground shadow-lg transition hover:scale-105 hover:shadow-xl"
    >
      <MessageCircle className="h-5 w-5" />
      <span className="hidden sm:inline">Falar no WhatsApp</span>
    </a>
  );
}
