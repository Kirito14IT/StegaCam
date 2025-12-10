// Core task types and interfaces (draft)

export type TaskType = 'ENCODE' | 'DECODE';

export type TaskStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELED';

export interface TaskMetrics {
  queuePosition?: number;
  uploadProgress?: number; // 0..1
  attempt?: number; // retry count
  startedAt?: number; // epoch ms
  finishedAt?: number; // epoch ms
  durationMs?: number;
}

export interface EncodeResult {
  outputUri?: string; // local PNG path
  savedAssetId?: string;
  saved?: boolean;
}

export interface DecodeResult {
  shortId?: string; // 7-char
  modelUsed?: string; // "stega" or "upeca" etc.
}

export interface TaskBase {
  id: string; // unique id
  type: TaskType;
  status: TaskStatus;
  source: 'capture' | 'gallery';
  fileUri: string; // local file path/uri
  fileName?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  message?: string; // Short ID for ENCODE
  error?: string;
  requestId?: string; // X-Request-ID from server
  metrics: TaskMetrics;
  createdAt: number;
  updatedAt: number;
}

export type Task =
  | (TaskBase & { type: 'ENCODE'; result?: EncodeResult })
  | (TaskBase & { type: 'DECODE'; result?: DecodeResult });

export interface QueueState {
  tasks: Task[];
  runningTaskId?: string | null;
  isRunning: boolean; // when true, queue pump picks next
  decodePaused: boolean; // when true, decode tasks are paused (encode tasks still run)
}

// Actions
export type QueueAction =
  | { type: 'ENQUEUE'; payload: Task | Task[] }
  | { type: 'REMOVE'; id: string }
  | { type: 'UPDATE'; id: string; patch: Partial<Task> }
  | { type: 'SET_RUNNING'; running: boolean }
  | { type: 'SET_RUNNING_TASK'; id: string | null }
  | { type: 'SET_DECODE_PAUSED'; paused: boolean }
  | { type: 'CLEAR_COMPLETED' };

export interface ApiConfig {
  baseURL: string; // e.g. https://47.101.142.85:6100
  timeoutMs?: number; // default 30000
}

