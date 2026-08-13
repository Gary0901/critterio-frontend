/**
 * 跨畫面共用的 AsyncStorage key。
 * 只放「不只一個畫面會讀寫」的 key —— 單一畫面自用的（草稿、快取）留在該畫面即可。
 */

/**
 * AI 助理免責聲明是否已關閉。`'1'` = 已關閉，其餘（含未設定）= 顯示。
 * AskAIScreen 讀它決定顯不顯示，隱私與安全頁提供開關讓使用者開回來。
 */
export const AI_DISCLAIMER_KEY = 'askai_disclaimer_dismissed';
