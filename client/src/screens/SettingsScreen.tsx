import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, DeviceEventEmitter, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { getUsername, getShortId, getModel, setModel, getApiBaseUrl, setApiBaseUrl } from '../utils/storage';

export default function SettingsScreen() {
  const [username, setUsernameState] = useState<string>('');
  const [shortId, setShortIdState] = useState<string>('');
  const [currentModel, setCurrentModelState] = useState<string>('stega');
  const [serverUrl, setServerUrl] = useState<string>('http://47.101.142.85:6100');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [showServerAddress, setShowServerAddress] = useState<boolean>(false);
  const serverInputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const u = await getUsername();
    const id = await getShortId();
    const m = await getModel(); // getModel() 已经处理了兼容性
    const api = await getApiBaseUrl();
    setUsernameState(u || '');
    setShortIdState(id || '');
    setCurrentModelState(m);
    setServerUrl(api || 'http://47.101.142.85:6100');
  };

  const handleCopyShortId = () => {
    if (shortId) {
      Clipboard.setStringAsync(shortId)
        .then(() => {
          Alert.alert('已复制', `Short ID: ${shortId}`);
        })
        .catch((error) => {
          console.error('复制 Short ID 失败:', error);
        });
    }
  };

  const handleModelSelect = async (model: string) => {
    await setModel(model);
    setCurrentModelState(model);
    Alert.alert('已切换', `当前模型: ${model}`);
  };

  const normalizeUrl = (input: string): string => {
    const trimmed = input.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    // 允许用户仅输入 host:port
    return `http://${trimmed}`;
  };

  const handleConnect = async () => {
    const normalized = normalizeUrl(serverUrl);
    if (!normalized) {
      Alert.alert('无效地址', '请输入有效的服务器地址，例如 47.101.142.85:6100 或 http://47.101.142.85:6100');
      return;
    }
    try {
      setIsConnecting(true);
      // 先保存
      await setApiBaseUrl(normalized);
      // 简单联通性检测（可选）
      const pingUrl = `${normalized}/api/v1/ping`;
      let ok = false;
      try {
        const res = await fetch(pingUrl, { method: 'GET' });
        ok = res.ok;
      } catch {
        ok = false;
      }
      // 通知应用更新 API 配置
      DeviceEventEmitter.emit('apiBaseUrlChanged', normalized);

      if (ok) {
        Alert.alert('连接成功', '服务器地址已经更新并可用。');
      } else {
        Alert.alert('已保存', '地址已更新，暂未确认联通性，请稍后在顶部连接状态查看。');
      }
    } catch (e: any) {
      Alert.alert('保存失败', String(e?.message || e));
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
        <Text style={styles.sectionTitle}>用户信息</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>用户名:</Text>
          <Text style={styles.value}>{username || '未设置'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Short ID:</Text>
          <View style={styles.shortIdRow}>
            <Text style={styles.value}>{shortId || '未生成'}</Text>
            {shortId && (
              <TouchableOpacity style={styles.copyButton} onPress={handleCopyShortId}>
                <Text style={styles.copyButtonText}>复制</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>模型选择</Text>
        <Text style={styles.sectionSubtitle}>当前模型: {currentModel}</Text>
        <TouchableOpacity
          style={[
            styles.modelOption,
            currentModel === 'stega' && styles.modelOptionActive,
          ]}
          onPress={() => handleModelSelect('stega')}
        >
          <Text
            style={[
              styles.modelOptionText,
              currentModel === 'stega' && styles.modelOptionTextActive,
            ]}
          >
            Stega
          </Text>
          {currentModel === 'stega' && (
            <Text style={styles.checkmark}>✓</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.modelOption,
            currentModel === 'up_eca' && styles.modelOptionActive,
          ]}
          onPress={() => handleModelSelect('up_eca')}
        >
          <Text
            style={[
              styles.modelOptionText,
              currentModel === 'up_eca' && styles.modelOptionTextActive,
            ]}
          >
            UpEca
          </Text>
          {currentModel === 'up_eca' && (
            <Text style={styles.checkmark}>✓</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>服务器设置</Text>
        <Text style={styles.sectionSubtitle}>请输入后端服务器地址（支持 host:port 或完整URL）</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            ref={serverInputRef}
            style={styles.input}
            placeholder="例如：47.101.142.85:6100 或 http://47.101.142.85:6100"
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={showServerAddress ? 'url' : 'default'}
            placeholderTextColor="#9ca3af"
            secureTextEntry={!showServerAddress}
          />
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => {
              setShowServerAddress((prev) => !prev);
              requestAnimationFrame(() => {
                serverInputRef.current?.focus();
              });
            }}
            accessibilityRole="button"
            accessibilityLabel={showServerAddress ? '隐藏服务器地址' : '显示服务器地址'}
          >
            <Ionicons
              name={showServerAddress ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color="#6b7280"
            />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.connectButton, isConnecting && styles.connectButtonDisabled]} onPress={handleConnect} disabled={isConnecting}>
          <Text style={styles.connectButtonText}>{isConnecting ? '正在连接...' : '连接并保存'}</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4ff',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    marginHorizontal: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.1)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e3a8a',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  label: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    color: '#6b7280',
  },
  shortIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  copyButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modelOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  modelOptionActive: {
    borderColor: '#2563eb',
    backgroundColor: '#e0ecff',
  },
  modelOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  modelOptionTextActive: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: '#2563eb',
    fontWeight: 'bold',
  },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
    fontStyle: 'italic',
  },
  input: {
    flex: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#cbd5f5',
    backgroundColor: '#fff',
    marginBottom: 12,
    paddingRight: 6,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  connectButtonDisabled: {
    opacity: 0.7,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

