"use client";

import { DashboardMetrics } from "@/types/dashboard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Props {
  metrics: DashboardMetrics | null;
}

export function ProfitImpactChart({ metrics }: Props) {
  if (!metrics || metrics.pricing_recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Margin Optimization</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
          No data available
        </CardContent>
      </Card>
    );
  }

  const data = metrics.pricing_recommendations.slice(0, 5).map(rec => ({
    sku: rec.sku,
    "Current Price": rec.current_price,
    "Recommended Price": rec.recommended_price,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Margin Optimization</CardTitle>
        <CardDescription>Price adjustment recommendations</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="sku" />
            <YAxis />
            <Tooltip cursor={{ fill: "transparent" }} />
            <Legend />
            <Bar dataKey="Current Price" fill="#94a3b8" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Recommended Price" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
