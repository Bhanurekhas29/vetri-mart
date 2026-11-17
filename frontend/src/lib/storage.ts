// Keeps the login tokens safely on the phone.
// SecureStore uses the phone's protected storage. It does not exist in a web browser,
// so on web (testing only) we fall back to localStorage.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_KEY = 'vm_access_token';
const REFRESH_KEY = 'vm_refresh_token';

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

// A simple remembered yes/no, such as "the user has already seen the welcome screens".
export async function getFlag(key: string): Promise<boolean> {
  return (await getItem(`vm_flag_${key}`)) === '1';
}

export async function setFlag(key: string): Promise<void> {
  await setItem(`vm_flag_${key}`, '1');
}

// A remembered piece of text that is not a secret, such as the delivery pincode.
export async function getText(key: string): Promise<string | null> {
  return getItem(`vm_text_${key}`);
}

export async function setText(key: string, value: string): Promise<void> {
  await setItem(`vm_text_${key}`, value);
}

export type Tokens = { access: string | null; refresh: string | null };

export async function getTokens(): Promise<Tokens> {
  const [access, refresh] = await Promise.all([getItem(ACCESS_KEY), getItem(REFRESH_KEY)]);
  return { access, refresh };
}

export async function saveTokens(access: string, refresh: string): Promise<void> {
  await Promise.all([setItem(ACCESS_KEY, access), setItem(REFRESH_KEY, refresh)]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([removeItem(ACCESS_KEY), removeItem(REFRESH_KEY)]);
}
