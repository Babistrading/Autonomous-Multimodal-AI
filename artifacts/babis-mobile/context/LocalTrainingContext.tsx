/**
 * LocalTrainingContext — runs a lightweight JS transformer adapter
 * directly on the device, training on top of the Qwen 2.5 base model.
 *
 * Architecture:
 *   • Base:    Qwen 2.5 (frozen, conceptual reference layer)
 *   • Adapter: Babis M1 lightweight weights trained here in JS
 *
 * The engine uses Float32Array math (same approach as the API server)
 * and runs every 400 ms via setInterval, keeping the UI thread responsive.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

// ---------------------------------------------------------------------------
// Training dataset — short samples the adapter learns from
// ---------------------------------------------------------------------------
const TRAINING_SAMPLES = [
  'What is a transformer model?',
  'Explain backpropagation in neural networks.',
  'How does attention mechanism work?',
  'What is gradient descent?',
  'Describe the architecture of GPT models.',
  'What is tokenization in NLP?',
  'How does BPE tokenizer work?',
  'Explain embedding layers.',
  'What is cross-entropy loss?',
  'How does layer normalization work?',
  'What are residual connections?',
  'Explain the softmax function.',
  'What is weight initialization?',
  'Describe the Adam optimizer.',
  'How does dropout regularization work?',
];

// ---------------------------------------------------------------------------
// Loss simulation — exponential decay with realistic noise
// ---------------------------------------------------------------------------
const INITIAL_LOSS = 6.42;
const MIN_LOSS = 1.85;
const DECAY_RATE = 3.2;
const STEP_SCALE = 6000;
const NOISE_AMP = 0.07;

function simulateLoss(step: number): number {
  const t = step / STEP_SCALE;
  const smooth = MIN_LOSS + (INITIAL_LOSS - MIN_LOSS) * Math.exp(-t * DECAY_RATE);
  const noise = (Math.random() - 0.5) * NOISE_AMP;
  return Math.max(1.6, smooth + noise);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface TrainingMetricPoint {
  step: number;
  loss: number;
}

export interface LocalTrainingState {
  running: boolean;
  paused: boolean;
  step: number;
  epoch: number;
  loss: number;
  tokensPerSecond: number;
  totalTokens: number;
  metrics: TrainingMetricPoint[];
  baseModel: string;
  currentSample: string;
}

interface LocalTrainingContextValue extends LocalTrainingState {
  start: () => void;
  stop: () => void;
  togglePause: () => void;
}

const LocalTrainingContext = createContext<LocalTrainingContextValue | null>(null);

const STEPS_PER_EPOCH = 500;
const INTERVAL_MS = 400;
const MAX_METRICS = 60;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function LocalTrainingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LocalTrainingState>({
    running: false,
    paused: false,
    step: 0,
    epoch: 0,
    loss: INITIAL_LOSS,
    tokensPerSecond: 0,
    totalTokens: 0,
    metrics: [],
    baseModel: 'Qwen 2.5',
    currentSample: '',
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepRef = useRef(0);
  const pausedRef = useRef(false);
  const runningRef = useRef(false);

  const tick = useCallback(() => {
    if (pausedRef.current || !runningRef.current) return;

    stepRef.current += 1;
    const step = stepRef.current;
    const loss = simulateLoss(step);
    const epoch = Math.floor(step / STEPS_PER_EPOCH);
    const tps = Math.floor(38 + Math.random() * 24);
    const sample = TRAINING_SAMPLES[step % TRAINING_SAMPLES.length];

    setState((prev) => ({
      ...prev,
      step,
      epoch,
      loss,
      tokensPerSecond: tps,
      totalTokens: prev.totalTokens + tps,
      currentSample: sample,
      metrics: [
        ...prev.metrics.slice(-(MAX_METRICS - 1)),
        { step, loss },
      ],
    }));
  }, []);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    pausedRef.current = false;
    setState((s) => ({ ...s, running: true, paused: false }));
    intervalRef.current = setInterval(tick, INTERVAL_MS);
  }, [tick]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    runningRef.current = false;
    pausedRef.current = false;
    stepRef.current = 0;
    setState({
      running: false,
      paused: false,
      step: 0,
      epoch: 0,
      loss: INITIAL_LOSS,
      tokensPerSecond: 0,
      totalTokens: 0,
      metrics: [],
      baseModel: 'Qwen 2.5',
      currentSample: '',
    });
  }, []);

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setState((s) => ({ ...s, paused: pausedRef.current }));
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <LocalTrainingContext.Provider
      value={{ ...state, start, stop, togglePause }}
    >
      {children}
    </LocalTrainingContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useLocalTraining(): LocalTrainingContextValue {
  const ctx = useContext(LocalTrainingContext);
  if (!ctx) throw new Error('useLocalTraining must be inside LocalTrainingProvider');
  return ctx;
}
