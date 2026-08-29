/* ---------- 常態徽章：動態判定引擎 ---------- */
/* 稽核抓出來的斷點：PLAYSTYLE 原本是「解鎖一次永久加成」，效果直接疊進
   S.ab，永遠不會消失，跟能力值後續的衰退完全脫鉤——一個35歲腳程已經
   掉到60分的老將，履歷上還掛著「疾風」，不合理。改成跟「徽章」的字面
   意思一致：反映的是現在的狀態，每季重新判定，達門檻就有、掉出門檻就
   收回，這是徽章跟稱號(PLAYING_STYLE，反映已經發生過的事，維持永久)
   最根本的差異。

   效果不再直接寫進 S.ab(那樣拿掉徽章時沒辦法乾淨地把加成減回去，還會
   讓判定「加成後的值」自我鎖定，衰退再多都拔不掉)，改成每次要用「疊加
   徽章加成後的能力值」時才動態算一次(calcOVR/generateSeasonStats 的
   effAb 都呼叫 withPlaystyleBonus())，S.ab 本身維持只被訓練/衰退動到，
   職責單純，判定永遠吃「純訓練值」，不會有自我強化的問題。 */

import { PLAYSTYLE } from '../data/traits.js';
import { clamp } from '../core/rng.js';

/* 每季呼叫一次(proSeasonTick)：檢查每個徽章的門檻，跟目前
   S.traits.playstyle 的內容做差集——新達標的加進去(unlocked)，掉出門檻
   的拿掉(lost)。判定永遠吃「純訓練值」的 S.ab，不吃疊加徽章加成後的值。 */
export function checkPlaystyleBadges(S) {
  const unlocked = [];
  const lost = [];
  const current = new Set(S.traits.playstyle);

  for (const [key, def] of Object.entries(PLAYSTYLE)) {
    const meets = Object.entries(def.cond).every(([k, v]) => (S.ab[k] ?? 0) >= v);
    const has = current.has(key);
    if (meets && !has) {
      S.traits.playstyle.push(key);
      unlocked.push(key);
      // 歷史紀錄只增不減，供 flow/legacy.js 的終局評價用——即使之後衰退
      // 被收回，這輩子曾經達標過的事實不會消失。
      if (!S.everHadPlaystyle.includes(key)) S.everHadPlaystyle.push(key);
    } else if (!meets && has) {
      S.traits.playstyle = S.traits.playstyle.filter((k) => k !== key);
      lost.push(key);
    }
  }

  return { unlocked, lost };
}

/* 目前生效中的徽章加總起來的能力加成，各項獨立加總(可能同時有多個徽章
   加成同一項能力，例如疾風+抄截專家都加 PAC，疊加是刻意允許的)。 */
export function playstyleBonus(S) {
  const bonus = {};
  for (const key of S.traits.playstyle) {
    const def = PLAYSTYLE[key];
    if (!def) continue;
    for (const [k, v] of Object.entries(def.effect)) {
      bonus[k] = (bonus[k] || 0) + v;
    }
  }
  return bonus;
}

/* 疊加目前生效中的徽章加成後的能力值，給 calcOVR()/generateSeasonStats()
   的 effAb 共用——允許小幅突破 0-80 的常規天花板(clamp 到 85)，這是徽章
   效果「專精者能再往上一點」的設計本意，不應該被下游的判定/數據生成
   公式默默砍掉。 */
export function withPlaystyleBonus(S, ab = S.ab) {
  const bonus = playstyleBonus(S);
  const out = {};
  for (const k of Object.keys(ab)) {
    out[k] = clamp(ab[k] + (bonus[k] || 0), 1, 85);
  }
  return out;
}
