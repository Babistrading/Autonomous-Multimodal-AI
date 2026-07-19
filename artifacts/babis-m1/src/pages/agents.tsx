import { useListAgents } from "@workspace/api-client-react";
import { Bot, Terminal, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Agents() {
  const { data: agentsData, isLoading } = useListAgents(undefined, {
    query: { refetchInterval: 2000 }
  });

  const agents = Array.isArray(agentsData) ? agentsData : (agentsData as any)?.items || [];

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 lg:p-6 gap-6">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <Bot className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-foreground">AUTONOMOUS AGENTS</h1>
          <p className="text-sm font-mono text-muted-foreground">Self-directed sub-routines and prompters</p>
        </div>
      </div>

      {isLoading && agents.length === 0 ? (
        <div className="flex-1 flex items-center justify-center font-mono text-muted-foreground">
          <Activity className="w-6 h-6 mr-2 animate-spin" /> SYNCHRONIZING AGENTS...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {agents.map((agent: any) => {
            const isThinking = agent.status === "thinking";
            const isActive = agent.status === "active";
            const isError = agent.status === "error";
            
            return (
              <div 
                key={agent.id}
                className={cn(
                  "border border-border bg-card rounded-lg p-5 flex flex-col gap-4 relative overflow-hidden",
                  isThinking ? "border-primary/50" : ""
                )}
              >
                {/* Thinking scan line effect */}
                {isThinking && (
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-[shimmer_2s_infinite]"></div>
                )}
                
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-md",
                      isActive || isThinking ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-mono font-bold text-lg leading-tight">{agent.name}</h3>
                      <span className="inline-block font-mono text-[10px] uppercase text-muted-foreground">
                        {agent.type}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between font-mono text-xs mt-2 p-2 bg-muted/50 rounded border border-border/50">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "w-2 h-2 rounded-full",
                      isActive ? "bg-secondary" : 
                      isThinking ? "bg-primary pulse-cyan" : 
                      isError ? "bg-destructive" : "bg-muted-foreground"
                    )}></span>
                    <span className={cn(
                      "uppercase tracking-wider",
                      isThinking ? "text-primary" : isActive ? "text-secondary" : "text-muted-foreground"
                    )}>
                      {agent.status}
                    </span>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-1">
                    TASKS: <span className="text-foreground font-bold">{agent.taskCount}</span>
                  </div>
                </div>

                <div className="mt-auto pt-2">
                  <div className="text-[10px] text-muted-foreground uppercase mb-1 flex items-center gap-1">
                    <Terminal className="w-3 h-3" /> Last Action
                  </div>
                  <div className="font-mono text-xs text-foreground/80 truncate border-l-2 border-border pl-2 py-1 bg-background/50">
                    {agent.lastAction || "Awaiting instructions..."}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
