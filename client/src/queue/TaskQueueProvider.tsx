import React, { createContext, useContext, useMemo, useReducer, useEffect } from 'react';
import { Alert } from 'react-native';
import type { ApiConfig, QueueAction, QueueState, Task, TaskStatus } from './TaskTypes';
import { v4 as uuidv4 } from 'uuid';
import * as MediaLibrary from 'expo-media-library';
import { apiEncode, apiDecode } from '../api/client';
import { getModel } from '../utils/storage';

// NOTE: uuidv4() is used here to generate task IDs (internal queue identifiers).
// This is different from user "Short ID" (7-char alphanumeric) used for steganography encoding.

const initialState: QueueState = { tasks: [], runningTaskId: null, isRunning: true, decodePaused: false };

function reducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case 'ENQUEUE': {
      const items = Array.isArray(action.payload) ? action.payload : [action.payload];
      const next = items.map((t) => ({
        ...t,
        status: (t.status ?? 'PENDING') as TaskStatus,
      }));
      return { ...state, tasks: [...state.tasks, ...next] };
    }
    case 'REMOVE': {
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };
    }
    case 'UPDATE': {
      return {
        ...state,
        tasks: state.tasks.map((t): Task =>
          t.id === action.id ? ({ ...t, ...action.patch, updatedAt: Date.now() } as Task) : t
        ),
      };
    }
    case 'SET_RUNNING':
      return { ...state, isRunning: action.running };
    case 'SET_RUNNING_TASK':
      return { ...state, runningTaskId: action.id };
    case 'SET_DECODE_PAUSED':
      return { ...state, decodePaused: action.paused };
    case 'CLEAR_COMPLETED':
      return { ...state, tasks: state.tasks.filter((t) => !['SUCCESS', 'FAILED'].includes(t.status)) };
    default:
      return state;
  }
}

type Ctx = {
  state: QueueState;
  dispatch: React.Dispatch<QueueAction>;
  enqueueEncode: (
    files: { uri: string; name?: string; size?: number; w?: number; h?: number; source?: 'capture' | 'gallery' }[],
    shortId: string
  ) => void;
  enqueueDecode: (files: { uri: string; name?: string; size?: number; w?: number; h?: number }[]) => void;
  startAll: () => void;
  pauseAll: () => void;
  clearCompleted: () => void;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  startSingle: (id: string) => void; // 启动单个任务（不启动整个队列）
};

const QueueContext = createContext<Ctx | undefined>(undefined);

async function ensureMediaLibraryPermission(): Promise<boolean> {
  const supportsGranularPermissions =
    typeof MediaLibrary.getPermissionsAsync === 'function' &&
    MediaLibrary.getPermissionsAsync.length >= 2 &&
    typeof MediaLibrary.requestPermissionsAsync === 'function' &&
    MediaLibrary.requestPermissionsAsync.length >= 2;

  const getPermissions = supportsGranularPermissions
    ? () => MediaLibrary.getPermissionsAsync(false, ['photo'])
    : () => MediaLibrary.getPermissionsAsync();

  const requestPermissions = supportsGranularPermissions
    ? () => MediaLibrary.requestPermissionsAsync(false, ['photo'])
    : () => MediaLibrary.requestPermissionsAsync();

  const existing = await getPermissions();
  if (existing.status === 'granted') {
    return true;
  }

  const requested = await requestPermissions();
  return requested.status === 'granted';
}

