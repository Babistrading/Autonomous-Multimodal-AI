/**
 * API helpers — all calls go through this file.
 * Base URL is set from EXPO_PUBLIC_DOMAIN in _layout.tsx via setBaseUrl.
 */

export function getApiBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : '';
}

async function apiFetch(path: string, options?: RequestInit) {
  const base = getApiBaseUrl();
  const url = `${base}/api${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface TrainingStatus {
  status: 'idle' | 'initializing' | 'running' | 'paused' | 'stopped' | 'error';
  epoch: number;
  step: number;
  loss: number | null;
  validationLoss: number | null;
  perplexity: number | null;
  learningRate: number;
  tokensProcessed: number;
  tokensPerSecond: number;
  trainingTimeSeconds: number;
  powerMode: 'low' | 'medium' | 'high' | 'max';
  activeWorkers: number;
  startedAt: string | null;
}

export interface TrainingMetric {
  id: number;
  epoch: number;
  step: number;
  loss: number;
  validationLoss: number | null;
  perplexity: number;
  learningRate: number;
  tokensPerSecond: number;
  createdAt: string;
}

export interface Worker {
  id: number;
  name: string;
  type: string;
  status: 'idle' | 'running' | 'paused' | 'error';
  queueSize: number;
  processed: number;
  errors: number;
  tokensPerSecond: number;
  currentTask: string | null;
}

export interface ModelInfo {
  name: string;
  version: string;
  parameters: number;
  layers: number;
  heads: number;
  dModel: number;
  dFf: number;
  vocabSize: number;
  maxSeqLen: number;
  architecture: string;
  activeParameters: number;
  memoryMb: number;
}

export interface TokenizerStats {
  vocabSize: number;
  totalTokensSeen: number;
  uniqueTokens: number;
  mostFrequent: { token: string; count: number }[];
  averageTokenLength: number;
}

export interface Checkpoint {
  id: number;
  name: string;
  epoch: number;
  step: number;
  loss: number;
  sizeMb: number;
  isActive: boolean;
  createdAt: string;
}

export interface HardwareMetrics {
  cpuUsagePercent: number;
  ramUsedMb: number;
  ramTotalMb: number;
  gpuAvailable: boolean;
  gpuUsagePercent: number | null;
  storageFreeMb: number;
  storageTotalMb: number;
  uptimeSeconds: number;
  recommendedPowerMode: string;
}

export interface ChatSession {
  id: number;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: number;
  sessionId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinkingMode: boolean;
  createdAt: string;
}

// ── Training ─────────────────────────────────────────────────────────────────

export const fetchTrainingStatus = (): Promise<TrainingStatus> =>
  apiFetch('/training/status');

export const fetchTrainingMetrics = (limit = 60): Promise<TrainingMetric[]> =>
  apiFetch(`/training/metrics?limit=${limit}`);

export const fetchWorkers = (): Promise<Worker[]> =>
  apiFetch('/workers');

export const pauseTraining = (): Promise<TrainingStatus> =>
  apiFetch('/training/pause', { method: 'POST' });

export const resumeTraining = (): Promise<TrainingStatus> =>
  apiFetch('/training/resume', { method: 'POST' });

export const setPowerMode = (powerMode: string): Promise<TrainingStatus> =>
  apiFetch('/training/power-mode', {
    method: 'POST',
    body: JSON.stringify({ powerMode }),
  });

export const saveCheckpoint = (): Promise<Checkpoint> =>
  apiFetch('/training/checkpoint', { method: 'POST' });

// ── Model ─────────────────────────────────────────────────────────────────────

export const fetchModelInfo = (): Promise<ModelInfo> =>
  apiFetch('/model/info');

export const fetchTokenizerStats = (): Promise<TokenizerStats> =>
  apiFetch('/model/tokenizer/stats');

export const fetchCheckpoints = (): Promise<Checkpoint[]> =>
  apiFetch('/checkpoints');

export const loadCheckpoint = (id: number): Promise<TrainingStatus> =>
  apiFetch(`/checkpoints/${id}/load`, { method: 'POST' });

// ── Hardware ──────────────────────────────────────────────────────────────────

export const fetchHardwareMetrics = (): Promise<HardwareMetrics> =>
  apiFetch('/hardware/metrics');

// ── Chat ──────────────────────────────────────────────────────────────────────

export const fetchChatSessions = (): Promise<ChatSession[]> =>
  apiFetch('/chat/sessions');

export const createChatSession = (title?: string): Promise<ChatSession> =>
  apiFetch('/chat/sessions', {
    method: 'POST',
    body: JSON.stringify({ title: title ?? 'New Chat' }),
  });

export const deleteChatSession = (sessionId: number): Promise<void> =>
  apiFetch(`/chat/sessions/${sessionId}`, { method: 'DELETE' });

export const fetchMessages = (sessionId: number): Promise<Message[]> =>
  apiFetch(`/chat/sessions/${sessionId}/messages`);

export const sendMessage = (sessionId: number, content: string): Promise<Message> =>
  apiFetch(`/chat/sessions/${sessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
