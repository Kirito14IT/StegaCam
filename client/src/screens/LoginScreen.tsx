import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { getApiBaseUrl } from '../utils/storage';
import { setAuthToken, setUserEmail, setShortId, setUsername, setFirstLaunchComplete } from '../utils/storage';
import { apiRegister, apiLogin } from '../api/client';
import type { ApiConfig } from '../queue/TaskTypes';

interface LoginScreenProps {
  onLoginComplete: () => void;
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ onLoginComplete }: LoginScreenProps) {
  const [isRegisterMode, setIsRegisterMode] = useState(true);
  const [email, setEmailState] = useState('');
  const [username, setUsernameState] = useState('');
  const [password, setPasswordState] = useState('');
  const [confirmPassword, setConfirmPasswordState] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (emailStr: string): boolean => {
    return EMAIL_REGEX.test(emailStr);
  };

  const handleSubmit = async () => {
    // Validation
    if (!email.trim()) {
      Alert.alert('错误', '请输入邮箱地址');
      return;
    }
    if (!validateEmail(email.trim())) {
      Alert.alert('错误', '请输入有效的邮箱地址');
      return;
    }
    if (!password.trim()) {
      Alert.alert('错误', '请输入密码');
      return;
    }
    if (password.length < 6) {
      Alert.alert('错误', '密码长度至少6位');
      return;
    }
    // bcrypt 限制密码不能超过 72 字节（UTF-8 编码）
    // 为了安全，我们限制为 72 个字符（大多数情况下 1 字符 = 1 字节）
    if (password.length > 72) {
      Alert.alert('错误', '密码长度不能超过72个字符');
      return;
    }

    if (isRegisterMode) {
      // Register mode
      if (password !== confirmPassword) {
        Alert.alert('错误', '两次输入的密码不一致');
        return;
      }
    }

    setLoading(true);
    try {
      const apiBaseUrl = await getApiBaseUrl();
      const apiConfig: ApiConfig = {
        baseURL: apiBaseUrl,
        timeoutMs: 30000,
      };

      let authResponse;
      if (isRegisterMode) {
        // Register
        authResponse = await apiRegister(apiConfig, {
          email: email.trim(),
          username: username.trim() || undefined,
          password: password,
        });
        Alert.alert('注册成功', `您的Short ID: ${authResponse.user.short_id}\n请妥善保管！`);
      } else {
        // Login
        authResponse = await apiLogin(apiConfig, {
          email_or_username: email.trim(),
          password: password,
        });
      }

      // Save auth token and user info
      await setAuthToken(authResponse.access_token);
      await setUserEmail(authResponse.user.email);
      await setShortId(authResponse.user.short_id);
      // Save username if available
      if (authResponse.user.username) {
        await setUsername(authResponse.user.username);
      } else if (isRegisterMode && username.trim()) {
        // If registering with username, save it
        await setUsername(username.trim());
      }
      await setFirstLaunchComplete();

      if (!isRegisterMode) {
        Alert.alert('登录成功', '欢迎回来！', [
          { text: '确定', onPress: onLoginComplete },
        ]);
      } else {
        onLoginComplete();
      }
    } catch (error: any) {
      const errorMessage = error?.message || '操作失败，请重试';
      Alert.alert('错误', errorMessage);
      console.error('Auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text style={styles.title}>欢迎使用 StegaCam</Text>
          <Text style={styles.subtitle}>
            {isRegisterMode ? '注册新账号' : '登录您的账号'}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="邮箱地址"
            value={email}
            onChangeText={setEmailState}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
            returnKeyType="next"
          />

          {isRegisterMode && (
            <TextInput
              style={styles.input}
              placeholder="用户名（可选）"
              value={username}
              onChangeText={setUsernameState}
              autoCapitalize="none"
              editable={!loading}
              returnKeyType="next"
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="密码"
            value={password}
            onChangeText={setPasswordState}
            secureTextEntry
            editable={!loading}
            returnKeyType={isRegisterMode ? "next" : "done"}
          />

          {isRegisterMode && (
            <TextInput
              style={styles.input}
              placeholder="确认密码"
              value={confirmPassword}
              onChangeText={setConfirmPasswordState}
              secureTextEntry
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {isRegisterMode ? '注册并开始使用' : '登录'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setIsRegisterMode(!isRegisterMode)}
            disabled={loading}
          >
            <Text style={styles.switchButtonText}>
              {isRegisterMode
                ? '已有账号？点击登录'
                : '没有账号？点击注册'}
            </Text>
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
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.1)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#6b7280',
    marginBottom: 32,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#cbd5f5',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  switchButtonText: {
    color: '#2563eb',
    fontSize: 14,
  },
});

