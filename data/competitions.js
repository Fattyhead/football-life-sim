/* ---------- 俱樂部層級杯賽 ---------- */
/* national.js 定的是「國家隊」賽事（球員代表地區出賽）。
   這裡定的是「俱樂部」賽事（球員代表所屬球隊出賽）——兩條線分開放，
   因為觸發條件不同：國家隊看 talentPoolDepth/OVR，俱樂部杯賽看球隊在聯賽的排名。
   簡化處理：不分地區另開賽事名稱，用兩個通用賽事對應 LOCAL/FEEDER 和 TOP5 兩層，
   夠用就好，不需要每個地區都有自己的杯賽名稱。 */

export const CLUB_CUP = {
  REGIONAL: {
    label: '洲際俱樂部杯賽',
    tiers: ['LOCAL', 'FEEDER'],
    qualify: '所屬聯賽排名前段可獲得參賽資格',
  },
  TOP5_ELITE: {
    label: '歐洲冠軍聯賽',
    tiers: ['TOP5'],
    qualify: 'TOP5 聯賽排名前段可獲得參賽資格',
  },
};

/* 這季 RAT(個人賽季表現)要到這個水準以上，代表球隊踢得夠好、你也是主力，
   球隊才有資格打進杯賽正賽——跟 transfer.js 用 RAT 代理「聯賽表現」是
   同一招，這裡代理「球隊+你的杯賽資格」，不做真的聯賽排名模擬。
   數字歐元化/RAT公式重算後跟著校準(見 flow/proSeason.js generateSeasonStats
   的稽核說明)：反推舊門檻(7.5)對應的 effOVR≈40，代入新公式算出等值
   新門檻 6.5，維持「門檻要求多好的能力值」語意不變。 */
export const CUP_QUALIFY_RAT = 6.5;

/* 晉級輪次，逐輪骰是否晉級(見 flow/clubCup.js)，跟 national.js 的
   WC_ROUND_ORDER 是同一種設計語言，只是杯賽輪次少一輪(沒有小組賽這麼多輪)。 */
export const CUP_ROUND_ORDER = ['R32', 'R16', 'QF', 'SF', 'FINAL', 'CHAMPION'];
export const CUP_ROUND_LABEL = {
  R32: '32強',
  R16: '16強',
  QF: '八強',
  SF: '四強',
  FINAL: '決賽',
  CHAMPION: '冠軍',
};
