import { useMemo, useState } from "react";
import { 
  useGetTrainingStatus, 
  useStartTraining, 
  useStopTraining, 
  usePauseTraining, 
  useResumeTraining, 
  useSetPowerMode, 
  useSaveCheckpoint, 
  useGetTrainingMetrics, 
  useGetTrainingLogs,
  useGetHardwareMetrics,
  getGetTrainingStatusQueryKey,
  getGetTrainingMetricsQueryKey,
  getGetTrainingLogsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer 
} from "recharts";
import { 
  Play, Square, Pause, RotateCcw, Save, Download, 
  Cpu, HardDrive, Activity, Zap, AlertTriangle, CheckCircle2, Info, TerminalSquare
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function TrainingDashboard() {
  const queryClient = useQueryClient();
  const [autoScroll, setAutoScroll] = useState(true);

  // Queries
  const { data: status } = useGetTrainingStatus(undefined, {
    query: { refetchInterval: 1000 }
  });
  
  const { data: metricsData } = useGetTrainingMetrics({ limit: 100 }, {
    query: { refetchInterval: 2000 }
  });
  
  const { data: logsData } = useGetTrainingLogs({ limit: 50 }, {
    query: { refetchInterval: 2000 }
  });

  const { data: hardware } = useGetHardwareMetrics(undefined, {
    query: { refetchInterval: 5000 }
  });

  // Mutations
  const startTraining = useStartTraining();
  const stopTraining = useStopTraining();
  const pauseTraining = usePauseTraining();
  const resumeTraining = useResumeTraining();
  const setPowerMode = useSetPowerMode();
  const saveCheckpoint = useSaveCheckpoint();

  // Handlers
  const handleAction = (mutation: any, data?: any) => {
    mutation.mutate(data ? { data } : {}, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTrainingStatusQueryKey() });
      }
    });
  };

  // Formatters
  const formatTime = (seconds: number) => {
    if (!seconds) return "00:00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const isRunning = status?.status === "running";
  const isPaused = status?.status === "paused";

  // Data prep for chart
  const chartData = useMemo(() => {
    if (!metricsData) return [];
    // Orval generated list endpoints typically return the array directly if spec says so.
    // If it returns { items: [] } we'd need to map. Assuming direct array.
    const arr = Array.isArray(metricsData) ? metricsData : (metricsData as any).items || [];
    return [...arr].reverse().map(m => ({
      ...m,
      loss: Number(m.loss?.toFixed(4)),
      valLoss: m.validationLoss ? Number(m.validationLoss.toFixed(4)) : null,
    }));
  }, [metricsData]);

  // Logs array
  const logs = useMemo(() => {
    if (!logsData) return [];
    return Array.isArray(logsData) ? logsData : (logsData as any).items || [];
  }, [logsData]);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 lg:p-6 gap-6 space-bg">
      {/* 1. STATUS BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-border bg-card p-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-primary/20 text-primary p-2 rounded">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-mono tracking-tight text-foreground flex items-center gap-2">
              BABIS M1 <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">v1.0</span>
            </h1>
            <div className="flex items-center gap-3 mt-1 font-mono text-xs">
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  status?.status === "running" ? "bg-secondary pulse-emerald" : 
                  status?.status === "paused" ? "bg-chart-3" : 
                  status?.status === "error" ? "bg-destructive" : "bg-muted-foreground"
                )}></span>
                <span className="uppercase text-muted-foreground">
                  {status?.status || "UNKNOWN"}
                </span>
              </div>
              <span className="text-muted-foreground">|</span>
              <span className="text-primary uppercase flex items-center gap-1">
                <Zap className="w-3 h-3" /> PWR: {status?.powerMode || "LOW"}
              </span>
            </div>
          </div>
        </div>

        {/* 4. CONTROLS (Moved to top right for better access) */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {(!isRunning && !isPaused) ? (
            <button 
              onClick={() => handleAction(startTraining)}
              disabled={startTraining.isPending}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded font-mono text-sm font-bold transition-all disabled:opacity-50"
            >
              <Play className="w-4 h-4" /> START TRAINING
            </button>
          ) : (
            <button 
              onClick={() => handleAction(stopTraining)}
              disabled={stopTraining.isPending}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 px-4 py-2 rounded font-mono text-sm font-bold transition-all disabled:opacity-50"
            >
              <Square className="w-4 h-4 fill-current" /> STOP
            </button>
          )}

          {isRunning && (
            <button 
              onClick={() => handleAction(pauseTraining)}
              disabled={pauseTraining.isPending}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-chart-3 text-background hover:bg-chart-3/90 px-4 py-2 rounded font-mono text-sm font-bold transition-all disabled:opacity-50"
            >
              <Pause className="w-4 h-4" /> PAUSE
            </button>
          )}

          {isPaused && (
            <button 
              onClick={() => handleAction(resumeTraining)}
              disabled={resumeTraining.isPending}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-secondary text-background hover:bg-secondary/90 px-4 py-2 rounded font-mono text-sm font-bold transition-all disabled:opacity-50"
            >
              <Play className="w-4 h-4" /> RESUME
            </button>
          )}

          <div className="w-px h-8 bg-border hidden sm:block mx-1"></div>

          <button 
            onClick={() => handleAction(saveCheckpoint)}
            disabled={saveCheckpoint.isPending || !isRunning}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 border border-border bg-transparent hover:bg-muted text-foreground px-3 py-2 rounded font-mono text-sm transition-all disabled:opacity-50"
            title="Save Checkpoint"
          >
            <Save className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. LIVE METRICS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <MetricCard title="EPOCH" value={status?.epoch || 0} />
        <MetricCard title="STEP" value={formatNumber(status?.step || 0)} />
        <MetricCard 
          title="LOSS" 
          value={status?.loss?.toFixed(4) || "---"} 
          valueColor={
            status?.loss ? (status.loss > 2 ? "text-destructive" : status.loss < 0.5 ? "text-secondary" : "text-foreground") : "text-foreground"
          }
        />
        <MetricCard title="VAL LOSS" value={status?.validationLoss?.toFixed(4) || "---"} />
        <MetricCard title="LEARNING RATE" value={status?.learningRate?.toExponential(2) || "---"} />
        <MetricCard title="TOKENS/SEC" value={formatNumber(status?.tokensPerSecond || 0)} valueColor="text-primary" />
        <MetricCard title="TOKENS PROCESSED" value={formatNumber(status?.tokensProcessed || 0)} />
        <MetricCard title="PERPLEXITY" value={status?.perplexity?.toFixed(2) || "---"} />
        <MetricCard title="TRAINING TIME" value={formatTime(status?.trainingTimeSeconds || 0)} />
        
        {/* 5. POWER MODE TOGGLES (Embedded as a card) */}
        <div className="col-span-2 md:col-span-3 lg:col-span-1 border border-border bg-card rounded-lg p-4 flex flex-col justify-between">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">POWER MODE</div>
          <div className="grid grid-cols-4 gap-1 h-full">
            {["low", "medium", "high", "max"].map((mode) => (
              <button
                key={mode}
                onClick={() => handleAction(setPowerMode, { powerMode: mode })}
                className={cn(
                  "text-[10px] sm:text-xs font-mono font-bold rounded transition-colors",
                  status?.powerMode === mode 
                    ? mode === "max" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                {mode.substring(0, 3)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3. LOSS CHART */}
        <div className="lg:col-span-2 border border-border bg-card rounded-lg p-4 flex flex-col h-[400px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-mono text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Activity className="w-4 h-4" /> LOSS CURVE
            </h3>
            <div className="flex gap-4 font-mono text-xs">
              <div className="flex items-center gap-1 text-primary">
                <div className="w-2 h-2 bg-primary rounded-full"></div> Train
              </div>
              <div className="flex items-center gap-1 text-secondary">
                <div className="w-2 h-2 bg-secondary rounded-full"></div> Val
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-0 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis 
                  dataKey="step" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10} 
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${(val/1000).toFixed(1)}k`}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '4px' }}
                  itemStyle={{ fontFamily: 'monospace', fontSize: '12px' }}
                  labelStyle={{ fontFamily: 'monospace', fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="loss" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2} 
                  dot={false}
                  isAnimationActive={false} 
                />
                <Line 
                  type="monotone" 
                  dataKey="valLoss" 
                  stroke="hsl(var(--secondary))" 
                  strokeWidth={2} 
                  dot={false}
                  isAnimationActive={false} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 6. HARDWARE & 7. LOGS (Split right column) */}
        <div className="flex flex-col gap-6 h-[400px]">
          {/* HARDWARE */}
          <div className="border border-border bg-card rounded-lg p-4 shrink-0">
            <h3 className="font-mono text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
              <HardDrive className="w-4 h-4" /> HARDWARE
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between font-mono text-xs mb-1">
                  <span className="text-foreground">CPU</span>
                  <span className="text-primary">{hardware?.cpuUsagePercent?.toFixed(1) || 0}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${hardware?.cpuUsagePercent || 0}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between font-mono text-xs mb-1">
                  <span className="text-foreground">RAM</span>
                  <span className="text-secondary">
                    {((hardware?.ramUsedMb || 0) / 1024).toFixed(1)} / {((hardware?.ramTotalMb || 1) / 1024).toFixed(1)} GB
                  </span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-secondary transition-all duration-500"
                    style={{ width: `${((hardware?.ramUsedMb || 0) / (hardware?.ramTotalMb || 1)) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* LOGS */}
          <div className="border border-border bg-card rounded-lg flex flex-col flex-1 min-h-0">
            <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
              <h3 className="font-mono text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <TerminalSquare className="w-4 h-4" /> LOGS
              </h3>
              <button 
                onClick={() => setAutoScroll(!autoScroll)}
                className={cn("text-[10px] font-mono px-2 py-0.5 rounded", autoScroll ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}
              >
                AUTO-SCROLL
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 font-mono text-xs flex flex-col gap-1.5"
                 ref={(el) => { if (el && autoScroll) el.scrollTop = el.scrollHeight; }}
            >
              {logs.map((log: any) => (
                <div key={log.id} className="flex gap-2 items-start break-words">
                  <span className="text-muted-foreground shrink-0">
                    [{new Date(log.createdAt).toLocaleTimeString()}]
                  </span>
                  <span className={cn(
                    "shrink-0",
                    log.level === "info" ? "text-primary" :
                    log.level === "warn" ? "text-chart-3" :
                    log.level === "error" ? "text-destructive" :
                    log.level === "success" ? "text-secondary" : "text-foreground"
                  )}>
                    {log.level === "info" ? <Info className="w-3.5 h-3.5" /> :
                     log.level === "warn" ? <AlertTriangle className="w-3.5 h-3.5" /> :
                     log.level === "error" ? <AlertTriangle className="w-3.5 h-3.5 fill-current" /> :
                     log.level === "success" ? <CheckCircle2 className="w-3.5 h-3.5" /> : "*"}
                  </span>
                  <span className="text-foreground/90">{log.message}</span>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-muted-foreground text-center py-4">No logs yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Separate component for Metric Cards to keep it clean
function MetricCard({ title, value, valueColor = "text-foreground" }: { title: string, value: string | number, valueColor?: string }) {
  return (
    <div className="border border-border bg-card rounded-lg p-4 flex flex-col justify-between min-h-[100px]">
      <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{title}</div>
      <div className={cn("text-2xl sm:text-3xl font-bold font-mono tracking-tighter truncate mt-2", valueColor)}>
        {value}
      </div>
    </div>
  );
}

// Needed brain icon missing from lucide import
function Brain(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/></svg>
}
