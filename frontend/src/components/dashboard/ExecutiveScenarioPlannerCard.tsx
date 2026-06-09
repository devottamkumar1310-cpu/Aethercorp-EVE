import { TopAction } from "@/types/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  actions?: TopAction[];
  loading: boolean;
}

export function ExecutiveScenarioPlannerCard({ actions, loading }: Props) {
  if (loading) {
    return (
      <Card className="border-indigo-200 bg-indigo-50/30">
        <CardHeader>
          <CardTitle className="text-sm flex items-center">
            <Lightbulb className="h-4 w-4 mr-2" />
            Top 3 Actions For Next 30 Days
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!actions || actions.length === 0) {
    return null;
  }

  return (
    <Card className="border-indigo-200 shadow-sm bg-gradient-to-br from-indigo-50/50 to-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center text-indigo-900">
          <Lightbulb className="h-4 w-4 mr-2 text-indigo-600" />
          Executive Action Planner - Next 30 Days
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {actions.map((action, idx) => (
            <div key={idx} className="flex items-start bg-white p-3 rounded-md border border-indigo-100 shadow-sm">
              <div className="mr-3 mt-0.5">
                <CheckCircle2 className="h-5 w-5 text-indigo-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm text-slate-800">{action.action}</p>
                <p className="text-xs text-slate-500 mt-1">{action.impact}</p>
              </div>
              <div className="ml-3 flex flex-col items-end">
                <Badge variant="outline" className="text-[10px] bg-slate-50">
                  Confidence
                </Badge>
                <span className="text-sm font-bold text-indigo-700 mt-1">{action.confidence_score}%</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
