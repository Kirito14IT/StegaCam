// Draft API client (Expo compatible)
// NOTE: For upload progress in Expo managed, prefer expo-file-system UploadTask.

// Use legacy API for Expo SDK 54 compatibility
import * as FileSystem from 'expo-file-system/legacy';
import type { ApiConfig } from '../queue/TaskTypes';
import { uint8ArrayToBase64 } from '../utils/base64';
import { getAuthToken } from '../utils/storage';

type ProgressCb = (p: number) => void;

export interface RegisterRequest {
  email: string;
  username?: string;
  password: string;
}

export interface LoginRequest {
  email_or_username: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: {
    id: number;
    email: string;
    username?: string;
    short_id: string;
  };
}

export interface UserInfo {
  id: number;
  email: string;
  username?: string;
  short_id: string;
}

export async function apiEncode(
  api: ApiConfig,
  params: { fileUri: string; fileName?: string; shortId: string; model?: string; onUploadProgress?: ProgressCb }
): Promise<string> {
  const url = `${api.baseURL}/api/v1/encode`;

  // Get auth token and ensure it's properly formatted
  let token = await getAuthToken();
  if (!token) {
    throw new Error('未登录，请先登录');
  }
  
  // Strip any whitespace from token
  token = token.trim();

  // Create FormData for React Native
  const formData = new FormData();
  
  // In React Native, FormData accepts file objects with uri, type, and name
  formData.append('image', {
    uri: params.fileUri,
    type: 'image/jpeg',
    name: params.fileName || 'image.jpg',
  } as any);
  
  formData.append('message', params.shortId);
  
  // Add model parameter if provided (always include it since getModel() always returns a value)
  if (params.model) {
    formData.append('model', String(params.model));
  }

  // Use fetch for better binary response handling
  // In React Native, FormData requires special handling for headers
  // Important: Authorization header must be set, and Content-Type should NOT be set for FormData
  const headers: Record<string, string> = {
    'Accept': 'image/png',
    'Authorization': `Bearer ${token}`,
  };
  
  // Debug: Log token presence (first 20 chars only for security)
  console.log('[apiEncode] Token present:', token ? `${token.substring(0, 20)}...` : 'null');
  console.log('[apiEncode] URL:', url);
  
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error('[apiEncode] Error response:', response.status, errorText);
    
    // If 401, check if token might be invalid or expired
    if (response.status === 401) {
      console.error('[apiEncode] 401 Unauthorized - Token might be invalid or expired');
      console.error('[apiEncode] Token (first 50 chars):', token ? token.substring(0, 50) : 'null');
    }
    
    throw new Error(`encode http ${response.status}: ${errorText}`);
  }

  // For React Native, convert arrayBuffer to base64
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const base64 = uint8ArrayToBase64(bytes);
  
  const tmp = `${FileSystem.cacheDirectory}imgproc_${Date.now()}.png`;
  
  // Use legacy API which supports EncodingType.Base64
  await FileSystem.writeAsStringAsync(tmp, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  
  return tmp;
}

export async function apiDecode(
  api: ApiConfig,
  params: { fileUri: string; fileName?: string; model?: string; onUploadProgress?: ProgressCb }
): Promise<{ success: boolean; data?: { message: string; model_used?: string }; error?: string }> {
  const url = `${api.baseURL}/api/v1/decode`;

  // Get auth token and ensure it's properly formatted
  let token = await getAuthToken();
  if (!token) {
    throw new Error('未登录，请先登录');
  }
  
  // Strip any whitespace from token
  token = token.trim();
  
  // Create FormData for React Native
  const formData = new FormData();
  formData.append('image', {
    uri: params.fileUri,
    type: 'image/jpeg',
    name: params.fileName || 'image.jpg',
  } as any);
  
  // Add model parameter if provided (always include it since getModel() always returns a value)
  if (params.model) {
    formData.append('model', String(params.model));
  }

  // Use fetch for better control
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  
  // Note: Don't set Content-Type for FormData, React Native will set it automatically with boundary
  
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`decode http ${response.status}: ${errorText}`);
  }

  try {
    const json = await response.json();
    return json;
  } catch (error) {
    throw new Error(`decode invalid json: ${error}`);
  }
}

/**
 * Register a new user
 */
export async function apiRegister(
  api: ApiConfig,
  request: RegisterRequest
): Promise<AuthResponse> {
  const url = `${api.baseURL}/api/v1/auth/register`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let errorMessage = '注册失败';
      try {
        const errorData = await response.json();
        // FastAPI错误格式可能是 { detail: "..." } 或 { detail: [...] }
        if (errorData.detail) {
          if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail) && errorData.detail.length > 0) {
            // 处理验证错误数组
            errorMessage = errorData.detail.map((err: any) => err.msg || err.message || String(err)).join(', ');
          }
        }
      } catch (e) {
        // 如果JSON解析失败，尝试读取文本
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        } catch (e2) {
          // 忽略
        }
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error: any) {
    // 如果是网络错误或其他错误，包装一下
    if (error.message) {
      throw error;
    }
    throw new Error(`注册失败: ${error.toString()}`);
  }
}

/**
 * Login with email/username and password
 */
export async function apiLogin(
  api: ApiConfig,
  request: LoginRequest
): Promise<AuthResponse> {
  const url = `${api.baseURL}/api/v1/auth/login`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let errorMessage = '登录失败';
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          } else if (Array.isArray(errorData.detail) && errorData.detail.length > 0) {
            errorMessage = errorData.detail.map((err: any) => err.msg || err.message || String(err)).join(', ');
          }
        }
      } catch (e) {
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        } catch (e2) {
          // 忽略
        }
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error: any) {
    if (error.message) {
      throw error;
    }
    throw new Error(`登录失败: ${error.toString()}`);
  }
}

/**
 * Get current user information
 */
export async function apiGetMe(api: ApiConfig): Promise<UserInfo> {
  const url = `${api.baseURL}/api/v1/auth/me`;

  const token = await getAuthToken();
  if (!token) {
    throw new Error('未登录，请先登录');
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: '获取用户信息失败' }));
    throw new Error(errorData.detail || `获取用户信息失败: ${response.status}`);
  }

  return await response.json();
}
