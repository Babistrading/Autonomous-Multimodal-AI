import { useState, useMemo } from "react";
import { 
  useListDatasets, 
  useGetDatasetOverview, 
  useGenerateDataset,
  getListDatasetsQueryKey,
  getGetDatasetOverviewQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from "recharts";
import { Database, Plus, RefreshCw, HardDrive, Filter, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Datasets() {
  const queryClient = useQueryClient();
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const { data: overview } = useGetDatasetOverview(undefined, {
    query: { refetchInterval: 5000 }
  });

  const { data: datasetsData } = useListDatasets(undefined, {
    query: { refetchInterval: 5000 }
  });
  
  const generateMutation = useGenerateDataset();

  const datasets = Array.isArray(datasetsData) ? datasetsData : (datasetsData as any)?.items || [];
  
  // Group datasets by category for cards if list returns multiples per category
  // Or assuming one card per category
  const categories = useMemo(() => {
    if (!overview?.byCategory) return [];
    return overview.byCategory;
  }, [overview]);

  const handleGenerate = (category: string) => {
    setGeneratingFor(category);
    generateMutation.mutate(
      { data: { category, count: 1000 } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDatasetsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDatasetOverviewQueryKey() });
          setGeneratingFor(null);
        },
        onError: () => {
          setGeneratingFor(null);
        }
      }
    );
  };

  const formatKB = (kb: number) => {
    if (kb > 1024 * 1024) return `${(kb / (1024 * 1024)).toFixed(2)} GB`;
    if (kb > 1024) return `${(kb / 1024).toFixed(2)} MB`;
    return `${kb.toFixed(0)} KB`;
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 lg:p-6 gap-6">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <Database className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-foreground">TRAINING CORPORA</h1>
          <p className="text-sm font-mono text-muted-foreground">Synthesized and curated data streams</p>
        </div>
      </div>

      {/* OVERVIEW STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-border bg-card p-5 rounded-lg flex items-center gap-4">
          <div className="bg-primary/20 text-primary p-3 rounded-full">
            <Filter className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Total Samples</div>
            <div className="text-3xl font-bold font-mono">{overview?.totalSamples?.toLocaleString() || 0}</div>
          </div>
        </div>
        <div className="border border-border bg-card p-5 rounded-lg flex items-center gap-4">
          <div className="bg-secondary/20 text-secondary p-3 rounded-full">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Avg Quality</div>
            <div className="text-3xl font-bold font-mono text-secondary">{(overview?.averageQuality || 0).toFixed(2)}</div>
          </div>
        </div>
        <div className="border border-border bg-card p-5 rounded-lg flex items-center gap-4">
          <div className="bg-muted text-foreground p-3 rounded-full">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Storage Used</div>
            <div className="text-3xl font-bold font-mono">{formatKB(overview?.totalSizeKb || 0)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* CATEGORY CARDS */}
        <div className="xl:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {categories.map((cat: any) => {
            const isGenerating = generatingFor === cat.category;
            
            return (
              <div key={cat.category} className="border border-border bg-card rounded-lg p-5 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <h3 className="font-mono font-bold text-lg uppercase">{cat.category}</h3>
                  <button 
                    onClick={() => handleGenerate(cat.category)}
                    disabled={isGenerating}
                    className="flex items-center gap-1.5 bg-muted hover:bg-muted/80 text-foreground px-2 py-1 rounded text-xs font-mono transition-colors disabled:opacity-50"
                  >
                    {isGenerating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    GENERATE
                  </button>
                </div>

                <div className="space-y-4 font-mono text-sm">
                  <div className="flex justify-between items-end">
                    <span className="text-muted-foreground">Samples</span>
                    <span className="font-bold text-lg leading-none">{cat.count.toLocaleString()}</span>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Quality Score</span>
                      <span className={cat.quality > 0.8 ? "text-secondary" : cat.quality > 0.5 ? "text-chart-3" : "text-destructive"}>
                        {cat.quality.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full transition-all duration-1000",
                          cat.quality > 0.8 ? "bg-secondary" : cat.quality > 0.5 ? "bg-chart-3" : "bg-destructive"
                        )}
                        style={{ width: `${Math.min(100, Math.max(0, cat.quality * 100))}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* BAR CHART */}
        <div className="border border-border bg-card rounded-lg p-5 flex flex-col h-[400px] xl:h-auto">
          <h3 className="font-mono text-sm uppercase tracking-wider text-muted-foreground mb-6">DISTRIBUTION</h3>
          <div className="flex-1 min-h-0 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categories} layout="vertical" margin={{ top: 0, right: 0, left: 40, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={true} vertical={false} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis dataKey="category" type="category" stroke="hsl(var(--foreground))" fontSize={10} tickLine={false} axisLine={false} width={80} />
                <RechartsTooltip 
                  cursor={{fill: 'hsl(var(--muted))', opacity: 0.4}}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '4px' }}
                  itemStyle={{ fontFamily: 'monospace', fontSize: '12px', color: 'hsl(var(--primary))' }}
                  labelStyle={{ fontFamily: 'monospace', fontSize: '12px', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {categories.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill="hsl(var(--primary))" opacity={0.8 + (index * 0.05)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
