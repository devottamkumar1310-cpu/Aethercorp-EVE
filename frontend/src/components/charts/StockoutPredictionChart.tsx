"use client";

import { DashboardMetrics } from "@/types/dashboard";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Props {
  metrics: DashboardMetrics | null;
}

export function StockoutPredictionChart({ metrics }: Props) {
  if (!metrics || metrics.stockout_predictions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Stockout Predictions</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
          No data available
        </CardContent>
      </Card>
    );
  }

  const data = metrics.stockout_predictions
    .slice()
    .sort((a, b) => a.days_until_stockout - b.days_until_stockout)
    .slice(0, 10); // Show top 10

  return (
    <Card>
      <CardHeader>
        <CardTitle>Days Until Stockout</CardTitle>
        <CardDescription>Top 10 most critical SKUs</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorDays" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="sku" tick={{fontSize: 10}} interval={0} angle={-45} textAnchor="end" height={60} />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="days_until_stockout" stroke="#ef4444" fillOpacity={1} fill="url(#colorDays)" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
