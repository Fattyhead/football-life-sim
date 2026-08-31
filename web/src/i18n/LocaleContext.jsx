import { createContext, useContext, useEffect, useState } from 'react';

/* 語言切換的全域狀態——用 Context 是因為需要語言的元件散落在整棵元件樹
   各處(標題/選單/球員資料/敘事)，一路 prop-drilling 太麻煩，跟 S(球員
   狀態)本身走 ref+prop 不一樣，語言是「畫面怎麼呈現」的橫切關注點，
   本來就該用 Context 這種寫法。
   存 localStorage 是因為玩家選一次語言，不該每次重整頁面/繼續生涯又
   跳回預設——跟 saveStore.js/collectionStore.js 同一種「不用登入帳號，
   純瀏覽器本機儲存」的精神，key 前綴用同一套 flsim: 慣例。 */
const STORAGE_KEY = 'flsim:locale';
const LocaleContext = createContext({ locale: 'zh-Hant', setLocale: () => {} });

function loadStoredLocale() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'zh-Hans' ? 'zh-Hans' : 'zh-Hant';
  } catch {
    return 'zh-Hant';
  }
}

export function LocaleProvider({ children }) {
  const [locale, setLocale] = useState(loadStoredLocale);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // 存不了(無痕視窗/瀏覽器封鎖)就當這次只是暫時切換，不擋主要功能。
    }
  }, [locale]);

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
