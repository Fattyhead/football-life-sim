/* ---------- 存讀檔：單一存檔位，localStorage ---------- */
/* 使用者定案：不做帳號登入，純瀏覽器本機存檔——跟這個專案「零後端」的
   既有架構一致(見 web/src/App.jsx 開頭的稽核說明：整個引擎狀態本來就
   確認過可以安全 JSON.stringify)。只留一個存檔位，跟原版「繼續生涯」
   的概念一樣，不做多存檔槽——這個遊戲一次只有一段「正在進行」的生涯，
   多存檔位對應不到任何真實需求。

   存檔時機：每一季真正結算完(finishProPick/finishYouthPick 跑完那一刻，
   見 App.jsx)就存一次，不是玩家手動按存檔——這樣才能在瀏覽器意外關掉
   時，最多只掉失「這一季還沒點繼續」那零點幾秒的進度，不是整段生涯。
   讀檔還原的落點刻意選在「這季結算完、準備進下一季」，不是精確還原到
   某個抉擇卡片彈出來的當下——正在跑的 season generator(見
   flow/proSeason.js resolveSeasonChoiceGen)本身是活的執行狀態，沒辦法
   序列化，這是刻意的還原顆粒度，不是遺漏。

   所有讀寫都包 try/catch：無痕模式或瀏覽器封鎖網站儲存資料時
   localStorage 會直接丟例外，遊戲要能照樣玩，只是沒辦法存檔，不能讓
   存檔功能本身讓整個網站打不開。 */

const SAVE_KEY = 'flsim:save:v1';

/* payload 形狀：{ version, seed, phase('youth'|'pro'), S, history, youthYear }
   phase 決定讀檔後要呼叫 App.jsx 的 startYouthYear() 還是 startProSeason()
   重新進場——這兩個函式本來就是「拿現在的 S 重算這一季要顯示什麼」的
   純進場邏輯，讀檔不用另外寫一套還原流程，直接借用現有的季初進場路徑。 */
export function saveCareer(payload) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, ...payload }));
    return true;
  } catch {
    return false;
  }
}

export function loadCareer() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.S) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCareer() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // 清不掉就算了，不影響開新生涯——新生涯一開始就會馬上覆寫掉這個 key。
  }
}

export function hasCareerSave() {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}
