/**
 * Base64 encoding utility for React Native
 * Since btoa is not available in React Native, we provide a polyfill
 */

export function base64Encode(str: string): string {
  // Try to use global btoa if available (web environment)
  const globalBtoa = typeof globalThis !== 'undefined' ? globalThis.btoa : undefined;
  if (typeof globalBtoa === 'function') {
    return globalBtoa(str);
  }
  
  // Fallback: manual base64 encoding
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  
  for (let i = 0; i < str.length; i += 3) {
    const a = str.charCodeAt(i);
    const b = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
    const c = i + 2 < str.length ? str.charCodeAt(i + 2) : 0;
    
    const bitmap = (a << 16) | (b << 8) | c;
    
    output += chars.charAt((bitmap >> 18) & 63);
    output += chars.charAt((bitmap >> 12) & 63);
    output += i + 1 < str.length ? chars.charAt((bitmap >> 6) & 63) : '=';
    output += i + 2 < str.length ? chars.charAt(bitmap & 63) : '=';
  }
  
  return output;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64Encode(binary);
}

