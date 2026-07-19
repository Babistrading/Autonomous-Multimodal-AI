import { 
  useGetModelInfo, 
  useGetTokenizerStats 
} from "@workspace/api-client-react";
import { Brain, FileText, Layers, MemoryStick, Hash, AlignLeft } from "lucide-react";

export default function ModelInfo() {
  const { data: model } = useGetModelInfo();
  const { data: tokenizer } = useGetTokenizerStats();

  const formatNumber = (num: number) => {
    if (!num) return "0";
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 lg:p-6 gap-6">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <Brain className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-foreground">MODEL ARCHITECTURE</h1>
          <p className="text-sm font-mono text-muted-foreground">Neural network topography and tokenization</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT PANEL: ARCHITECTURE */}
        <div className="flex flex-col gap-4">
          <div className="border border-primary/20 bg-primary/5 rounded-lg p-6 flex items-start justify-between relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 opacity-10">
              <Layers className="w-48 h-48" />
            </div>
            <div className="z-10">
              <h2 className="text-3xl font-bold font-mono tracking-tighter text-primary mb-1">
                {model?.name || "BABIS M1"}
              </h2>
              <div className="font-mono text-sm text-primary/80 uppercase tracking-widest mb-6">
                {model?.architecture || "Transformer"} • v{model?.version || "1.0"}
              </div>
              
              <div className="space-y-1 font-mono text-lg">
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-48 shrink-0">Architecture Spec:</span>
                  <span className="font-bold text-foreground">{formatNumber(model?.parameters || 0)} params</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-48 shrink-0">Active Training Core:</span>
                  <span className="font-bold text-secondary">{formatNumber(model?.activeParameters || 0)} params</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SpecCard icon={Layers} label="Layers" value={model?.layers || 0} />
            <SpecCard icon={AlignLeft} label="Attention Heads" value={model?.heads || 0} />
            <SpecCard icon={Hash} label="Embedding Dim" value={model?.dModel || 0} />
            <SpecCard icon={MemoryStick} label="FFN Dim" value={model?.dFf || 0} />
            <SpecCard icon={FileText} label="Vocab Size" value={formatNumber(model?.vocabSize || 0)} />
            <SpecCard icon={AlignLeft} label="Max Seq Length" value={formatNumber(model?.maxSeqLen || 0)} />
          </div>
          
          <div className="border border-border bg-card rounded-lg p-4 flex items-center justify-between font-mono">
            <span className="text-muted-foreground uppercase text-sm">Estimated VRAM Usage</span>
            <span className="text-xl font-bold text-chart-3">{model?.memoryMb ? (model.memoryMb / 1024).toFixed(2) : "0"} GB</span>
          </div>
        </div>

        {/* RIGHT PANEL: TOKENIZER */}
        <div className="flex flex-col gap-4 border border-border bg-card rounded-lg p-6">
          <h3 className="font-mono font-bold text-lg uppercase tracking-wider mb-4 text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Tokenizer Statistics
          </h3>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-muted/50 border border-border p-4 rounded-lg">
              <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Vocab Size</div>
              <div className="text-2xl font-bold font-mono">{formatNumber(tokenizer?.vocabSize || 0)}</div>
            </div>
            <div className="bg-muted/50 border border-border p-4 rounded-lg">
              <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Avg Token Length</div>
              <div className="text-2xl font-bold font-mono text-secondary">{tokenizer?.averageTokenLength?.toFixed(2) || "0"}</div>
            </div>
            <div className="bg-muted/50 border border-border p-4 rounded-lg">
              <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Total Tokens Seen</div>
              <div className="text-xl font-bold font-mono">{formatNumber(tokenizer?.totalTokensSeen || 0)}</div>
            </div>
            <div className="bg-muted/50 border border-border p-4 rounded-lg">
              <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Unique Tokens</div>
              <div className="text-xl font-bold font-mono">{formatNumber(tokenizer?.uniqueTokens || 0)}</div>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 border border-border rounded-lg overflow-hidden">
            <div className="bg-muted p-2 border-b border-border grid grid-cols-2 font-mono text-xs font-bold text-muted-foreground uppercase">
              <div className="pl-2">Token</div>
              <div className="text-right pr-4">Count</div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-sm">
              {(tokenizer?.mostFrequent || []).map((item: any, idx: number) => (
                <div key={idx} className="grid grid-cols-2 p-1.5 hover:bg-muted/50 rounded items-center">
                  <div className="bg-background border border-border px-2 py-0.5 rounded text-primary inline-block w-max truncate max-w-[150px]">
                    {item.token === ' ' ? ' ' : item.token === '\n' ? '\\n' : item.token}
                  </div>
                  <div className="text-right pr-2 text-foreground/80">{formatNumber(item.count)}</div>
                </div>
              ))}
              {(!tokenizer?.mostFrequent || tokenizer.mostFrequent.length === 0) && (
                <div className="text-center p-4 text-muted-foreground text-xs">No token data available yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecCard({ icon: Icon, label, value }: { icon: any, label: string, value: string | number }) {
  return (
    <div className="border border-border bg-card p-4 rounded-lg flex flex-col justify-between">
      <div className="flex justify-between items-start mb-2">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>
      <div>
        <div className="text-xs font-mono text-muted-foreground uppercase mb-1">{label}</div>
        <div className="text-lg font-bold font-mono text-foreground">{value}</div>
      </div>
    </div>
  );
}
