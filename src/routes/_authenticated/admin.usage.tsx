import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminUsageReport, adminGetPricingConfig } from "@/lib/ai-credits.functions";

export const Route = createFileRoute("/_authenticated/admin/usage")({
  component: UsagePage,
});

function UsagePage() {
  const report = useServerFn(adminUsageReport);
  const cfg = useServerFn(adminGetPricingConfig);
  const [days, setDays] = useState(30);
  const { data: rows } = useQuery({ queryKey: ["usage", days], queryFn: () => report({ data: { days } }) });
  const { data: pricing } = useQuery({ queryKey: ["pricing-config"], queryFn: () => cfg() });

  const totals = (rows ?? []).reduce(
    (acc, r: any) => {
      acc.cost += Number(r.cost_usd_real);
      acc.credits += r.credits_charged;
      return acc;
    },
    { cost: 0, credits: 0 }
  );
  const usdToBrl = Number(pricing?.usd_to_brl ?? 5.2);
  const creditsPerUsd = Number(pricing?.credits_per_usd ?? 1000);
  // Revenue estimate: credits debited represent value; convert back via creditsPerUsd
  const revenueUsd = totals.credits / creditsPerUsd;
  const marginUsd = revenueUsd - totals.cost;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Uso & Margem</CardTitle>
          <CardDescription>Custo real da IA × créditos debitados dos clientes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div>
              <Label>Período (dias)</Label>
              <Input type="number" className="w-32" value={days} onChange={(e) => setDays(parseInt(e.target.value || "30"))} />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Card><CardHeader><CardDescription>Custo real</CardDescription><CardTitle>US$ {totals.cost.toFixed(4)}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>≈ em BRL</CardDescription><CardTitle>R$ {(totals.cost * usdToBrl).toFixed(2)}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>Receita equiv. (créditos)</CardDescription><CardTitle>R$ {(revenueUsd * usdToBrl).toFixed(2)}</CardTitle></CardHeader></Card>
            <Card><CardHeader><CardDescription>Margem estimada</CardDescription><CardTitle>R$ {(marginUsd * usdToBrl).toFixed(2)}</CardTitle></CardHeader></Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Chamadas recentes</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Tokens in</TableHead>
                <TableHead>Tokens out</TableHead>
                <TableHead>Custo USD</TableHead>
                <TableHead>Créditos</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? []).map((r: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell>{r.tenants?.company_name ?? r.tenant_id.slice(0, 8)}</TableCell>
                  <TableCell>{r.model}</TableCell>
                  <TableCell>{r.input_tokens}</TableCell>
                  <TableCell>{r.output_tokens}</TableCell>
                  <TableCell>${Number(r.cost_usd_real).toFixed(5)}</TableCell>
                  <TableCell>{r.credits_charged}</TableCell>
                  <TableCell>{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                </TableRow>
              ))}
              {(rows ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sem registros no período</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
