import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BrainCircuit } from "lucide-react";

interface Props {
  summary: string | null;
  loading: boolean;
}

export function ExecutiveSummaryCard({ summary, loading }: Props) {
  return (
    <Card className="border-blue-200 shadow-sm bg-blue-50/30">
      <CardHeader className="flex flex-row items-center pb-2">
        <BrainCircuit className="h-5 w-5 text-blue-600 mr-2" />
        <CardTitle className="text-lg font-semibold text-blue-900">Executive Summary</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[90%]" />
            <Skeleton className="h-4 w-[80%]" />
          </div>
        ) : summary ? (
          <p className="text-blue-800 leading-relaxed font-medium">
            {summary}
          </p>
        ) : (
          <p className="text-blue-800/60 italic">No summary generated yet. Upload data to view insights.</p>
        )}
      </CardContent>
    </Card>
  );
}
