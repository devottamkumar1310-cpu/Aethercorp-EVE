import { DashboardMetrics } from "@/types/dashboard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  metrics: DashboardMetrics | null;
  loading: boolean;
}

export function InventoryHealthTable({ metrics, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!metrics || (metrics.stockout_predictions.length === 0 && metrics.reorder_recommendations.length === 0)) {
    return (
      <div className="text-center py-8 text-muted-foreground border rounded-md border-dashed">
        No inventory data uploaded yet or no action required.
      </div>
    );
  }

  // Combine data by SKU
  const combinedData = new Map<string, { days_until_stockout?: number; recommended_reorder?: number }>();
  
  metrics.stockout_predictions.forEach((s) => {
    combinedData.set(s.sku, { ...combinedData.get(s.sku), days_until_stockout: s.days_until_stockout });
  });

  metrics.reorder_recommendations.forEach((r) => {
    combinedData.set(r.sku, { ...combinedData.get(r.sku), recommended_reorder: r.recommended_reorder });
  });

  const rows = Array.from(combinedData.entries()).map(([sku, data]) => ({
    sku,
    ...data,
  }));

  // Sort by most critical stockout risk first
  rows.sort((a, b) => (a.days_until_stockout ?? 999) - (b.days_until_stockout ?? 999));

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SKU</TableHead>
            <TableHead>Days Until Stockout</TableHead>
            <TableHead>Risk Level</TableHead>
            <TableHead className="text-right">Recommended Reorder</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.sku}>
              <TableCell className="font-medium">{row.sku}</TableCell>
              <TableCell>
                {row.days_until_stockout !== undefined ? row.days_until_stockout.toFixed(1) : "-"}
              </TableCell>
              <TableCell>
                {row.days_until_stockout !== undefined ? (
                  row.days_until_stockout < 5 ? (
                    <Badge variant="destructive">Critical</Badge>
                  ) : row.days_until_stockout < 14 ? (
                    <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">High</Badge>
                  ) : (
                    <Badge variant="secondary">Moderate</Badge>
                  )
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell className="text-right font-bold text-blue-600">
                {row.recommended_reorder ? `+${row.recommended_reorder} units` : "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
