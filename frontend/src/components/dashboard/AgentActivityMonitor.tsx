import { ChatResponse } from "@/types/chat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Sparkles } from "lucide-react";

interface Props {
  chatData: ChatResponse | null;
}

export function AgentActivityMonitor({ chatData }: Props) {
  if (!chatData) {
    return (
      <Card className="h-full bg-background text-muted-foreground border-border">
        <CardHeader className="pb-2 border-b border-border">
          <CardTitle className="text-sm font-semibold flex items-center text-foreground">
            <Activity className="h-4 w-4 mr-2 text-primary" />
            Executive Intelligence Stream
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 text-xs text-muted-foreground italic">
          No executive activity recorded. Consult EVE AI CEO to generate operational intelligence.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full bg-background text-muted-foreground border-border overflow-hidden flex flex-col">
      <CardHeader className="pb-2 border-b border-border bg-card">
        <CardTitle className="text-sm font-semibold flex items-center text-foreground">
          <Activity className="h-4 w-4 mr-2 text-primary" />
          Executive Intelligence Stream
        </CardTitle>
      </CardHeader>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Available Advisory Roles</h4>
            <div className="flex flex-wrap gap-1">
              {chatData.discovered_agents.map((agent) => (
                <Badge key={agent} variant="outline" className="border-border bg-secondary text-foreground text-[11px] capitalize">
                  {agent.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Consulted Executive Advisors</h4>
            <div className="flex flex-wrap gap-1">
              {chatData.executed_agents.length > 0 ? (
                chatData.executed_agents.map((agent) => (
                  <Badge key={agent} className="bg-primary text-primary-foreground text-[11px] capitalize">
                    {agent.replace(/_/g, " ")}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Standard Direct Reasoning</span>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Operational Evidence Logs</h4>
            <div className="space-y-2">
              {chatData.event_bus_messages.map((msg, idx) => (
                <div key={idx} className="bg-card border border-border rounded-xl p-3 text-xs">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-semibold text-primary flex items-center gap-1">
                      <Sparkles size={12} /> {msg.topic.replace(/_/g, " ").toUpperCase()}
                    </span>
                    <span className="text-muted-foreground text-[11px]">Advisor: {msg.sender?.replace(/_/g, " ")}</span>
                  </div>
                  <div className="text-muted-foreground text-xs leading-relaxed space-y-1">
                    {typeof msg.data === "object" && msg.data !== null ? (
                      Object.entries(msg.data).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between border-b border-border/40 py-0.5 text-[11px]">
                          <span className="font-medium text-foreground capitalize">{k.replace(/_/g, " ")}:</span>
                          <span className="text-muted-foreground font-mono">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                        </div>
                      ))
                    ) : (
                      <p>{String(msg.data)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </ScrollArea>
    </Card>
  );
}
