/* ---------- 國家隊隱藏對手 ---------- */
/* 這輪計畫明確排除的兩個項目之一，這次補齊。使用者原始構想是「世界杯
   國家隊競爭者，可以競爭隊長」——查證過現有系統(見 data/national.js
   WC_HONOR.ETERNAL_CAPTAIN 的稽核說明)，遊戲裡沒有「誰是現役隊長」這種
   即時可競爭的狀態，使用者當時定案：不新造隊長機制，這條線的張力改用
   「跟對手的戰績比較」當敘事骨架，真正的機制收尾掛在既有的世界盃奪冠
   事件(WORLD_CHAMPION)上疊加一段，不新建機制、不跟既有的冠軍退休文案
   搶位置(疊加，不是二選一)。

   跟訓練夥伴/戀愛線的差異：這裡的對手是同一支國家隊裡的隊友兼競爭者，
   不是自動觸發事件——起點卡在「真的入選國家隊」這個真實投入的門檻，
   比訓練線/戀愛線的起點(年度自動觸發，不用投入，見 flow/romance.js/
   flow/trainingRivalry.js 開頭的稽核說明)嚴格得多，是這條線刻意留給
   「真的打進國家隊」這個較稀有成就的專屬份量——三條線的起點門檻高低
   剛好對應各自的稀有度：戀愛基本款最容易，訓練夥伴次之(青訓/職業都
   自動觸發)，國家隊對手最難(要真的入選)。

   第一版把「之後」的部分做得太輕(純敘事比較，沒有玩家抉擇/機制效果/
   專屬稱號/UI)——使用者指出這跟戀愛線的原則不一致：王子路線走的是
   跟一般對象完全同一套 evaluate/resolve/UI/稱號管線，不是另外做一套
   閹割版。這裡補齊同樣的完整度。

   第二版修正(使用者更精確的定案)：CROSSROADS 不是 PRE_WC_YEAR 評估、
   接 wcReadinessBoost 兩邊都打折/加成——改成跟出軌誘惑同一種「系統
   隨機、當下判定」的節奏，直接在真正的世界盃年評估(不是前一年)，條件
   是「已經有對手 + 這年真的是世界盃年」：
     真正的玩家抉擇 — 個人表現(競爭) vs 團隊優先，機率骰(0.6)決定這年
       會不會遇到這個抉擇，比照出軌誘惑的「系統隨機」設計語言。
     機制效果 — 個人表現：這屆世界盃個人數據(進球/助攻)臨時加成，不會
       疊加隊伍晉級機率；團隊優先：疊加隊伍晉級機率(接既有的
       wcReadinessBoost，跟 WC_AUDITION/SQUAD_BONDING 同一個資源池)，
       沒有個人數據加成——純粹是資源分配的取捨，不是「選錯會被懲罰」。
     專屬稱號(隱藏結局) — 選了「個人表現」卻依然帶隊奪冠，才會觸發，
       見下面 RIVAL_HONOR.SELFISH_CROWN。跟 checkWorldCupWindow 同一季
       評估的先後順序：CROSSROADS 在季初的常駐階段就已經決定(見
       flow/proSeason.js prepareRivalChoice)，選擇本身暫存在
       S.wcRivalChoice，checkWorldCupWindow 這季稍後真正判定世界盃結果
       時讀取+清空這個暫存值，套用效果、判定稱號。
     UI — 跟 LoveChoice/TrainingRivalry 同款的抉擇卡片。 */

