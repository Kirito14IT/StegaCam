import React, { useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import type { Task } from '../queue/TaskTypes';

type Props = {
  task: Task;
  isQueueRunning?: boolean; // 队列是否正在运行
  onStart?: (id: string) => void;
  onRetry?: (id: string) => void;
  onCancel?: (id: string) => void;
  onDelete?: (id: string) => void;
  onCopy?: (text: string) => void;
  onDetails?: (id: string) => void;
};

export function TaskCard({ task, isQueueRunning = true, onStart, onRetry, onCancel, onDelete, onCopy, onDetails }: Props) {
  const progress = Math.round((task.metrics.uploadProgress ?? 0) * 100);
  const fileSizeKB = task.fileSize ? (task.fileSize / 1024).toFixed(1) : '?';
  const dimensions = task.width && task.height ? `${task.width}x${task.height}px` : '未知';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const getStatusOverlay = () => {
    switch (task.status) {
      case 'PROCESSING':
        return (
          <View style={styles.statusOverlay}>
            <Text style={styles.statusOverlayText}>处理中</Text>
          </View>
        );
      case 'SUCCESS':
        return (
          <View style={[styles.statusOverlay, styles.statusOverlaySuccess]}>
            <Text style={styles.statusOverlayText}>成功</Text>
          </View>
        );
      case 'FAILED':
        return (
          <View style={[styles.statusOverlay, styles.statusOverlayFailed]}>
            <Text style={styles.statusOverlayText}>失败</Text>
          </View>
        );
      default:
        return null;
    }
  };

  const renderProgressBar = () => {
    if (task.status === 'PROCESSING') {
      const progressValue = task.metrics.uploadProgress ?? 0;
      return (
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${progressValue * 100}%` }]} />
        </View>
      );
    }
    return null;
  };

  const renderActions = () => {
    switch (task.status) {
      case 'PENDING':
        return (
          <View style={styles.actionsRow}>
            <Button title="开始" onPress={() => onStart?.(task.id)} color="#22c55e" />
            <Button title="删除" onPress={() => onDelete?.(task.id)} color="#ef4444" />
          </View>
        );
      case 'QUEUED':
        // 如果队列被暂停，显示"暂停中"和"开始"按钮；否则显示"排队中"和"取消"按钮
        if (!isQueueRunning) {
          return (
            <View style={styles.actionsRow}>
              <Text style={styles.pausedText}>暂停中</Text>
              <Button title="开始" onPress={() => onStart?.(task.id)} color="#22c55e" />
              <Button title="删除" onPress={() => onDelete?.(task.id)} color="#ef4444" />
            </View>
          );
        }
        return (
          <View style={styles.actionsRow}>
            <Text style={styles.queueText}>排队中 {task.metrics.queuePosition ? `#${task.metrics.queuePosition}` : ''}</Text>
            <Button title="取消" onPress={() => onCancel?.(task.id)} color="#eab308" />
            <Button title="删除" onPress={() => onDelete?.(task.id)} color="#ef4444" />
          </View>
        );
      case 'PROCESSING':
        return (
          <View style={styles.actionsRow}>
            <Text style={styles.progressText}>
              {progress > 0 && progress < 100 ? `上传 ${progress}%` : '处理中...'}
            </Text>
            <Button title="取消" onPress={() => onCancel?.(task.id)} color="#eab308" />
          </View>
        );
      case 'SUCCESS':
        return (
          <View style={styles.actionsRow}>
            {task.type === 'DECODE' && task.result?.shortId ? (
              <>
                <Button title={`复制 ${task.result.shortId}`} onPress={() => onCopy?.(task.result!.shortId!)} color="#22c55e" />
                <Button title="详情" onPress={() => onDetails?.(task.id)} color="#3b82f6" />
              </>
            ) : (
              <Text style={styles.successText}>已保存到相册</Text>
            )}
            <Button title="删除" onPress={() => onDelete?.(task.id)} color="#ef4444" />
          </View>
        );
      case 'FAILED':
        return (
          <View style={styles.actionsRow}>
            <Text style={styles.errorText} numberOfLines={1}>
              {task.error || '处理失败'}
            </Text>
            <Button title="重试" onPress={() => onRetry?.(task.id)} color="#eab308" />
            <Button title="删除" onPress={() => onDelete?.(task.id)} color="#ef4444" />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={styles.thumbnailContainer}>
        <Image source={{ uri: task.fileUri }} style={styles.thumbnail} />
        {getStatusOverlay()}
      </View>
      <View style={styles.content}>
        <Text style={styles.fileName} numberOfLines={1}>
          {task.fileName || '未命名图片'}
        </Text>
        <Text style={styles.fileInfo}>
          {fileSizeKB}KB, {dimensions}
        </Text>
        {renderProgressBar()}
        {renderActions()}
      </View>
    </Animated.View>
  );
}

function Button({ title, onPress, color = '#3b82f6' }: { title: string; onPress?: () => void; color?: string }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity 
        onPress={onPress} 
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.button, { backgroundColor: color }]}
        activeOpacity={0.9}
      >
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.08)',
  },
  thumbnailContainer: {
    position: 'relative',
    marginRight: 12,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  statusOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusOverlaySuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.8)',
  },
  statusOverlayFailed: {
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
  },
  statusOverlayText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  fileName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  fileInfo: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  queueText: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '600',
  },
  pausedText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600',
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
  },
  successText: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    flex: 1,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

