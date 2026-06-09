"use client";

import { DashboardMetrics } from "@/types/dashboard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Props {
  metrics: DashboardMetrics | null;
}

export function InventoryRiskChart({ metrics }: Props) {
  if (!metrics || metrics.stockout_predictions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Inventory Risk Distribution</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
          No data available
        </CardContent>
      </Card>
    );
  }

  // Group SKUs into Risk Buckets
  let critical = 0;
  let high = 0;
  let moderate = 0;

  metrics.stockout_predictions.forEach(p => {
    if (p.days_until_stockout < 5) critical++;
    else if (p.days_until_stockout < 14) high++;
    else moderate++;
  });

  const data = [
    { name: "Critical (<5d)", count: critical, fill: "#ef4444" },
    { name: "High (<14d)", count: high, fill: "#eab308" },
    { name: "Moderate", count: moderate, fill: "#3b82f6" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory Risk</CardTitle>
        <CardDescription>Number of SKUs by stockout risk level</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "transparent" }}
              contentStyle={{ borderRadius: "8px" }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
