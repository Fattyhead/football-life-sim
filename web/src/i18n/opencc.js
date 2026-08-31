/* ---------- 繁體→簡體轉換的最底層包裝 ---------- */
/* 稽核說明(使用者委託：先做繁中/簡中雙語，英文先不做)：繁簡是同一種
   語言、只是字形+少數用語差異，不是真翻譯——這裡刻意選 opencc-js 的
   't2cn' 子套件(見 package.json exports，只有 109KB，不是完整雙向
   full.js 那包 1.2MB)，from:'twp'(台灣繁體+片語庫，不是純字符對應的
   'tw')才會連「軟體→软件」「網路→网络」「程式→程序」這種兩岸慣用語
   差異都一起處理，不是逐字machine替換——實測比對過('tw' vs 'twp')，
   'twp' 才是真的抓得到用語差異的那個設定。
   這一層完全不管「什麼時候該轉」，只負責「給一個字串，轉成簡體」，
   локale 判斷/快取策略在 localize.js。 */
import { Converter } from 'opencc-js/t2cn';

let converter = null;

function getConverter() {
  if (!converter) {
    converter = Converter({ from: 'twp', to: 'cn' });
  }
  return converter;
}

/* 遊戲本身的文字素材是固定範圍(選項/稱號/敘事句池)，不是使用者輸入的
   自由文字，同一個字串會在每次 render 被重複問「轉成簡體是什麼」——
   這裡加一層簡單的 Map 快取，同一個字串只跑一次真正的 trie 轉換，不用
   每次重繪都重新掃一次字元樹。快取不設上限：素材集合本身是有限的
   (查表+敘事句池)，不會無界成長。 */
const cache = new Map();

/* 稽核修正(實測跑過整輪遊戲抓出來的用語落差)：OpenCC 的片語辭典把
   「詳細資料」整組轉成「详细数据」，不是單純轉成「详细资料」——「資料」
   在這裡指的是球員的個人檔案(能力值/生涯數據/稱號/戀愛狀態這些混合
   資訊)，不是狹義的數值統計，用「數據」會窄化原本的意思。這是唯一一個
   跑過整輪遊戲手動抓到的片語誤譯，用一個很小的人工修正表在真正轉換
   之後再修一次，不去動整個片語辭典(那是 OpenCC 維護的通用對照表，改
   了會影響到這裡沒踩到的其他情況)。只加確實驗證過有問題的條目，不要
   為了「保險」亂加一堆猜測性的修正。 */
const MANUAL_OVERRIDES = [['详细数据', '详细资料']];

export function convertToSimplified(text) {
  if (typeof text !== 'string' || text === '') return text;
  let out = cache.get(text);
  if (out === undefined) {
    out = getConverter()(text);
    for (const [wrong, right] of MANUAL_OVERRIDES) {
      if (out.includes(wrong)) out = out.split(wrong).join(right);
    }
    cache.set(text, out);
  }
  return out;
}