export function TaskQueueProvider({ children, api }: { children: React.ReactNode; api: ApiConfig }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Pump: single-flight execution
  useEffect(() => {
    if (!state.isRunning || state.runningTaskId) return;
    // 如果解码任务被暂停，只处理编码任务；否则处理所有任务
    const next = state.tasks.find((t) => {
      if (t.status !== 'QUEUED') return false;
      // 如果解码任务被暂停，只处理编码任务
      if (state.decodePaused && t.type === 'DECODE') return false;
      return true;
    });
    if (!next) return;
    runTask(next).catch(() => void 0);
  }, [state.isRunning, state.runningTaskId, state.tasks, state.decodePaused]);

  useEffect(() => {
    const queued = state.tasks.filter((t) => t.status === 'QUEUED');
    queued.forEach((task, index) => {
      if (task.metrics.queuePosition !== index + 1) {
        dispatch({
          type: 'UPDATE',
          id: task.id,
          patch: {
            metrics: {
              ...task.metrics,
              queuePosition: index + 1,
            },
          },
        });
      }
    });
  }, [state.tasks]);

  const runTask = async (task: Task) => {
    dispatch({ type: 'SET_RUNNING_TASK', id: task.id });
    const startedAt = Date.now();
    let metrics = {
      ...task.metrics,
      startedAt,
      finishedAt: undefined,
      durationMs: undefined,
      queuePosition: undefined,
      attempt: (task.metrics.attempt ?? 0) + 1,
    };
    dispatch({
      type: 'UPDATE',
      id: task.id,
      patch: {
        status: 'PROCESSING',
        metrics,
      },
    });

    try {
      // Get current model from storage
      const currentModel = await getModel();
      
      if (task.type === 'ENCODE') {
        const pngUri = await apiEncode(api, {
          fileUri: task.fileUri,
          fileName: task.fileName,
          shortId: task.message!,
          model: currentModel,
        });
        // Save to gallery (PNG-only)
        const hasPermission = await ensureMediaLibraryPermission();
        if (!hasPermission) {
          throw new Error('无法保存图片：请授予相册写入权限');
        }
        let savedAssetId: string | undefined;
        try {
          const createdAsset = await MediaLibrary.createAssetAsync(pngUri);
          savedAssetId = createdAsset?.id;
        } catch (createError) {
          console.warn('createAssetAsync failed, falling back to saveToLibraryAsync', createError);
        }
        if (!savedAssetId) {
          try {
            await MediaLibrary.saveToLibraryAsync(pngUri);
            const latest = await MediaLibrary.getAssetsAsync({
              first: 1,
              sortBy: [[MediaLibrary.SortBy.creationTime, false]],
              mediaType: MediaLibrary.MediaType.photo,
            });
            savedAssetId = latest.assets?.[0]?.id;
          } catch (fallbackError) {
            console.warn('saveToLibraryAsync fallback failed', fallbackError);
          }
        }
        if (!savedAssetId) {
          throw new Error('图片已保存但无法获取相册资源ID');
        }
        const finishedAt = Date.now();
        metrics = {
          ...metrics,
          uploadProgress: 1,
          finishedAt,
          durationMs: finishedAt - startedAt,
        };
        dispatch({
          type: 'UPDATE',
          id: task.id,
          patch: {
            status: 'SUCCESS',
            result: { outputUri: pngUri, savedAssetId, saved: true },
            metrics,
          },
        });
        Alert.alert('保存成功', task.fileName ? `${task.fileName} 已保存到相册` : '已保存加密图片至相册');
      } else {
        const res = await apiDecode(api, {
          fileUri: task.fileUri,
          fileName: task.fileName,
          model: currentModel,
        });
        if (res?.success) {
          const finishedAt = Date.now();
          metrics = {
            ...metrics,
            uploadProgress: 1,
            finishedAt,
            durationMs: finishedAt - startedAt,
          };
          dispatch({
            type: 'UPDATE',
            id: task.id,
            patch: {
              status: 'SUCCESS',
              result: { shortId: res.data?.message, modelUsed: res.data?.model_used },
              metrics,
            },
          });
        } else {
          throw new Error(res?.error || 'decode failed');
        }
      }
    } catch (e: any) {
      const finishedAt = Date.now();
      metrics = {
        ...metrics,
        finishedAt,
        durationMs: finishedAt - startedAt,
      };
      dispatch({
        type: 'UPDATE',
        id: task.id,
        patch: {
          status: 'FAILED',
          error: String(e?.message || e),
          metrics,
        },
      });
      if (task.type === 'ENCODE') {
        Alert.alert('处理失败', String(e?.message || e) || '加密失败，请稍后重试');
      }
    } finally {
      dispatch({ type: 'SET_RUNNING_TASK', id: null });
    }
  };

  const actions = useMemo<Ctx>(() => ({
    state,
    dispatch,
    enqueueEncode: (files, shortId) => {
      if (!shortId || shortId.length !== 7) return; // Short ID length check
      const now = Date.now();
      const tasks: Task[] = files.map((f) => ({
        id: uuidv4(),
        type: 'ENCODE',
        source: f.source ?? 'gallery',
        fileUri: f.uri,
        fileName: f.name,
        fileSize: f.size,
        width: f.w,
        height: f.h,
        message: shortId,
        status: 'QUEUED',
        metrics: { uploadProgress: 0, attempt: 0, queuePosition: undefined },
        createdAt: now,
        updatedAt: now,
      }));
      dispatch({ type: 'ENQUEUE', payload: tasks });
      // 如果队列被暂停，自动启动队列以确保拍照任务能够被处理
      // 这样选择页面的暂停状态不会影响拍照页面的功能
      if (!state.isRunning) {
        dispatch({ type: 'SET_RUNNING', running: true });
      }
    },
    enqueueDecode: (files) => {
      const now = Date.now();
      const tasks: Task[] = files.map((f) => ({
        id: uuidv4(),
        type: 'DECODE',
        source: 'gallery',
        fileUri: f.uri,
        fileName: f.name,
        fileSize: f.size,
        width: f.w,
        height: f.h,
        status: 'PENDING',
        metrics: { uploadProgress: 0, attempt: 0, queuePosition: undefined },
        createdAt: now,
        updatedAt: now,
      }));
      dispatch({ type: 'ENQUEUE', payload: tasks });
    },
    startAll: () => {
      // 只处理解码任务的 PENDING 状态
      state.tasks
        .filter((t) => t.type === 'DECODE' && t.status === 'PENDING')
        .forEach((task) => {
          dispatch({ type: 'UPDATE', id: task.id, patch: { status: 'QUEUED' } });
        });
      // 启动解码任务队列（取消暂停）
      dispatch({ type: 'SET_DECODE_PAUSED', paused: false });
      // 确保队列运行
      if (!state.isRunning) {
        dispatch({ type: 'SET_RUNNING', running: true });
      }
    },
    pauseAll: () => {
      // 只暂停解码任务，不影响编码任务
      dispatch({ type: 'SET_DECODE_PAUSED', paused: true });
    },
    clearCompleted: () => dispatch({ type: 'CLEAR_COMPLETED' }),
    cancel: (id: string) => {
      const task = state.tasks.find((t) => t.id === id);
      if (!task) return;
      // 如果任务正在排队或处理中，取消应该将其状态改为PENDING（回到开始状态）
      // 而不是直接删除
      if (task.status === 'QUEUED' || task.status === 'PROCESSING') {
        dispatch({
          type: 'UPDATE',
          id,
          patch: {
            status: 'PENDING',
            error: undefined,
            metrics: {
              ...task.metrics,
              uploadProgress: 0,
              queuePosition: undefined,
              startedAt: undefined,
              finishedAt: undefined,
              durationMs: undefined,
            },
          },
        });
        // 如果正在运行这个任务，需要停止它
        if (state.runningTaskId === id) {
          dispatch({ type: 'SET_RUNNING_TASK', id: null });
        }
      } else {
        // 其他状态（如SUCCESS、FAILED）的取消操作可以保持删除行为，或者也改为PENDING
        // 这里统一改为PENDING，让用户可以重新开始
        dispatch({
          type: 'UPDATE',
          id,
          patch: {
            status: 'PENDING',
            error: undefined,
            metrics: {
              ...task.metrics,
              uploadProgress: 0,
              queuePosition: undefined,
              startedAt: undefined,
              finishedAt: undefined,
              durationMs: undefined,
            },
          },
        });
      }
    },
    retry: (id: string) => {
      const task = state.tasks.find((t) => t.id === id);
      if (!task) return;
      dispatch({
        type: 'UPDATE',
        id,
        patch: {
          status: 'QUEUED',
          error: undefined,
          metrics: {
            ...task.metrics,
            uploadProgress: 0,
            queuePosition: undefined,
            startedAt: undefined,
            finishedAt: undefined,
            durationMs: undefined,
          },
        },
      });
    },
    startSingle: (id: string) => {
      // 启动单个任务：只处理指定的任务，不影响其他任务
      const task = state.tasks.find((t) => t.id === id);
      if (!task) return;
      
      // 如果任务已经是 PROCESSING 状态，不需要处理
      if (task.status === 'PROCESSING') return;
      
      // 只处理解码任务（编码任务由 enqueueEncode 自动处理）
      if (task.type !== 'DECODE') return;
      
      // 如果任务已经是 QUEUED 状态，且解码任务被暂停，直接处理这个任务
      if (task.status === 'QUEUED' && state.decodePaused) {
        // 直接调用 runTask 处理这个任务，不启动整个解码队列
        // 这样其他 QUEUED 解码任务不会被处理
        if (!state.runningTaskId) {
          runTask(task).catch(() => void 0);
        }
        return;
      }
      
      // 如果任务是 PENDING 状态，将其改为 QUEUED
      if (task.status === 'PENDING') {
        dispatch({ type: 'UPDATE', id, patch: { status: 'QUEUED' } });
        // 如果解码任务被暂停，直接处理这个任务，不启动整个解码队列
        if (state.decodePaused) {
          if (!state.runningTaskId) {
            // 直接处理这个任务（状态更新是同步的，所以可以直接使用更新后的状态）
            const updatedTask = { ...task, status: 'QUEUED' as const };
            runTask(updatedTask).catch(() => void 0);
          }
        } else {
          // 如果解码任务未被暂停，确保队列运行
          if (!state.isRunning) {
            dispatch({ type: 'SET_RUNNING', running: true });
          }
        }
      }
    },
  }), [state, api]);

  return <QueueContext.Provider value={actions}>{children}</QueueContext.Provider>;
}

export function useTaskQueue() {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error('useTaskQueue must be used within TaskQueueProvider');
  return ctx;
}

