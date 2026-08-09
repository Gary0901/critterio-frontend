import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const TOKEN_KEY = 'critterio_token';

export const BASE_URL = 'https://critterio-backend.zeabur.app/api/v1';

// 一定要設 timeout：axios 預設是無限等待，請求卡住時畫面會完全沒反應、
// 也不會進 catch，使用者和開發者都看不出發生什麼事。
// 60 秒對圖片上傳夠寬鬆，又不會讓使用者無止境地等
const client = axios.create({ baseURL: BASE_URL, timeout: 60_000 });

client.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default client;
