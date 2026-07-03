import { ChatResponse } from "@/types/chat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal } from "lucide-react";

interface Props {
  chatData: ChatResponse | null;
}

export function AgentActivityMonitor({ chatData }: Props) {
  if (!chatData) {
    return (
      <Card className="h-full bg-slate-50 dark:bg-slate-900/80 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800">
        <CardHeader className="pb-2 border-b border-slate-200 dark:border-slate-800">
          <CardTitle className="text-sm font-medium flex items-center text-slate-900 dark:text-slate-100">
            <Terminal className="h-4 w-4 mr-2" />
            Agent Activity Monitor
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 text-sm text-slate-500 dark:text-slate-400 italic">
          No agent activity. Submit a request to the CEO Agent to view traces.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full bg-slate-50 dark:bg-slate-900/80 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
      <CardHeader className="pb-2 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/50">
        <CardTitle className="text-sm font-medium flex items-center text-slate-900 dark:text-slate-100">
          <Terminal className="h-4 w-4 mr-2 text-emerald-400" />
          Agent Activity Monitor
        </CardTitle>
      </CardHeader>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          
          <div>
            <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Network Discovery</h4>
            <div className="flex flex-wrap gap-1">
              {chatData.discovered_agents.map((agent) => (
                <Badge key={agent} variant="outline" className="border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {agent}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Executed Agents</h4>
            <div className="flex flex-wrap gap-1">
              {chatData.executed_agents.length > 0 ? (
                chatData.executed_agents.map((agent) => (
                  <Badge key={agent} className="bg-blue-600 hover:bg-blue-500 text-slate-900 dark:text-slate-100 dark:text-white">
                    {agent}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-slate-500 dark:text-slate-400">None</span>
              )}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Event Bus Traces</h4>
            <div className="space-y-2">
              {chatData.event_bus_messages.map((msg, idx) => (
                <div key={idx} className="bg-slate-100 dark:bg-slate-900/50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-2 text-xs font-mono">
                  <div className="flex justify-between mb-1">
                    <span className="text-emerald-400">[{msg.topic}]</span>
                    <span className="text-slate-500 dark:text-slate-400">Sender: {msg.sender}</span>
                  </div>
                  <pre className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap overflow-x-auto">
                    {JSON.stringify(msg.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>

        </div>
      </ScrollArea>
    </Card>
  );
}
