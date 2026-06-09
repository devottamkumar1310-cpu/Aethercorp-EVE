import { DashboardMetrics } from "@/types/dashboard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface Props {
  metrics: DashboardMetrics | null;
  loading: boolean;
}

export function PricingRecommendationsTable({ metrics, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!metrics || metrics.pricing_recommendations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border rounded-md border-dashed">
        No pricing recommendations at this time.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SKU</TableHead>
            <TableHead>Current Price</TableHead>
            <TableHead>Rec. Price</TableHead>
            <TableHead>Margin %</TableHead>
            <TableHead className="w-[300px]">Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {metrics.pricing_recommendations.map((rec) => (
            <TableRow key={rec.sku}>
              <TableCell className="font-medium">{rec.sku}</TableCell>
              <TableCell>${rec.current_price.toFixed(2)}</TableCell>
              <TableCell className="font-bold text-emerald-600">
                ${rec.recommended_price.toFixed(2)}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  {rec.current_margin_percent.toFixed(1)}%
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{rec.reason}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
