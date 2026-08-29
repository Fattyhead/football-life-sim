import { useRef, useState } from 'react';
import {
  setSeed,
  ri,
  chance,
  newState,
  gradeOpening,
  resolveYouthYear,
  narrateYouthSeason,
  narrateDebut,
  resolveDebut,
  prepareSeasonChoice,
  resolveSeasonChoiceGen,
  prepareLoveChoice,
  resolveLoveChoiceStep,
  prepareTrainingChoice,
  resolveTrainingChoiceStep,
  prepareTrainingCrossroadsChoice,
  resolveTrainingCrossroadsChoiceStep,
  checkTrainingBondMoment,
  prepareAgentChoice,
  resolveAgentChoiceStep,
  prepareAgentCrossroadsChoice,
  resolveAgentCrossroadsChoiceStep,
  checkAgentBondMoment,
  prepareRivalChoice,
  resolveRivalChoiceStep,
  availableOptions,
  frameChoice,
  narrateSeason,
  evaluateLegacy,
  rollSeasonOpener,
  applySeasonAllocation,
  trackSeasonSixes,
  computeRiskStreakFlavor,
  computeCategoryStreakFlavor,
  computeInvestStreakFlavor,
  RISK_TIERS,
  SOCIAL_OPTION,
  PATHS,
  LV,
} from './engine.js';
import TitleScreen from './screens/TitleScreen.jsx';
import CreateScreen from './screens/CreateScreen.jsx';
import GradeScreen from './screens/GradeScreen.jsx';
import YouthScreen from './screens/YouthScreen.jsx';
import DebutFailScreen from './screens/DebutFailScreen.jsx';
import ProScreen from './screens/ProScreen.jsx';
import EndingScreen from './screens/EndingScreen.jsx';
import CollectionScreen from './screens/CollectionScreen.jsx';
import HelpScreen from './screens/HelpScreen.jsx';
import { saveCareer, loadCareer, clearCareer } from './saveStore.js';
import { mergeCareerIntoCollection } from './collectionStore.js';

/* 選了風險層的選項結算完，把成功/失敗標籤+隱晦線索+這次新解鎖的稱號
   從 log 整理成畫面要顯示的形狀——青訓/職業兩邊的 log 欄位形狀不同
   (職業版風險欄位包在 log.yearlyChoice 裡，青訓版是攤平在 log 上，見
   flow/proSeason.js/flow/careerStart.js 的既有慣例)，呼叫端各自把對的
   那份 log 片段傳進來，這裡不用知道兩邊的差異。 */
function buildRiskDisplay(S, category, c) {
  const riskTag = c.riskTier ? { label: RISK_TIERS[c.riskTier].label, success: c.riskSuccess, pct: RISK_TIERS[c.riskTier].successPct } : null;
  const riskFlavor = c.riskTier ? computeRiskStreakFlavor(S, c.riskTier) : '';
  const categoryFlavor = computeCategoryStreakFlavor(S, category);
  // 積極操盤連賺/連賠的隱晦線索：只在這季真的選了 INVEST_AGGRESSIVE(c.invest
  // 存在)才有意義，跟 riskFlavor/categoryFlavor 一樣是額外的氣氛線索，
  // 不是主敘事，見 flow/streakFlavor.js computeInvestStreakFlavor()。
  const investFlavor = c.option === 'INVEST_AGGRESSIVE' ? computeInvestStreakFlavor(S) : '';
  const titlesUnlocked = [...(c.unlockedMastery || []), ...(c.unlockedRiskTierTitle || [])];
  return { riskTag, riskFlavor, categoryFlavor, investFlavor, titlesUnlocked };
}

/* 整個遊戲的畫面狀態機。S 用 ref 存(引擎函式是直接 mutate，不是回傳新
   物件)，畫面更新完全靠各個事件處理常式最後一定會呼叫某個 setState——
   不需要額外的「強制重render」計數器，React 本來就會在那些 setState
   之後重新渲染，屆時讀到的 S.current 已經是引擎呼叫後的最新值。

   戀愛線/訓練夥伴線的觸發模式(使用者這輪定案，見 flow/romance.js/
   flow/trainingRivalry.js 開頭的稽核說明)：
     起點(認識新對象/新夥伴)——年度自動觸發，不看這季選了什麼類別，
       青訓/職業生涯都適用，季初分配之後、類別選項之前評估(loveState/
       trainingRivalryState 的 pending.type 分別是 'PAPARAZZI'/'ENCOUNTER')。
     求婚/出軌誘惑——不看類別，常駐評估，跟起點同一個時機點。
     訓練夥伴 CROSSROADS(較勁/合作)——只有這季真的選了訓練類別才會
       評估，時機點在「玩家確定選了訓練類別+子選項+風險層之後、這季
       正式套用選項效果之前」，比起點/求婚出軌晚一步——pendingProPick/
       pendingYouthPick 暫存玩家已經選好的類別/子選項/風險層，等
       CROSSROADS 抉擇答完才真的呼叫 resolveSeasonChoice/resolveYouthYear。
   loveState/trainingRivalryState 兩個 state 在青訓/職業畫面之間共用
   (同一時間只有一個畫面在用，不會衝突)，青訓期的常駐結果先暫存在
   youthAmbientLog(青訓的 log 是攤平物件，沒有 partialLog 機制可以像
   職業版那樣合併，見 flow/careerStart.js 的稽核說明)，等這季真正選完
   類別、resolveYouthYear 跑完才合併進最終的 log。 */