/* 訓練夥伴線交叉(這輪計畫明確排除、留到最後才做的第三項，這次補齊)：
   使用者原始構想「兩條平行系統突然交會」，比照《棒球人生模擬器》原版
   作者訪談提到的「雙刀流」精神(見 [[reference_yakyolife_author_interview]]
   稽核記憶)——具體做法分兩半，各自對應訓練夥伴線的 RIVAL/COMRADE 兩種
   類型，跟這兩種類型原本的敘事調性(競爭 vs 合作)天然對得起來：
     RIVAL 型 → 有機率就是這個人變成國家隊對手(見
       flow/nationalRival.js assignNationalRivalIfFirstCap)，不是隨機
       分配一個素不相識的新面孔——「俱樂部較勁到國家隊」比兩條完全獨立
       的關係線更有連貫感。只在真的第一次入選時骰一次(呼應
       assignNationalRivalIfFirstCap 本身的一次性)，沒骰中或當下沒有
       RIVAL 型夥伴，退回原本隨機指派的邏輯，不強求每個人都要有這段。
     COMRADE 型 → 每次入選國家隊窗口，都有機率這位夥伴也一起入選(見
       flow/nationalRival.js checkTrainingComradeSelected)，跟「對手」
       完全無關，純粹是「老搭檔也上場了」的溫馨版本，效果疊加進既有的
       wcReadinessBoost 資源池(跟 WC_AUDITION/RIVAL_TEAMFOCUS_READINESS_
       BONUS 同一個池子，不新開一條平行數值)，代表有熟悉的人在身邊，
       整備起來更踏實，這是士氣加成，不是能力值加成。
   兩者刻意都只是機率性的「有可能發生」，不是保證——玩家投入建立的兩段
   關係(俱樂部訓練夥伴+國家隊)平常各自獨立發展，交叉只是偶爾發生的
   驚喜彩蛋，不是每次都會撞在一起，這樣才有意外感。 */
export const TRAINING_RIVAL_CROSSOVER_CHANCE = 0.35; // RIVAL 型夥伴變成國家隊對手本人的機率
export const TRAINING_COMRADE_SELECTED_CHANCE = 0.25; // COMRADE 型夥伴這屆也一起入選的機率
export const PARTNER_ALSO_SELECTED_READINESS_BONUS = 0.05; // 老搭檔同框入選時，這屆的臨時士氣加成

export const NATIONAL_RIVAL_NAME_POOL = [
  '陳彥廷',
  '林柏毅',
  '黃子軒',
  '吳承翰',
  '張家瑋',
  '劉冠廷',
  '賴哲宇',
  '許奕辰',
  '蔡振宇',
  '鄭嘉良',
];

/* 每屆世界盃戰績比較的基礎機率——玩家自己這屆踢得越深、進球越多，比較
   結果偏向「領先對手」的機率越高，不是純骰運氣，讓玩家的真實表現有
   感覺得到的影響力。 */
export const RIVAL_COMPARISON_BASE_CHANCE = 0.5;
export const RIVAL_COMPARISON_ROUND_FACTOR = 0.06; // 每深入一輪，領先機率再加這麼多

/* CROSSROADS(個人表現 vs 團隊優先)：只在「已經有對手 + 這年真的是世界盃年」
   才會評估，機率 0.6——跟出軌誘惑同一種「系統隨機、不保證每次都遇到」
   的設計語言，不是每逢世界盃年一定會被問到。個人表現：這屆世界盃個人
   數據(進球/助攻)臨時加成，疊加在 personalTournamentStats() 計算用的
   有效 SHO/PAS 上(只影響這一屆，不寫回 S.ab)；團隊優先：疊加隊伍晉級
   機率，直接加進既有的 S.wcReadinessBoost(跟 WC_AUDITION/SQUAD_BONDING
   同一個資源池，不新開一條平行數值)。兩者互斥、各自純粹只投資自己那
   一邊，不是「選錯會被扣分」——純粹是資源分配的取捨，呼應「這是團隊
   運動」但不封死追求個人榮耀的路線。 */
export const RIVAL_CROSSROADS_TRIGGER_CHANCE = 0.6;
export const RIVAL_COMPETE_STAT_BOOST = 8; // 加在這屆世界盃個人數據計算用的臨時 SHO/PAS 加成
export const RIVAL_TEAMFOCUS_READINESS_BONUS = 0.1;

/* 專屬稱號(隱藏結局)：選了「個人表現」——把這屆世界盃當成證明自己的
   舞台，不是團隊優先——卻依然帶隊奪得世界盃冠軍，才會觸發。這是使用者
   明確定案的觸發條件(不是累積次數、也不是整個對抗史的走向，是「這一次
   賭對了」的戲劇性時刻)，只在真的奪冠(WORLD_CHAMPION)那屆判定——見
   flow/worldCup.js checkWCHonors。effect.fameBonus 跟 WC_HONOR 現有稱號
   同一個欄位語意(疊加進 S.transferBuzz)。 */
export const RIVAL_HONOR = {
  SELFISH_CROWN: {
    label: '孤高的王者',
    tier: 'ELITE',
    cond: '世界盃前選擇了「個人表現」，卻依然帶隊奪得世界盃冠軍',
    effect: { fameBonus: 0.4 },
  },
};
