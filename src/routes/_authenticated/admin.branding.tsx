import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getBrandingSettings, updateBrandingSettings } from "@/lib/branding.functions";

export const Route = createFileRoute("/_authenticated/admin/branding")({
  head: () => ({ meta: [{ title: "Visual — Argos Admin" }] }),
  component: BrandingPage,
});

function BrandingPage() {
  const fetchFn = useServerFn(getBrandingSettings);
  const saveFn = useServerFn(updateBrandingSettings);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["branding-settings"],
    queryFn: () => fetchFn(),
  });

  const [form, setForm] = useState({
    brandName: "Argos Zap",
    brandLogoUrl: "",
    accentLight: "#0F6E56",
    accentDark: "#39FF8A",
  });

  useEffect(() => {
    if (data) {
      setForm({
        brandName: data.brandName,
        brandLogoUrl: data.brandLogoUrl ?? "",
        accentLight: data.accentLight,
        accentDark: data.accentDark,
      });
    }
  }, [data]);

  const mut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          brandName: form.brandName,
          brandLogoUrl: form.brandLogoUrl || null,
          accentLight: form.accentLight,
          accentDark: form.accentDark,
        },
      }),
    onSuccess: () => {
      toast.success("Visual atualizado");
      qc.invalidateQueries({ queryKey: ["branding-settings"] });
      qc.invalidateQueries({ queryKey: ["public-branding"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p>Carregando...</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identidade visual</CardTitle>
          <CardDescription>
            Customize o nome, logo e cores de destaque do app. Vale para tema claro e escuro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="brandName">Nome da marca</Label>
            <Input
              id="brandName"
              value={form.brandName}
              onChange={(e) => setForm({ ...form, brandName: e.target.value })}
              placeholder="Argos Zap"
            />
            <p className="text-xs text-muted-foreground">
              Primeira palavra fica na cor do texto; o restante usa a cor de destaque.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="brandLogoUrl">URL do logo (opcional)</Label>
            <Input
              id="brandLogoUrl"
              type="url"
              value={form.brandLogoUrl}
              onChange={(e) => setForm({ ...form, brandLogoUrl: e.target.value })}
              placeholder="https://..."
            />
            <p className="text-xs text-muted-foreground">
              Deixe vazio para usar o ícone padrão do Argos Zap.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="accentLight">Cor de destaque — Tema claro</Label>
              <div className="flex gap-2">
                <Input
                  id="accentLight"
                  type="color"
                  value={form.accentLight}
                  onChange={(e) => setForm({ ...form, accentLight: e.target.value })}
                  className="h-10 w-16 p-1"
                />
                <Input
                  value={form.accentLight}
                  onChange={(e) => setForm({ ...form, accentLight: e.target.value })}
                  placeholder="#0F6E56"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accentDark">Cor de destaque — Tema escuro</Label>
              <div className="flex gap-2">
                <Input
                  id="accentDark"
                  type="color"
                  value={form.accentDark}
                  onChange={(e) => setForm({ ...form, accentDark: e.target.value })}
                  className="h-10 w-16 p-1"
                />
                <Input
                  value={form.accentDark}
                  onChange={(e) => setForm({ ...form, accentDark: e.target.value })}
                  placeholder="#39FF8A"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <p className="mb-3 text-sm font-medium">Preview</p>
            <div className="flex items-center gap-4">
              {form.brandLogoUrl && (
                <img
                  src={form.brandLogoUrl}
                  alt="logo preview"
                  className="h-10 w-auto"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                />
              )}
              <span className="text-xl font-bold">
                {form.brandName.split(" ")[0]}
                <span style={{ color: form.accentLight }}>
                  {form.brandName.split(" ").slice(1).join(" ") &&
                    ` ${form.brandName.split(" ").slice(1).join(" ")}`}
                </span>
              </span>
              <div className="flex gap-2">
                <div
                  className="h-8 w-8 rounded border"
                  style={{ background: form.accentLight }}
                  title="Light"
                />
                <div
                  className="h-8 w-8 rounded border"
                  style={{ background: form.accentDark }}
                  title="Dark"
                />
              </div>
            </div>
          </div>

          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
