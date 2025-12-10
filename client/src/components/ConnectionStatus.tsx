import React, { useState, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import type { ApiConfig } from '../queue/TaskTypes';

type ConnectionStatus = 'connected' | 'disconnected' | 'checking';

interface ConnectionStatusProps {
  api: ApiConfig;
  intervalMs?: number; // Default 60s
}

export function ConnectionStatus({ api, intervalMs = 60000 }: ConnectionStatusProps) {
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [lastLatency, setLastLatency] = useState<number | null>(null);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    // 如果 baseURL 为空，直接返回 disconnected
    if (!api?.baseURL || api.baseURL.trim() === '') {
      setStatus('disconnected');
      return false;
    }

    try {
      const startTime = Date.now();
      const timeout = api.timeoutMs || 10000; // 增加到10秒超时
      
      // Create timeout controller for React Native compatibility
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const pingUrl = `${api.baseURL.replace(/\/$/, '')}/api/v1/ping`;
      const response = await fetch(pingUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      const endTime = Date.now();
      const latency = endTime - startTime;

      if (response.ok) {
        try {
          const data = await response.json();
          if (data?.ok === true) {
            setStatus('connected');
            setLastLatency(latency);
            return true;
          }
        } catch (jsonError) {
          // 如果响应不是JSON，但状态码是200，也认为连接成功
          setStatus('connected');
          setLastLatency(latency);
          return true;
        }
      }
      setStatus('disconnected');
      return false;
    } catch (error: any) {
      console.warn('连接检查失败:', error?.message || error);
      setStatus('disconnected');
      return false;
    }
  }, [api]);

  // Periodic check
  useEffect(() => {
    // Initial check
    checkConnection();

    // Set up interval
    const interval = setInterval(() => {
      checkConnection();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [checkConnection, intervalMs]);

  const handlePress = async () => {
    setStatus('checking');
    const connected = await checkConnection();
    
    if (connected && lastLatency !== null) {
      Alert.alert(
        '服务器连接状态',
        `服务器已连接\n延迟: ${lastLatency}ms`,
        [{ text: '确定' }]
      );
    } else {
      Alert.alert(
        '服务器连接状态',
        '无法连接到服务器\n请检查：\n1. 服务器是否运行\n2. FRP客户端是否运行\n3. 网络连接是否正常',
        [{ text: '确定' }]
      );
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return '#10b981'; // green-500
      case 'disconnected':
        return '#ef4444'; // red-500
      case 'checking':
        return '#f59e0b'; // amber-500
      default:
        return '#6b7280'; // gray-500
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={[styles.dot, { backgroundColor: getStatusColor() }]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    right: 16,
    zIndex: 1000,
    padding: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
});

