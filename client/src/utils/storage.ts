// cspell:ignore stegacam
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  USERNAME: 'stegacam_username',
  PASSWORD: 'stegacam_password',
  SHORT_ID: 'stegacam_short_id',
  MODEL: 'stegacam_model',
  IS_FIRST_LAUNCH: 'stegacam_first_launch',
  API_BASE_URL: 'stegacam_api_base_url',
  AUTH_TOKEN: 'stegacam_auth_token',
  USER_EMAIL: 'stegacam_user_email',
};

export async function getUsername(): Promise<string | null> {
  return await SecureStore.getItemAsync(KEYS.USERNAME);
}

export async function setUsername(username: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.USERNAME, username);
}

export async function getPassword(): Promise<string | null> {
  return await SecureStore.getItemAsync(KEYS.PASSWORD);
}

export async function setPassword(password: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.PASSWORD, password);
}

export async function getShortId(): Promise<string | null> {
  return await SecureStore.getItemAsync(KEYS.SHORT_ID);
}

export async function setShortId(shortId: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.SHORT_ID, shortId);
}

export async function getModel(): Promise<string> {
  const model = await SecureStore.getItemAsync(KEYS.MODEL);
  if (!model) {
    return 'stega';
  }
  // 兼容旧版本存储的模型名称
  if (model === 'stega_v1' || model === 'Stega_V1' || model === 'Steage_V1') {
    // 自动迁移到新名称
    await setModel('stega');
    return 'stega';
  }
  return model;
}

export async function setModel(model: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.MODEL, model);
}

/**
 * API Base URL
 */
export async function getApiBaseUrl(): Promise<string> {
  const saved = await SecureStore.getItemAsync(KEYS.API_BASE_URL);
  return saved || 'http://47.101.142.85:6100';
}

export async function setApiBaseUrl(url: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.API_BASE_URL, url);
}

export async function isFirstLaunch(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(KEYS.IS_FIRST_LAUNCH);
  return value !== 'false';
}

export async function setFirstLaunchComplete(): Promise<void> {
  await SecureStore.setItemAsync(KEYS.IS_FIRST_LAUNCH, 'false');
}

/**
 * Generate a random 7-character alphanumeric Short ID
 */
export function generateShortId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 7; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Auth Token Management
 */
export async function getAuthToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(KEYS.AUTH_TOKEN);
}

export async function setAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.AUTH_TOKEN, token);
}

export async function removeAuthToken(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.AUTH_TOKEN);
}

/**
 * User Email Management
 */
export async function getUserEmail(): Promise<string | null> {
  return await SecureStore.getItemAsync(KEYS.USER_EMAIL);
}

export async function setUserEmail(email: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.USER_EMAIL, email);
}

