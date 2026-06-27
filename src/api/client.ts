import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const TOKEN_KEY = 'critterio_token';

// iOS 模擬器用 localhost，Android 模擬器改成 10.0.2.2，實機改成 Mac 的區網 IP
export const BASE_URL = 'http://localhost:3000/api/v1';

const client = axios.create({ baseURL: BASE_URL });

client.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default client;
