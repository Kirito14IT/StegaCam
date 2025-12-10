import React, { useState, useMemo } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View, Animated, RefreshControl } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useTaskQueue } from '../queue/TaskQueueProvider';
import { TaskCard } from '../components/TaskCard';

export default function DecodeListScreen() {
  const { state, startAll, pauseAll, clearCompleted, retry, cancel, dispatch, enqueueDecode, startSingle } = useTaskQueue();
  const [selecting, setSelecting] = useState(false);
  const buttonScale = useState(new Animated.Value(1))[0];

  // Filter decode tasks only and sort by priority
  // Priority: PROCESSING > QUEUED > PENDING > FAILED > SUCCESS
  const decodeTasks = useMemo(() => {
    const filtered = state.tasks.filter(t => t.type === 'DECODE');
    const statusPriority: Record<string, number> = {
      'PROCESSING': 0,
      'QUEUED': 1,
      'PENDING': 2,
      'FAILED': 3,
      'SUCCESS': 4,
    };
    return filtered.sort((a, b) => {
      const priorityDiff = (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99);
      if (priorityDiff !== 0) return priorityDiff;
      // 相同状态按创建时间倒序（最新的在前）
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });
  }, [state.tasks]);
  
  // 计算任务统计信息
  const taskStats = useMemo(() => {
    const total = decodeTasks.length;
    const pending = decodeTasks.filter(t => t.status === 'PENDING').length;
    const queued = decodeTasks.filter(t => t.status === 'QUEUED').length;
    const processing = decodeTasks.filter(t => t.status === 'PROCESSING').length;
    const success = decodeTasks.filter(t => t.status === 'SUCCESS').length;
    const failed = decodeTasks.filter(t => t.status === 'FAILED').length;
    const active = pending + queued + processing;
    const completed = success + failed;
    
    return { total, pending, queued, processing, success, failed, active, completed };
  }, [decodeTasks]);
  
  // 刷新控制
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // 简单的刷新：重新计算状态
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const handleStart = (id: string) => {
    // 使用 startSingle 来启动单个任务
    // 如果队列被暂停，startSingle 会临时启动队列来处理这个任务
    // 但不会影响其他 QUEUED 任务（因为它们已经在队列中，只是队列被暂停了）
    startSingle(id);
  };

  const handleSelectImages = async () => {
    if (selecting) return;
    
    // 按钮点击动画
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    setSelecting(true);
    try {
      // Request ImagePicker permissions
      const { status: imagePickerStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (imagePickerStatus !== 'granted') {
        Alert.alert('权限被拒绝', '需要相册权限以选择图片');
        return;
      }

      // Pick images (multiple selection if supported)
      // Use string literal 'images' instead of deprecated MediaTypeOptions
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        // ImagePicker already provides all the metadata we need
        const files = result.assets.map((asset, index) => ({
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}_${index}.jpg`,
          size: asset.fileSize || 0,
          w: asset.width,
          h: asset.height,
        }));
        
        enqueueDecode(files);
        Alert.alert('成功', `已添加 ${files.length} 张图片到队列`);
      }
    } catch (error) {
      Alert.alert('错误', '选择图片失败，请重试');
      console.error('Image picker error:', error);
    } finally {
      setSelecting(false);
    }
  };

  const handleCopy = (text: string) => {
    Clipboard.setStringAsync(text).then(() => {
      // 使用更友好的提示
      Alert.alert('已复制', `Short ID: ${text}\n已复制到剪贴板`, [{ text: '确定' }]);
    }).catch(() => {
      Alert.alert('复制失败', '请重试');
    });
  };

  const handleDelete = (id: string) => {
    dispatch({ type: 'REMOVE', id });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>隐写解码</Text>
            <Text style={styles.headerSubtitle}>管理队列并查看任务进度</Text>
          </View>
          {taskStats.total > 0 && (
            <View style={styles.statsContainer}>
              {taskStats.active > 0 && (
                <View style={styles.statBadge}>
                  <Text style={styles.statNumber}>{taskStats.active}</Text>
                  <Text style={styles.statLabel}>进行中</Text>
                </View>
              )}
              {taskStats.success > 0 && (
                <View style={[styles.statBadge, styles.statBadgeSuccess]}>
                  <Text style={[styles.statNumber, styles.statNumberSuccess]}>{taskStats.success}</Text>
                  <Text style={[styles.statLabel, styles.statLabelSuccess]}>成功</Text>
                </View>
              )}
              {taskStats.failed > 0 && (
                <View style={[styles.statBadge, styles.statBadgeFailed]}>
                  <Text style={[styles.statNumber, styles.statNumberFailed]}>{taskStats.failed}</Text>
                  <Text style={[styles.statLabel, styles.statLabelFailed]}>失败</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
      {/* Select Images Button */}
      <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
      <TouchableOpacity
        style={[styles.selectButton, selecting && styles.selectButtonDisabled]}
        onPress={handleSelectImages}
        disabled={selecting}
          activeOpacity={0.8}
      >
        <Text style={styles.selectButtonText}>
          {selecting ? '选择中...' : '选择图片'}
        </Text>
      </TouchableOpacity>
      </Animated.View>

      {/* Toolbar */}
      {decodeTasks.length > 0 && (
        <Toolbar
          onStartAll={startAll}
          onPauseAll={pauseAll}
          onClear={clearCompleted}
          hasPendingTasks={taskStats.pending > 0}
          hasQueuedOrProcessingTasks={taskStats.queued > 0 || taskStats.processing > 0}
          hasCompletedTasks={taskStats.completed > 0}
          isRunning={state.isRunning && !state.decodePaused}
        />
      )}

      {/* Task List */}
      {decodeTasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Text style={styles.emptyIcon}>📷</Text>
          </View>
          <Text style={styles.emptyText}>暂无任务</Text>
          <Text style={styles.emptySubtext}>点击上方"选择图片"按钮添加图片进行解码</Text>
        </View>
      ) : (
        <FlatList
          data={decodeTasks}
          keyExtractor={(t) => t.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#2563eb"
              colors={['#2563eb']}
            />
          }
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              isQueueRunning={state.isRunning && !state.decodePaused}
              onStart={handleStart}
              onRetry={retry}
              onCancel={cancel}
              onDelete={handleDelete}
              onCopy={handleCopy}
              onDetails={(id) => {
                const task = decodeTasks.find(t => t.id === id);
                if (task) {
                  const statusText: Record<string, string> = {
                    'PENDING': '等待中',
                    'QUEUED': '排队中',
                    'PROCESSING': '处理中',
                    'SUCCESS': '成功',
                    'FAILED': '失败',
                  };
                  const status = statusText[task.status] || task.status;
                  const fileSize = task.fileSize ? (task.fileSize / 1024).toFixed(1) + 'KB' : '未知';
                  const dimensions = task.width && task.height ? `${task.width}x${task.height}px` : '未知';
                  const createdAt = task.createdAt ? new Date(task.createdAt).toLocaleString('zh-CN') : '未知';
                  const duration = task.metrics.durationMs ? (task.metrics.durationMs / 1000).toFixed(1) + '秒' : '-';
                  
                  let details = `状态: ${status}\n文件名: ${task.fileName || '未命名图片'}\n大小: ${fileSize}\n分辨率: ${dimensions}\n创建时间: ${createdAt}`;
                  
                  if (task.status === 'SUCCESS' && task.result?.shortId) {
                    details += `\n解码结果: ${task.result.shortId}`;
                  }
                  if (task.status === 'FAILED' && task.error) {
                    details += `\n错误信息: ${task.error}`;
                  }
                  if (task.metrics.durationMs) {
                    details += `\n处理时长: ${duration}`;
                  }
                  
                  Alert.alert('任务详情', details, [{ text: '确定' }]);
                }
              }}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

function Toolbar({
  onStartAll,
  onPauseAll,
  onClear,
  hasPendingTasks,
  hasQueuedOrProcessingTasks,
  hasCompletedTasks,
  isRunning,
}: {
  onStartAll: () => void;
  onPauseAll: () => void;
  onClear: () => void;
  hasPendingTasks: boolean;
  hasQueuedOrProcessingTasks: boolean;
  hasCompletedTasks: boolean;
  isRunning: boolean;
}) {
  // 企业级交互逻辑：
  // - "开始全部"：始终可用（如果没有 PENDING 任务，点击后不会有任何操作，但按钮保持可用）
  // - "暂停全部"：当队列正在运行且有 QUEUED 或 PROCESSING 任务时可用
  // - "清理已完成"：当有已完成任务时可用
  const canStartAll = true; // 始终可用，即使没有 PENDING 任务
  const canPauseAll = isRunning && hasQueuedOrProcessingTasks;
  
  return (
    <View style={styles.toolbar}>
      <Btn 
        title="开始全部" 
        onPress={onStartAll}
        disabled={!canStartAll}
        color="#22c55e"
      />
      <Btn 
        title="暂停全部" 
        onPress={onPauseAll}
        disabled={!canPauseAll}
        color="#f59e0b"
      />
      <Btn 
        title="清理已完成" 
        onPress={onClear}
        disabled={!hasCompletedTasks}
        color="#3b82f6"
      />
    </View>
  );
}

function Btn({ 
  title, 
  onPress, 
  disabled = false, 
  color = '#3b82f6' 
}: { 
  title: string; 
  onPress: () => void; 
  disabled?: boolean;
  color?: string;
}) {
  return (
    <TouchableOpacity 
      onPress={onPress} 
      style={[
        styles.toolbarButton, 
        { backgroundColor: disabled ? '#cbd5e1' : color },
        disabled && styles.toolbarButtonDisabled
      ]}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={[styles.toolbarButtonText, disabled && styles.toolbarButtonTextDisabled]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4ff',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e3a8a',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#475569',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  statBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 50,
  },
  statBadgeSuccess: {
    backgroundColor: '#d1fae5',
  },
  statBadgeFailed: {
    backgroundColor: '#fee2e2',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e3a8a',
  },
  statNumberSuccess: {
    color: '#059669',
  },
  statNumberFailed: {
    color: '#dc2626',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  statLabelSuccess: {
    color: '#047857',
  },
  statLabelFailed: {
    color: '#991b1b',
  },
  selectButton: {
    backgroundColor: '#2563eb',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  selectButtonDisabled: {
    opacity: 0.6,
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  toolbar: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
  },
  toolbarButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  toolbarButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  toolbarButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  toolbarButtonTextDisabled: {
    color: '#94a3b8',
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 32,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e0ecff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e3a8a',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
});
