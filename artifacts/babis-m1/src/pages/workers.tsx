import { useListWorkers } from "@workspace/api-client-react";
import { Server, Activity, Database, AlertCircle, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Workers() {
  const { data: workersData, isLoading } = useListWorkers(undefined, {
    query: { refetchInterval: 2000 }
  });

  const workers = Array.isArray(workersData) ? workersData : (workersData as any)?.items || [];

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 lg:p-6 gap-6">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <Server className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-foreground">WORKER CLUSTER</h1>
          <p className="text-sm font-mono text-muted-foreground">Distributed compute nodes active</p>
        </div>
      </div>

      {isLoading && workers.length === 0 ? (
        <div className="flex-1 flex items-center justify-center font-mono text-muted-foreground">
          <Activity className="w-6 h-6 mr-2 animate-spin" /> SCANNING CLUSTER...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {workers.map((worker: any) => {
            const isRunning = worker.status === "running";
            const isError = worker.status === "error";
            const isPaused = worker.status === "paused";
            
            return (
              <div 
                key={worker.id}
                className={cn(
                  "border border-border bg-card rounded-lg p-5 flex flex-col gap-4 transition-all relative overflow-hidden",
                  isRunning ? "shadow-[0_0_15px_rgba(0,212,255,0.1)] border-primary/30" : ""
                )}
              >
                {/* Status Dot Background Glow */}
                {isRunning && (
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl"></div>
                )}
                
                <div className="flex justify-between items-start z-10">
                  <div>
                    <h3 className="font-mono font-bold text-lg">{worker.name}</h3>
                    <span className="inline-block mt-1 font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                      {worker.type}
                    </span>
                  </div>
                  <div className="relative flex h-4 w-4 mt-1">
                    {isRunning && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    )}
                    <span className={cn(
                      "relative inline-flex rounded-full h-4 w-4",
                      isRunning ? "bg-primary" : 
                      isError ? "bg-destructive" : 
                      isPaused ? "bg-chart-3" : "bg-muted-foreground"
                    )}></span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm font-mono z-10 mt-2">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase mb-1">Queue</div>
                    <div className="font-bold flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-muted-foreground" />
                      {worker.queueSize}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase mb-1">Tokens/sec</div>
                    <div className="font-bold flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-secondary" />
                      <span className="text-secondary">{Number(worker.tokensPerSecond).toFixed(1)}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase mb-1">Processed</div>
                    <div className="font-bold">{worker.processed.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase mb-1">Errors</div>
                    <div className={cn("font-bold flex items-center gap-1.5", worker.errors > 0 ? "text-destructive" : "text-foreground")}>
                      {worker.errors > 0 && <AlertCircle className="w-3.5 h-3.5" />}
                      {worker.errors}
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-border z-10">
                  <div className="text-[10px] text-muted-foreground uppercase mb-1">Current Task</div>
                  <div className="font-mono text-xs text-primary truncate bg-primary/5 px-2 py-1.5 rounded border border-primary/10">
                    {worker.currentTask || "IDLE"}
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
