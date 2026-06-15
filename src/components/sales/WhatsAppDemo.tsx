import { Check, Sparkles, User } from "lucide-react";

type Msg = {
  from: "cliente" | "argos";
  text: string;
  time: string;
};

const CONVERSA: Msg[] = [
  {
    from: "cliente",
    text: "Boa noite! Ainda tá aberto? Queria saber o valor do combo família 🍕",
    time: "22:47",
  },
  {
    from: "argos",
    text: "Boa noite! 😊 Estamos sim! O combo família sai por R$ 89,90 e inclui 2 pizzas grandes + refri 2L. Entregamos até 23h30. Quer que eu anote seu pedido?",
    time: "22:47",
  },
  {
    from: "cliente",
    text: "Quero sim! Pode ser uma calabresa e uma quatro queijos",
    time: "22:48",
  },
  {
    from: "argos",
    text: "Perfeito! Combo família com calabresa + quatro queijos + refri 2L = R$ 89,90. Me passa seu endereço que eu já calculo a entrega? 🛵",
    time: "22:48",
  },
];

// Mockup ilustrativo de um atendimento feito pela IA dentro do WhatsApp Web.
export function WhatsAppDemo({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <div className="overflow-hidden rounded-xl border shadow-lg">
        {/* Barra do chat */}
        <div className="flex items-center gap-3 border-b bg-muted px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Cliente</p>
            <p className="text-xs text-muted-foreground">online</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            <Sparkles className="h-3 w-3" /> IA ativa
          </span>
        </div>

        {/* Mensagens */}
        <div className="space-y-2.5 bg-muted/40 px-4 py-5">
          {CONVERSA.map((m, i) => (
            <div key={i} className={`flex ${m.from === "argos" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                  m.from === "argos"
                    ? "rounded-br-none bg-primary/15 text-foreground"
                    : "rounded-bl-none border bg-background"
                }`}
              >
                <p>{m.text}</p>
                <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                  {m.time}
                  {m.from === "argos" && (
                    <span className="inline-flex text-primary">
                      <Check className="h-3 w-3" />
                      <Check className="-ml-2 h-3 w-3" />
                    </span>
                  )}
                </p>
              </div>
            </div>
          ))}
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-background px-2.5 py-1 text-[11px] font-medium text-primary shadow-sm">
              <Sparkles className="h-3 w-3" /> Respondido pela Argos em segundos
            </span>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Simulação ilustrativa de um atendimento feito pela Argos às 22h47, fora do horário
        comercial.
      </p>
    </div>
  );
}
