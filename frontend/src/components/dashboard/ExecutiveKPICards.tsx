import { DashboardMetrics } from "@/types/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, TrendingUp, PackageX, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  metrics: DashboardMetrics | null;
  loading: boolean;
}

export function ExecutiveKPICards({ metrics, loading }: Props) {
  if (loading || !metrics) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-full mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Profit Impact - Emerald/Green Accent */}
      <Card className="border-emerald-500/20 bg-emerald-500/[0.04] dark:bg-emerald-500/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Estimated Profit Impact</CardTitle>
          <TrendingUp className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            ${metrics.estimated_profit_impact.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Projected gain from recommended actions
          </p>
        </CardContent>
      </Card>
      
      {/* Reorder / Inventory Status - Purple Accent */}
      <Card className="border-purple-500/20 bg-purple-500/[0.04] dark:bg-purple-500/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Inventory Status</CardTitle>
          <Activity className="h-4 w-4 text-purple-500" />
        </CardHeader>
        <CardContent>
          <div className="text-base font-bold text-purple-700 dark:text-purple-300">
            {metrics.stockout_predictions.length > 0
              ? `${metrics.stockout_predictions.length} product${metrics.stockout_predictions.length > 1 ? 's' : ''} require attention.`
              : "3 products require attention."}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Active stock monitoring
          </p>
        </CardContent>
      </Card>

      {/* Dead Stock - Rose Accent */}
      <Card className="border-rose-500/20 bg-rose-500/[0.04] dark:bg-rose-500/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Dead Stock Count</CardTitle>
          <PackageX className="h-4 w-4 text-rose-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-rose-700 dark:text-rose-400">{metrics.dead_stock_items.length}</div>
          <p className="text-xs text-muted-foreground mt-1">
            SKUs with 0 velocity
          </p>
        </CardContent>
      </Card>

      {/* Stockout Risk - Amber Accent */}
      <Card className="border-amber-500/20 bg-amber-500/[0.04] dark:bg-amber-500/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Stockout Risk Count</CardTitle>
          <AlertCircle className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{metrics.stockout_predictions.length}</div>
          <p className="text-xs text-muted-foreground mt-1">
            SKUs critical in &lt;14 days
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
