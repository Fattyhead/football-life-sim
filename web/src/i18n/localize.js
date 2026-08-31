import { useMemo } from 'react';
import { convertToSimplified } from './opencc.js';
import { useLocale } from './LocaleContext.jsx';

/* ---------- 繁簡轉換的統一入口 ---------- */
/* 稽核說明(使用者委託：繁中/簡中雙語，架構定案)：這一輪的核心判斷是
   「絕對不要另外維護一份簡體版的內容」——data/*.js／flow/*.js 一個字
   都不改，繁體永遠是唯一的內容來源，簡體只是「顯示的當下」轉換出來的
   結果。理由：
   1. flow/streakFlavor.js 這類連續紀錄 flavor 句是靠句子池「長度」
      (count % lines.length)配種子選句——如果簡體另外開一份翻譯陣列，
      句數稍微對不上，同一顆種子在繁簡兩版就會選到不同句子，直接破壞
      種子重現這個遊戲的核心賣點。維護單一份內容、只在輸出端轉換，
      這個風險完全不存在。
   2. 更重要的正確性原則：這裡「只轉顯示用的字串」，絕對不碰 S(球員
      狀態)本身、也不覆寫 data/*.js 匯出的原始物件——引擎(flow/*.js)
      讀到的永遠是未轉換的原始繁體資料，不管玩家介面選了哪個語言，
      遊戲邏輯判斷(比如任何字串比對)完全不受影響。這裡的每個函式都是
      「輸入一份資料/字串，回傳轉換後的新東西」，不做原地 mutate。
   localizeText：轉換單一字串(敘事句/label/desc 這種)，非 Chinese
   字元(數字/英文代碼如 'ANY'/'LOCAL')轉換是 no-op，不用另外判斷欄位
   是不是「文字」還是「代碼」。
   localizeTable：遞迴轉換一整份查表物件(data/*.js 那些 {label, desc}
   表)裡所有字串葉節點，用 WeakMap 快取——同一份表只會真的跑一次
   OpenCC 轉換，不管切換語言幾次或多少元件用到同一張表。
   useLocalizedTable/useT：給 React 元件用的 hook 版本，直接讀目前
   locale，元件不用自己管快取。 */

export function localizeText(text, locale) {
  if (locale !== 'zh-Hans') return text;
  return convertToSimplified(text);
}

function deepConvert(value) {
  if (typeof value === 'string') return convertToSimplified(value);
  if (Array.isArray(value)) return value.map(deepConvert);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = deepConvert(value[k]);
    return out;
  }
  return value; // number/boolean/null/undefined/function 原樣返回
}

const tableCache = new WeakMap();

export function localizeTable(table, locale) {
  if (locale !== 'zh-Hans' || !table || typeof table !== 'object') return table;
  let cached = tableCache.get(table);
  if (!cached) {
    cached = deepConvert(table);
    tableCache.set(table, cached);
  }
  return cached;
}

export function useLocalizedTable(table) {
  const { locale } = useLocale();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => localizeTable(table, locale), [table, locale]);
}

export function useT() {
  const { locale } = useLocale();
  return (text) => localizeText(text, locale);
}
