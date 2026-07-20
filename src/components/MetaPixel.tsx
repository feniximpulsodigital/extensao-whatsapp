import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { getPublicMetaPixelId } from "@/lib/meta-pixel.functions";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

// Injeta o script padrão do Meta Pixel (client-side) e dispara PageView a
// cada navegação. Eventos de negócio (Purchase) são enviados só pelo
// servidor via Conversions API (src/lib/meta-capi.server.ts) — evita
// contar a mesma conversão duas vezes e não depende do navegador do
// cliente/ad blocker.
export function MetaPixel() {
  const fetchPixelId = useServerFn(getPublicMetaPixelId);
  const { data } = useQuery({
    queryKey: ["public-meta-pixel-id"],
    queryFn: () => fetchPixelId(),
    staleTime: 60 * 60 * 1000,
  });
  const pixelId = data?.pixelId;
  const router = useRouter();
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!pixelId || loadedRef.current || typeof window === "undefined") return;
    loadedRef.current = true;

    (function (f: Window, b: Document, e: string, v: string) {
      if (f.fbq) return;
      const n: any = (f.fbq = function (...args: unknown[]) {
        n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
      });
      f._fbq = f._fbq || n;
      n.push = n;
      n.loaded = true;
      n.version = "2.0";
      n.queue = [];
      const t = b.createElement(e) as HTMLScriptElement;
      t.async = true;
      t.src = v;
      const s = b.getElementsByTagName(e)[0];
      s.parentNode?.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

    window.fbq?.("init", pixelId);
    window.fbq?.("track", "PageView");
  }, [pixelId]);

  useEffect(() => {
    if (!pixelId) return;
    const unsubscribe = router.subscribe("onResolved", () => {
      window.fbq?.("track", "PageView");
    });
    return unsubscribe;
  }, [pixelId, router]);

  return null;
}
