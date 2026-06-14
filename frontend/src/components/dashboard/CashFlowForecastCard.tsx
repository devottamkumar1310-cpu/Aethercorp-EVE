import { CashFlowForecast } from "@/types/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, AlertTriangle, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  forecast?: CashFlowForecast;
  loading: boolean;
}

export function CashFlowForecastCard({ forecast, loading }: Props) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center">
            <DollarSign className="h-4 w-4 mr-2" />
            Cash Flow Forecast (30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!forecast) {
    return null;
  }

  const isHighRisk = forecast.cash_flow_risk.toLowerCase().includes("high");

  return (
    <Card className={`border-${isHighRisk ? 'orange' : 'emerald'}-200 bg-${isHighRisk ? 'orange' : 'emerald'}-50/30`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center text-slate-800">
          <DollarSign className={`h-4 w-4 mr-2 text-${isHighRisk ? 'orange' : 'emerald'}-600`} />
          Cash Flow Forecast (30 Days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 uppercase font-semibold">Required Working Capital</p>
            <p className="text-2xl font-bold mt-1">
              ${forecast.required_working_capital.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-slate-500 mt-1">Includes ${forecast.reorder_cost.toLocaleString()} reorder cost</p>
          </div>
          <div className="flex flex-col items-end justify-center max-w-[70%]">
            <span className="text-xs font-semibold text-amber-600 text-right leading-snug">
              {isHighRisk 
                ? "Additional working capital may be required next month."
                : "Capital levels are projected to be stable."}
            </span>
            <p className="text-xs text-slate-500 mt-2">Confidence: {forecast.confidence_score}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
