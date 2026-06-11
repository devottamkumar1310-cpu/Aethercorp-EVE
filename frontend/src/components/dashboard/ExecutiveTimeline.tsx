import { ActivityLog } from "@/types/business";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Briefcase, 
  CheckSquare, 
  DollarSign, 
  Package, 
  Brain, 
  Sparkles, 
  Clock, 
  Compass
} from "lucide-react";

interface Props {
  logs: ActivityLog[];
}

export function ExecutiveTimeline({ logs }: Props) {
  const getEventMeta = (entityType: string, action: string) => {
    const type = entityType.toLowerCase();
    const act = action.toLowerCase();
    
    if (type.includes("client")) {
      return {
        icon: Users,
        iconClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        badgeVariant: "default" as const,
        badgeClass: "bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 border-blue-500/20",
        label: "Client Ops"
      };
    }
    if (type.includes("project")) {
      return {
        icon: Briefcase,
        iconClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
        badgeVariant: "default" as const,
        badgeClass: "bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 border-indigo-500/20",
        label: "Project"
      };
    }
    if (type.includes("task")) {
      return {
        icon: CheckSquare,
        iconClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
        badgeVariant: "default" as const,
        badgeClass: "bg-cyan-600/10 text-cyan-400 hover:bg-cyan-600/20 border-cyan-500/20",
        label: "Task"
      };
    }
    if (type.includes("finance") || type.includes("revenue") || type.includes("expense") || act.includes("profit")) {
      const isExpense = act.includes("expense") || type.includes("expense");
      return {
        icon: DollarSign,
        iconClass: isExpense ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        badgeVariant: "default" as const,
        badgeClass: isExpense 
          ? "bg-rose-600/10 text-rose-400 hover:bg-rose-600/20 border-rose-500/20" 
          : "bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 border-emerald-500/20",
        label: isExpense ? "Expense" : "Revenue"
      };
    }
    if (type.includes("inventory") || type.includes("product") || type.includes("csv")) {
      return {
        icon: Package,
        iconClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        badgeVariant: "default" as const,
        badgeClass: "bg-amber-600/10 text-amber-400 hover:bg-amber-600/20 border-amber-500/20",
        label: "Inventory"
      };
    }
    if (type.includes("ai") || type.includes("recommendation") || type.includes("coo") || type.includes("executive")) {
      return {
        icon: Brain,
        iconClass: "bg-violet-500/10 text-violet-400 border-violet-500/20",
        badgeVariant: "default" as const,
        badgeClass: "bg-violet-600/10 text-violet-400 hover:bg-violet-600/20 border-violet-500/20",
        label: "EVE COO"
      };
    }
    return {
      icon: Sparkles,
      iconClass: "bg-slate-500/10 text-slate-400 border-slate-700/20",
      badgeVariant: "outline" as const,
      badgeClass: "border-slate-700 text-slate-400 bg-slate-800/30",
      label: "System"
    };
  };

  return (
    <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
      <CardHeader className="bg-slate-50 border-b border-slate-200/60 px-6 py-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Compass className="h-4 w-4 text-indigo-500" />
          Executive Operations & Activity Timeline
        </CardTitle>
        <span className="text-[10px] text-slate-500 font-semibold bg-slate-200/50 px-2 py-0.5 rounded-full uppercase tracking-wider">
          Real-time Audit Feed
        </span>
      </CardHeader>
      <CardContent className="p-6">
        <div className="relative border-l border-slate-200 ml-4 pl-6 space-y-6">
          {logs.map((log) => {
            const meta = getEventMeta(log.entity_type, log.action);
            const Icon = meta.icon;
            
            return (
              <div key={log.id} className="relative group">
                {/* Timeline dot icon */}
                <div className={`absolute -left-[35px] top-0.5 w-6 h-6 rounded-full border flex items-center justify-center transition-all group-hover:scale-110 shadow-sm ${meta.iconClass}`}>
                  <Icon size={12} />
                </div>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-800 tracking-tight">
                        {log.action}
                      </span>
                      <Badge variant={meta.badgeVariant} className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.2 rounded ${meta.badgeClass}`}>
                        {meta.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed font-normal max-w-2xl">
                      {log.description}
                    </p>
                  </div>
                  
                  {/* Timestamp */}
                  <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5 whitespace-nowrap">
                    <Clock size={11} className="text-slate-300" />
                    {new Date(log.created_at).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </div>
                </div>
              </div>
            );
          })}
          
          {logs.length === 0 && (
            <div className="text-slate-400 italic text-center py-8 text-sm">
              No recent activity recorded in this workspace. Create clients or run AI checks to populate the feed.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
