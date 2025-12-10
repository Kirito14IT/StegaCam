import 'react-native-get-random-values';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, DeviceEventEmitter, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

import { TaskQueueProvider } from './src/queue/TaskQueueProvider';
import type { ApiConfig } from './src/queue/TaskTypes';
import { ConnectionStatus } from './src/components/ConnectionStatus';
import { getApiBaseUrl, getAuthToken } from './src/utils/storage';
import LoginScreen from './src/screens/LoginScreen';
import CaptureScreen from './src/screens/CaptureScreen';
import DecodeListScreen from './src/screens/DecodeListScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

const DEFAULT_API: ApiConfig = {
  baseURL: 'http://47.101.142.85:6100',
  timeoutMs: 30000,
};

type TabIconName = 'camera' | 'image' | 'settings';

export default function App(): React.ReactElement {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [apiConfig, setApiConfig] = useState<ApiConfig>(DEFAULT_API);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const token = await getAuthToken();
        if (isMounted) {
          setIsLoggedIn(!!token);
        }
      } catch (error) {
        console.error('检查登录状态失败:', error);
        if (isMounted) {
          setIsLoggedIn(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    const loadApiBaseUrl = async () => {
      try {
        const base = await getApiBaseUrl();
        if (base && isMounted) {
          setApiConfig({ baseURL: base, timeoutMs: DEFAULT_API.timeoutMs });
        }
      } catch (error) {
        console.warn('读取 API 地址失败，使用默认值:', error);
      }
    };

    init();
    loadApiBaseUrl();

    const sub = DeviceEventEmitter.addListener('apiBaseUrlChanged', (url: unknown) => {
      if (typeof url === 'string' && url.length > 0) {
        setApiConfig({ baseURL: url, timeoutMs: DEFAULT_API.timeoutMs });
      }
    });

    return () => {
      isMounted = false;
      sub.remove();
    };
  }, []);

  const handleLoginComplete = useCallback(() => {
    setIsLoggedIn(true);
  }, []);

  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: '#ffffff',
      },
    }),
    []
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!isLoggedIn) {
    return <LoginScreen onLoginComplete={handleLoginComplete} />;
  }

  return (
    <TaskQueueProvider api={apiConfig}>
      <NavigationContainer theme={navigationTheme}>
        <StatusBar style="auto" />
        <ConnectionStatus api={apiConfig} />
        <Tab.Navigator
          screenOptions={{
            tabBarActiveTintColor: '#2563eb',
            tabBarInactiveTintColor: '#6b7280',
            tabBarStyle: {
              backgroundColor: '#ffffff',
              borderTopWidth: 1,
              borderTopColor: 'rgba(37, 99, 235, 0.1)',
              elevation: 8,
              shadowColor: '#2563eb',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              height: 60,
              paddingBottom: 8,
              paddingTop: 8,
            },
            headerStyle: {
              backgroundColor: '#ffffff',
              elevation: 4,
              shadowColor: '#2563eb',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
            },
            headerTintColor: '#1f2937',
            headerTitleStyle: {
              fontWeight: '600',
              fontSize: 18,
            },
          }}
        >
          <Tab.Screen
            name="拍照"
            component={CaptureScreen}
            options={{
              tabBarIcon: ({ color, focused }) => <TabIcon name="camera" color={color} focused={focused} />,
            }}
          />
          <Tab.Screen
            name="选择"
            component={DecodeListScreen}
            options={{
              tabBarIcon: ({ color, focused }) => <TabIcon name="image" color={color} focused={focused} />,
              headerTitle: '选择图片解码',
            }}
          />
          <Tab.Screen
            name="设置"
            component={SettingsScreen}
            options={{
              tabBarIcon: ({ color, focused }) => <TabIcon name="settings" color={color} focused={focused} />,
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </TaskQueueProvider>
  );
}

function TabIcon({ name, color, focused }: { name: TabIconName; color: string; focused?: boolean }) {
  const size = 26;
  const isActive = focused || color === '#2563eb';

  // 使用 useMemo 生成唯一的渐变 ID，避免多个 Tab 之间的 ID 冲突
  const gradientId = React.useMemo(() => `${name}-gradient-${Math.random().toString(36).substr(2, 9)}`, [name]);

  // 定义渐变色 - 更炫酷的配色
  const gradientColors = {
    start: isActive ? '#60a5fa' : '#9ca3af',
    end: isActive ? '#2563eb' : '#6b7280',
  };

  const renderIcon = () => {
    switch (name) {
      case 'camera':
        return (
          <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Defs>
              <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={gradientColors.start} stopOpacity="1" />
                <Stop offset="100%" stopColor={gradientColors.end} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Path
              d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
              fill={`url(#${gradientId})`}
              stroke={isActive ? '#1e40af' : '#4b5563'}
              strokeWidth="0.8"
            />
            <Path
              d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"
              fill={isActive ? '#ffffff' : '#f3f4f6'}
              opacity={isActive ? 0.9 : 0.6}
            />
            <Path
              d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"
              fill={isActive ? gradientColors.end : '#9ca3af'}
            />
          </Svg>
        );
      case 'image':
        return (
          <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Defs>
              <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={gradientColors.start} stopOpacity="1" />
                <Stop offset="100%" stopColor={gradientColors.end} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Path
              d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2z"
              fill={`url(#${gradientId})`}
              stroke={isActive ? '#1e40af' : '#4b5563'}
              strokeWidth="0.8"
            />
            <Path
              d="M8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
              fill={isActive ? '#ffffff' : '#f3f4f6'}
              opacity={isActive ? 0.9 : 0.6}
            />
          </Svg>
        );
      case 'settings':
        return (
          <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Defs>
              <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={gradientColors.start} stopOpacity="1" />
                <Stop offset="100%" stopColor={gradientColors.end} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Path
              d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
              fill={`url(#${gradientId})`}
              stroke={isActive ? '#1e40af' : '#4b5563'}
              strokeWidth="0.5"
            />
            <Path
              d="M12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
              fill={isActive ? '#ffffff' : '#f3f4f6'}
              opacity={isActive ? 0.9 : 0.6}
            />
          </Svg>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.iconContainer}>
      {renderIcon()}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 22,
  },
});