export default function App() {
  const [screen, setScreen] = useState('title');

  const S = useRef(null);
  const grade = useRef(null);
  const legacy = useRef(null);
  // 種子字串本身只有丟給 setSeed() 才用得到，原本沒有另外存——可分享的
  // 掛靴卡(EndingCard.jsx)要在終局畫面顯示「種子 xxx」給玩家抄，這裡補存一份。
  const seedUsed = useRef('');

  const [youthYear, setYouthYear] = useState(1);
  const [youthMode, setYouthMode] = useState('choice'); // 'allocate' | 'loveChoice' | 'trainingChoice' | 'choice' | 'result'
  const [youthOpener, setYouthOpener] = useState(null);
  const [youthLine, setYouthLine] = useState([]);
  const [youthRisk, setYouthRisk] = useState({ riskTag: null, riskFlavor: '', categoryFlavor: '', investFlavor: '', titlesUnlocked: [] });
  const youthAmbientLog = useRef({});
  const pendingYouthPick = useRef(null);

  const [seasonOptions, setSeasonOptions] = useState(null);
  const partialLog = useRef(null);
  const pendingProPick = useRef(null);
  const [frameText, setFrameText] = useState('');
  const [proMode, setProMode] = useState('choice'); // 'allocate' | 'loveChoice' | 'trainingChoice' | 'agentChoice' | 'rivalChoice' | 'choice' | 'seasonOffer' | 'result'
  const [proOpener, setProOpener] = useState(null);
  // 戀愛/訓練夥伴常駐事件這季的暫存結果——ambientLog 要留著，玩家真的
  // 選完抉擇之後 resolveXChoiceStep 才能把兩段結果合併判定稱號。pending
  // 為 null 代表這季沒有抉擇要問玩家，畫面不會進對應的暫停模式。
  const [loveState, setLoveState] = useState({ ambientLog: null, pending: null });
  const [trainingRivalryState, setTrainingRivalryState] = useState({ ambientLog: null, pending: null });
  // 經紀人線(見 flow/agentLine.js)——PRO-only，青訓畫面不會用到這個
  // state，跟 loveState/trainingRivalryState 同一種 ambientLog+pending
  // 暫存寫法。
  const [agentState, setAgentState] = useState({ ambientLog: null, pending: null });
  // 國家隊隱藏對手線的 CROSSROADS(見 flow/nationalRival.js)——沒有 ambientLog
  // 可以暫存(這條線沒有常駐 bookkeeping，只有真正的世界盃年才會有的抉擇)，
  // 緊接在訓練夥伴抉擇處理完之後才評估(見 enterRivalChoice)。
  const [rivalChoiceState, setRivalChoiceState] = useState({ pending: null });
  // 六個「引擎骰出來的重大決定」(租借邀約/晉級報價/豪門挖角報價/合約
  // 危機/世界盃封頂退休/梅老闆退休，見 flow/proSeason.js
  // resolveSeasonChoiceGen 開頭的稽核說明)共用同一組暫存——seasonGen 是
  // 目前正在跑的 generator 實例(用 ref 存，不是 state，因為 generator
  // 物件本身不是要拿來渲染的資料，只是暫停/恢復執行用的控制代碼)，
  // seasonOfferState.pending 是目前那個 yield 出來的抉擇卡片內容，答完
  // 呼叫 seasonGen.current.next(選擇) 才會繼續往下跑，可能又 yield 出
  // 下一個決定(同一季理論上最多發生一次，但寫成迴圈型態不假設只會問
  //一次)，也可能直接跑到底回傳這季最終的 log。
  const seasonGen = useRef(null);
  const [seasonOfferState, setSeasonOfferState] = useState({ pending: null });
  const [proLine, setProLine] = useState([]);
  const [proStat, setProStat] = useState(null);
  // 晉級瞬間的畫面提示(見 index.css .game-shell[data-tier] 那組聯賽層級
  // accent)：driveSeasonGen 結算完這季才知道 S.tier 有沒有變，比對的是
  // finishProPick 開始跑這季 generator「之前」記下的層級——tierBeforeSeason
  // 只是暫存這一步比較用，不是要拿去渲染的資料，用 ref 存。降級也會改
  // S.tier，但降級不該慶祝，proPromoted 只在真的往上爬時才設 true(見
  // driveSeasonGen 裡的 LV[...].tier 數字比較)。
  const tierBeforeSeason = useRef(null);
  const [proPromoted, setProPromoted] = useState(null);
  const [proRisk, setProRisk] = useState({ riskTag: null, riskFlavor: '', categoryFlavor: '', investFlavor: '', titlesUnlocked: [] });
  const [history, setHistory] = useState([]);
  const prevLog = useRef(null);

  function handleStart(seed) {
    clearCareer(); // 開新生涯覆蓋掉現有存檔，見 TitleScreen.jsx 給玩家的提示文字
    setSeed(seed);
    seedUsed.current = seed;
    setScreen('create');
  }

  /* 讀檔：還原落點固定在「這季已結算完、準備進下一季」(見 saveStore.js
     開頭的稽核說明)，直接借用 startYouthYear()/startProSeason() 這兩個
     既有的季初進場函式重新推進，不用另外寫一套還原流程。存檔本身格式
     壞掉或跟現在的引擎版本對不上(欄位形狀改過)就直接清掉，不強行帶著
     一個可能半殘的 S 繼續跑——這種情況下讓玩家從頭開始一局新的，比讓
     遊戲帶著壞掉的狀態继续跑、之後在某個意外的地方噴錯更負責任。 */
  function handleContinueCareer() {
    const saved = loadCareer();
    if (!saved) return;
    try {
      // 重新播種不是為了「假裝接續同一串亂數」(存讀檔本來就沒辦法完美
      // 銜接亂數位置，見 saveStore.js 的稽核說明)，只是給 R()/ri()/chance()
      // 一個確定的起點，避免整個模組處在未初始化狀態。種子字串本身照樣
      // 顯示存檔當初的原始種子(seedUsed.current)給玩家看，不是這裡重新
      // 產生的衍生字串。
      setSeed(`${saved.seed || 'resume'}:resume:${Date.now()}`);
      seedUsed.current = saved.seed || '';
      S.current = saved.S;
      setHistory(Array.isArray(saved.history) ? saved.history : []);
      if (saved.phase === 'youth') {
        setYouthYear(saved.youthYear || 1);
        startYouthYear();
        setScreen('youth');
      } else {
        startProSeason();
        setScreen('pro');
      }
    } catch {
      clearCareer();
      setScreen('title');
    }
  }

  function handleShowCollection() {
    setScreen('collection');
  }

  function handleShowHelp() {
    setScreen('help');
  }

  function handleBackToTitle() {
    setScreen('title');
  }

  function handleCreate({ name, jersey, pos, regionCode }) {
    const s = newState(name, jersey, pos, regionCode, ri);
    // 起步路徑維持引擎隨機指派(這次已跟使用者定案)，不開放玩家選——
    // 對照 demo.js/story.js 既有的隨機指派方式，不是這裡新發明的規則。
    const pathKeys = Object.keys(PATHS);
    s.path = pathKeys[ri(0, pathKeys.length - 1)];
    S.current = s;
    grade.current = gradeOpening(s);
    setScreen('grade');
  }

  /* 季初特訓(骰子成長，見 flow/seasonOpener.js)是獨立於年度選項的步驟，
     每年開始都先跑一次，不看這年選了什麼類別——衰退期已過(dice.length
     ===0，職業版限定)就直接跳過分配畫面，不強塞一張沒有內容的卡片。 */
  function startYouthYear() {
    const opener = rollSeasonOpener(S.current, ri, 'YOUTH');
    if (opener.dice.length) {
      setYouthOpener(opener);
      setYouthMode('allocate');
    } else {
      setYouthOpener(null);
      enterYouthLoveChoice();
    }
  }

  function handleGradeContinue() {
    setYouthYear(1);
    startYouthYear();
    setScreen('youth');
  }

  function handleYouthAllocationConfirm(allocations) {
    applySeasonAllocation(S.current, allocations);
    trackSeasonSixes(S.current, youthOpener.sixes, 'YOUTH');
    enterYouthLoveChoice();
  }

  /* 戀愛線起點(狗仔自動觸發)：青訓期也適用，跟職業版同一個呼叫順序
     (季初分配之後、類別選項之前)、同一組 prepare/resolve，見
     flow/romance.js 的稽核說明。沒有 pending 就直接把 ambientLog 併進
     youthAmbientLog，繼續往下一步(訓練夥伴起點)走。 */
  function enterYouthLoveChoice() {
    const { ambientLog, pending } = prepareLoveChoice(S.current, ri, chance);
    if (pending) {
      setLoveState({ ambientLog, pending });
      setYouthMode('loveChoice');
    } else {
      const loveLog = resolveLoveChoiceStep(S.current, ri, chance, ambientLog, null);
      youthAmbientLog.current = { ...youthAmbientLog.current, ...loveLog };
      enterYouthTrainingChoice();
    }
  }

  function handleYouthLoveChoicePick(choice) {
    const loveLog = resolveLoveChoiceStep(S.current, ri, chance, loveState.ambientLog, loveState.pending, choice);
    youthAmbientLog.current = { ...youthAmbientLog.current, ...loveLog };
    enterYouthTrainingChoice();
  }

  /* 訓練夥伴線起點(年度自動觸發)：青訓期也適用，見
     flow/trainingRivalry.js 的稽核說明。沒有 pending 就直接把
     ambientLog 併進 youthAmbientLog，進入類別選單。 */
  function enterYouthTrainingChoice() {
    const { ambientLog, pending } = prepareTrainingChoice(S.current, ri, chance);
    if (pending) {
      setTrainingRivalryState({ ambientLog, pending });
      setYouthMode('trainingChoice');
    } else {
      const trainingLog = resolveTrainingChoiceStep(S.current, ri, chance, ambientLog, null);
      youthAmbientLog.current = { ...youthAmbientLog.current, ...trainingLog };
      setYouthMode('choice');
    }
  }

  /* 訓練夥伴卡片在青訓期有兩種用途(見 TrainingRivalry.jsx 的
     pending.type 分派)：ENCOUNTER 是起點(這裡處理，繼續往類別選單走)，
     CROSSROADS 是選了訓練類別之後才會出現(見 handleYouthPick)，答完要
     接著真正把這季的選項套用下去(finishYouthPick)，不是回到類別選單。 */
  function handleYouthTrainingChoicePick(choice) {
    const pending = trainingRivalryState.pending;
    if (pending.type === 'ENCOUNTER') {
      const trainingLog = resolveTrainingChoiceStep(S.current, ri, chance, trainingRivalryState.ambientLog, pending, choice);
      youthAmbientLog.current = { ...youthAmbientLog.current, ...trainingLog };
      setYouthMode('choice');
    } else {
      const crossroadsLog = resolveTrainingCrossroadsChoiceStep(S.current, ri, chance, pending, choice);
      youthAmbientLog.current = { ...youthAmbientLog.current, ...crossroadsLog };
      const { category, option, riskTierKey } = pendingYouthPick.current;
      finishYouthPick(category, option, riskTierKey);
    }
  }

  /* 玩家選好類別/子選項/風險層——如果選了訓練、且已經有訓練夥伴，先問
     CROSSROADS(較勁/合作，見 flow/trainingRivalry.js 的稽核說明：起點
     自動，但要持續投入訓練這條線才會繼續走下去)，答完才真的套用這季
     的選項效果；沒有 CROSSROADS 要問就直接套用。 */
  function handleYouthPick(category, option, riskTierKey) {
    if (category === 'TRAINING' && S.current.trainingPartner) {
      const { pending } = prepareTrainingCrossroadsChoice(S.current, category, chance);
      if (pending) {
        pendingYouthPick.current = { category, option, riskTierKey };
        setTrainingRivalryState({ ambientLog: null, pending });
        setYouthMode('trainingChoice');
        return;
      }
    }
    finishYouthPick(category, option, riskTierKey);
  }

  function finishYouthPick(category, option, riskTierKey) {
    // 羈絆時刻：跟職業版同一個相對位置(緊接在 CROSSROADS 之後、真正套用
    // 這季選項效果之前)，見 flow/trainingRivalry.js checkTrainingBondMoment
    // 的稽核說明——沒有暫停點要問玩家(命運安排的高潮時刻，不是選擇)，
    // 直接算完併進這季的 log。
    const bondMoment = checkTrainingBondMoment(S.current, category, chance);
    const log = resolveYouthYear(S.current, ri, chance, category, option, riskTierKey);
    const merged = { ...youthAmbientLog.current, ...log, ...(bondMoment && { bondMoment }) };
    youthAmbientLog.current = {};
    setYouthLine(narrateYouthSeason(S.current, merged, ri));
    setYouthRisk(buildRiskDisplay(S.current, category, merged));
    setYouthMode('result');
    // 自動存檔：這一年真正結算完就存一次，不是玩家手動按存檔，見
    // saveStore.js 開頭的稽核說明。
    saveCareer({ seed: seedUsed.current, phase: 'youth', S: S.current, youthYear });
  }

  function handleYouthContinue() {
    if (youthYear < 3) {
      setYouthYear((y) => y + 1);
      startYouthYear();
      return;
    }
    const debut = resolveDebut(S.current, ri, chance);
    if (!debut.passed) {
      clearCareer(); // 這條生涯線在這裡就結束了，沒有「下一季」可以回來
      setScreen('debutFail');
      return;
    }
    // 天才判定是青訓三年跑完才確定的收斂點(見 flow/careerStart.js
    // resolveDebut)，不屬於任何一年的 log，這裡在真正進職業生涯之前
    // 補一句——跟 story.js 既有的呼叫時機一致。
    const debutLine = narrateDebut(S.current);
    if (debutLine) setYouthLine([debutLine]);
    startProSeason();
  }

  /* frameChoice() 一定要在 prepareSeasonChoice() 之前呼叫——這是這個
     session 稽核抓出來的既有慣例(見 flow/context.js/frameChoice.js 的
     設計註解)：frameChoice 內部用 S.age+1/S.year+1 推算「這季實際會過的
     年齡/年份」，前提是呼叫時 S.age/S.year 都還沒被遞增。prepareSeasonChoice
     內部會真的執行 S.age+=1/S.year+=1，順序顛倒的話 frameChoice 會在
     已經遞增過的值上再加一次，讀到的情境句年齡會整整領先一歲。季初
     特訓(rollSeasonOpener)排在 prepareSeasonChoice 之後——這時 age/year
     已經遞增過，跟 flow/proSeason.js proSeasonTick() 的順序一致。 */
  function startProSeason() {
    const frame = frameChoice(S.current, prevLog.current, ri);
    // options.SOCIAL 這裡先是暫定值——戀愛常駐事件(enterLoveChoice)可能
    // 讓玩家這季分手/求婚/離婚，SOCIAL 選單要等那之後重算才準，見下面
    // enterLoveChoice() 的稽核說明。
    const { options, partialLog: pl } = prepareSeasonChoice(S.current);
    const opener = rollSeasonOpener(S.current, ri, 'PRO');
    setFrameText(frame);
    setSeasonOptions(options);
    partialLog.current = pl;
    if (opener.dice.length) {
      setProOpener(opener);
      setProMode('allocate');
    } else {
      setProOpener(null);
      enterLoveChoice();
    }
    setScreen('pro');
  }

  function handleProAllocationConfirm(allocations) {
    applySeasonAllocation(S.current, allocations);
    trackSeasonSixes(S.current, proOpener.sixes, 'PRO');
    enterLoveChoice();
  }

  /* 戀愛線起點(狗仔自動觸發)：季初分配之後、訓練/機會/社交三選一之前，
     不看這季會選什麼類別。稽核抓出來的排序陷阱：prepareSeasonChoice()
     算出的 SOCIAL 選單如果不重算，會反映「上一季」的戀愛狀態(比如這季
     剛好分手，選單卻還在顯示需要 DATING 狀態才開放的「經營感情」)——
     這裡用戀愛事件跑完之後的最新狀態重算一次覆蓋掉，availableOptions
     是純函式，多算一次不消耗 RNG。沒有待決的抉擇(pending 為 null)就
     直接呼叫 resolveLoveChoiceStep(finalizeLoveSeason 的稱號判定一定要
     跑到，不能因為沒有抉擇就跳過)，有的話進 'loveChoice' 畫面等玩家選。 */
  function enterLoveChoice() {
    const { ambientLog, pending } = prepareLoveChoice(S.current, ri, chance);
    setSeasonOptions((prev) => ({ ...prev, SOCIAL: availableOptions(S.current, SOCIAL_OPTION) }));
    if (pending) {
      setLoveState({ ambientLog, pending });
      setProMode('loveChoice');
    } else {
      const loveLog = resolveLoveChoiceStep(S.current, ri, chance, ambientLog, null);
      partialLog.current = { ...partialLog.current, love: loveLog };
      setLoveState({ ambientLog, pending: null });
      enterTrainingRivalryChoice();
    }
  }

  function handleLoveChoicePick(choice) {
    const loveLog = resolveLoveChoiceStep(S.current, ri, chance, loveState.ambientLog, loveState.pending, choice);
    partialLog.current = { ...partialLog.current, love: loveLog };
    enterTrainingRivalryChoice();
  }

  /* 訓練夥伴線起點(年度自動觸發，見 flow/trainingRivalry.js prepareTrainingChoice)：
     緊接在戀愛抉擇處理完之後、訓練/機會/社交三選一之前，不看這季會選
     什麼類別。CROSSROADS(較勁/合作)不在這裡評估——那個要等玩家真的
     選了訓練類別才會問，見 handleProPick。 */
  function enterTrainingRivalryChoice() {
    const { ambientLog, pending } = prepareTrainingChoice(S.current, ri, chance);
    if (pending) {
      setTrainingRivalryState({ ambientLog, pending });
      setProMode('trainingChoice');
    } else {
      const trainingLog = resolveTrainingChoiceStep(S.current, ri, chance, ambientLog, null);
      partialLog.current = { ...partialLog.current, training: trainingLog };
      setTrainingRivalryState({ ambientLog, pending: null });
      enterAgentChoice();
    }
  }

  /* 經紀人線起點(年度自動觸發，見 flow/agentLine.js prepareAgentChoice)：
     緊接在訓練夥伴起點處理完之後、國家隊對手線之前——PRO-only，這裡不用
     額外判斷，S.agent 起點本來就只會在職業生涯被指派。CROSSROADS(大膽
     操作/穩紮穩打)不在這裡評估，那個要等玩家真的選了機會類別才會問，
     見 handleProPick。 */
  function enterAgentChoice() {
    const { ambientLog, pending } = prepareAgentChoice(S.current, ri, chance);
    if (pending) {
      setAgentState({ ambientLog, pending });
      setProMode('agentChoice');
    } else {
      const agentLog = resolveAgentChoiceStep(S.current, ri, chance, ambientLog, null);
      partialLog.current = { ...partialLog.current, agent: agentLog };
      setAgentState({ ambientLog, pending: null });
      enterRivalChoice();
    }
  }

  /* 經紀人卡片有兩種用途，跟訓練夥伴同一個道理(見
     handleTrainingRivalryPick)：ENCOUNTER 是起點(這裡處理，繼續往國家隊
     對手線走)，CROSSROADS 是選了機會類別之後才會出現(見 handleProPick)，
     答完要接著真正套用這季的選項(finishProPick)。 */
  function handleAgentPick(choice) {
    const pending = agentState.pending;
    if (pending.type === 'ENCOUNTER') {
      const agentLog = resolveAgentChoiceStep(S.current, ri, chance, agentState.ambientLog, pending, choice);
      partialLog.current = { ...partialLog.current, agent: agentLog };
      enterRivalChoice();
    } else {
      const crossroadsLog = resolveAgentCrossroadsChoiceStep(S.current, ri, chance, pending, choice);
      partialLog.current = { ...partialLog.current, agentCrossroads: crossroadsLog };
      const { category, option, riskTierKey } = pendingProPick.current;
      finishProPick(category, option, riskTierKey);
    }
  }

  /* 訓練夥伴卡片在職業生涯有兩種用途，跟青訓期同一個道理(見
     handleYouthTrainingChoicePick)：ENCOUNTER 是起點(這裡處理，繼續往
     國家隊對手線走)，CROSSROADS 是選了訓練類別之後才會出現(見
     handleProPick)，答完要接著真正套用這季的選項(finishProPick)。 */
  function handleTrainingRivalryPick(choice) {
    const pending = trainingRivalryState.pending;
    if (pending.type === 'ENCOUNTER') {
      const trainingLog = resolveTrainingChoiceStep(S.current, ri, chance, trainingRivalryState.ambientLog, pending, choice);
      partialLog.current = { ...partialLog.current, training: trainingLog };
      enterAgentChoice();
    } else {
      const crossroadsLog = resolveTrainingCrossroadsChoiceStep(S.current, ri, chance, pending, choice);
      partialLog.current = { ...partialLog.current, trainingCrossroads: crossroadsLog };
      const { category, option, riskTierKey } = pendingProPick.current;
      finishProPick(category, option, riskTierKey);
    }
  }

  /* 國家隊隱藏對手線的 CROSSROADS(見 flow/nationalRival.js)：緊接在訓練
     夥伴抉擇處理完之後、訓練/機會/社交三選一之前，不看這季會選什麼
     類別——這條線的起點(指派對手)卡在真的入選國家隊，但 CROSSROADS
     本身不卡類別。沒有 pending 就直接呼叫 resolveRivalChoiceStep(內部
     沒有常駐效果要套用，純粹是維持跟其他兩條線一致的呼叫慣例)。 */
  function enterRivalChoice() {
    const { pending } = prepareRivalChoice(S.current, chance);
    if (pending) {
      setRivalChoiceState({ pending });
      setProMode('rivalChoice');
    } else {
      const rivalLog = resolveRivalChoiceStep(S.current, null, null);
      partialLog.current = { ...partialLog.current, nationalRivalCrossroads: rivalLog };
      setRivalChoiceState({ pending: null });
      setProMode('choice');
    }
  }

  function handleRivalChoicePick(choice) {
    const rivalLog = resolveRivalChoiceStep(S.current, rivalChoiceState.pending, choice);
    partialLog.current = { ...partialLog.current, nationalRivalCrossroads: rivalLog };
    setProMode('choice');
  }

  /* 玩家選好類別/子選項/風險層——如果選了訓練、且已經有訓練夥伴，先問
     CROSSROADS(見 flow/trainingRivalry.js 的稽核說明)；如果選了機會、
     且已經有經紀人，先問經紀人的 CROSSROADS(見 flow/agentLine.js 的
     稽核說明)——兩條線的 CROSSROADS 天生互斥(各自卡在不同類別)，同一季
     最多只會遇到一個，不用處理兩個都要問的情況。都沒有要問的就直接套用。 */
  function handleProPick(category, option, riskTierKey) {
    if (category === 'TRAINING' && S.current.trainingPartner) {
      const { pending } = prepareTrainingCrossroadsChoice(S.current, category, chance);
      if (pending) {
        pendingProPick.current = { category, option, riskTierKey };
        setTrainingRivalryState({ ambientLog: null, pending });
        setProMode('trainingChoice');
        return;
      }
    }
    if (category === 'OPPORTUNITY' && S.current.agent) {
      const { pending } = prepareAgentCrossroadsChoice(S.current, category, chance);
      if (pending) {
        pendingProPick.current = { category, option, riskTierKey };
        setAgentState({ ambientLog: null, pending });
        setProMode('agentChoice');
        return;
      }
    }
    finishProPick(category, option, riskTierKey);
  }

  function finishProPick(category, option, riskTierKey) {
    // 羈絆時刻/世紀交易：見 finishYouthPick 同一段註解——緊接在 CROSSROADS
    // 之後、resolveSeasonChoice 之前，無條件呼叫，跟 headless
    // flow/proSeason.js proSeasonTick 同一個相對位置，不會有 RNG 消耗
    // 不一致的風險。兩個都無條件呼叫(不是 if/else)：category 不同時
    // 各自內部會自我判斷要不要真的評估，呼叫端不用先猜是哪條線。
    const bondMoment = checkTrainingBondMoment(S.current, category, chance);
    if (bondMoment) {
      partialLog.current = { ...partialLog.current, trainingCrossroads: { ...(partialLog.current.trainingCrossroads || {}), bondMoment } };
    }
    const agentBondMoment = checkAgentBondMoment(S.current, category, chance);
    if (agentBondMoment) {
      partialLog.current = { ...partialLog.current, agentCrossroads: { ...(partialLog.current.agentCrossroads || {}), agentBondMoment } };
    }
    // 六個引擎重大決定改走 generator(見 flow/proSeason.js
    // resolveSeasonChoiceGen 的稽核說明)：啟動它、走一步，這季如果真的
    // 命中某個決定，會在這裡的第一個 gen.next() 就 yield 出來，不會跑到
    // 一半又生出第二個(每個決定各自的 evaluate 都在函式裡各自的位置，
    // 一次只會停在一個 yield 上)——driveSeasonGen 統一處理「停下來問
    // 玩家」還是「直接跑完」兩種情況，finishProPick/handleSeasonOfferPick
    // 都呼叫同一個，不要各寫一份。
    tierBeforeSeason.current = S.current.tier;
    const gen = resolveSeasonChoiceGen(S.current, ri, chance, category, option, riskTierKey, partialLog.current);
    seasonGen.current = { gen, category };
    driveSeasonGen(gen.next());
  }

  /* 驅動職業球季的 generator：step 是 gen.next(...) 的回傳值。還沒跑完
     (step.done===false)代表這一步 yield 出了一個抉擇卡片(step.value 就是
     flow/proSeason.js 那六種 { type, ... } 之一)，暫停在 seasonOffer
     畫面等玩家點擊；真的跑完(step.done===true)代表這季結算完畢，
     step.value 是最終的 log，跟原本 resolveSeasonChoice() 直接回傳的
     東西完全一樣，走原本的敘事/結果畫面收尾邏輯。 */
  function driveSeasonGen(step) {
    if (!step.done) {
      setSeasonOfferState({ pending: step.value });
      setProMode('seasonOffer');
      return;
    }
    const { category } = seasonGen.current;
    seasonGen.current = null;
    setSeasonOfferState({ pending: null });
    const log = step.value;
    const lines = narrateSeason(S.current, log, ri);
    setProLine(lines);
    setProStat(log.stat);
    setProRisk(buildRiskDisplay(S.current, category, log.yearlyChoice));
    // 晉級瞬間：只在層級數字真的往上爬才算(LV[...].tier 是 1/2/3 的
    // 序數)，降級/租借造成的 S.tier 變動不觸發——見上面 proPromoted 那段
    // 稽核說明。tierBeforeSeason.current 為 null(青訓期沒有 S.tier)時
    // 這個比較天然不會誤觸發。
    const before = tierBeforeSeason.current;
    const after = S.current.tier;
    setProPromoted(before && after && after !== before && LV[after].tier > LV[before].tier ? after : null);
    setProMode('result');
    const newHistory = [...history, { year: log.year, age: log.age, lines }];
    setHistory(newHistory);
    prevLog.current = log;
    // 自動存檔：見 finishYouthPick 同一段稽核說明。已經退休的這一局
    // 沒有「下一季」可以回來(見 handleProContinue 走終局流程)，直接清掉，
    // 避免標題畫面留著一個指向已結束生涯的「繼續生涯」按鈕。
    if (S.current.retired) {
      clearCareer();
    } else {
      saveCareer({ seed: seedUsed.current, phase: 'pro', S: S.current, history: newHistory });
    }
  }

  function handleSeasonOfferPick(choice) {
    driveSeasonGen(seasonGen.current.gen.next(choice));
  }

  function handleProContinue() {
    if (S.current.retired) {
      legacy.current = evaluateLegacy(S.current, ri);
      // 成就典藏：這局真正結算完才併入跨局累積(見 collectionStore.js
      // mergeCareerIntoCollection 的稽核說明)，半途放棄的生涯不算數。
      mergeCareerIntoCollection(S.current, legacy.current);
      setScreen('ending');
      return;
    }
    startProSeason();
  }

  function handleRestart() {
    clearCareer(); // 保險起見(正常路徑上到這裡存檔早就清過了，見上面幾個呼叫點)
    S.current = null;
    grade.current = null;
    legacy.current = null;
    prevLog.current = null;
    partialLog.current = null;
    pendingProPick.current = null;
    pendingYouthPick.current = null;
    youthAmbientLog.current = {};
    seasonGen.current = null;
    seedUsed.current = '';
    setHistory([]);
    setProStat(null);
    setLoveState({ ambientLog: null, pending: null });
    setTrainingRivalryState({ ambientLog: null, pending: null });
    setAgentState({ ambientLog: null, pending: null });
    setRivalChoiceState({ pending: null });
    setSeasonOfferState({ pending: null });
    setScreen('title');
  }

  switch (screen) {
    case 'title':
      return <TitleScreen onStart={handleStart} onContinue={handleContinueCareer} onCollection={handleShowCollection} onHelp={handleShowHelp} />;
    case 'collection':
      return <CollectionScreen onBack={handleBackToTitle} />;
    case 'help':
      return <HelpScreen onBack={handleBackToTitle} />;
    case 'create':
      return <CreateScreen onCreate={handleCreate} />;
    case 'grade':
      return <GradeScreen S={S.current} grade={grade.current} onContinue={handleGradeContinue} />;
    case 'youth':
      return (
        <YouthScreen
          S={S.current}
          yearIndex={youthYear}
          mode={youthMode}
          opener={youthOpener}
          lovePending={loveState.pending}
          trainingPending={trainingRivalryState.pending}
          lastLine={youthLine}
          risk={youthRisk}
          onAllocationConfirm={handleYouthAllocationConfirm}
          onLoveChoicePick={handleYouthLoveChoicePick}
          onTrainingRivalryPick={handleYouthTrainingChoicePick}
          onPick={handleYouthPick}
          onContinue={handleYouthContinue}
        />
      );
    case 'debutFail':
      return <DebutFailScreen onRestart={handleRestart} />;
    case 'pro':
      return (
        <ProScreen
          S={S.current}
          options={seasonOptions}
          frameText={frameText}
          mode={proMode}
          opener={proOpener}
          lovePending={loveState.pending}
          trainingPending={trainingRivalryState.pending}
          agentPending={agentState.pending}
          seasonOfferPending={seasonOfferState.pending}
          lastLine={proLine}
          lastStat={proStat}
          risk={proRisk}
          promotedTo={proPromoted}
          history={history}
          onAllocationConfirm={handleProAllocationConfirm}
          onLoveChoicePick={handleLoveChoicePick}
          onTrainingRivalryPick={handleTrainingRivalryPick}
          onAgentPick={handleAgentPick}
          onRivalChoicePick={handleRivalChoicePick}
          onSeasonOfferPick={handleSeasonOfferPick}
          onPick={handleProPick}
          onContinue={handleProContinue}
        />
      );
    case 'ending':
      return <EndingScreen S={S.current} legacy={legacy.current} seed={seedUsed.current} onRestart={handleRestart} />;
    default:
      return null;
  }
}
