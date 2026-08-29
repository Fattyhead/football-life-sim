import { useLayoutEffect, useRef } from 'react';

/* 稽核修正(使用者反饋：每季開場的季初特訓卡片不會自動回到面板頂部，
   玩家得自己往上拉，才看得到骰子點數/剩餘可分配)：ProScreen.jsx/
   YouthScreen.jsx 共用同一個問題根源——.game-body/.game-content/
   .game-panel 這幾個捲動容器是同一批常駐的 DOM 節點，React 換內容
   (mode 從 'result' 換成 'allocate'，或任何一步換到下一步)不會自動把
   scrollTop 歸零，上一步捲到哪，下一步的卡片就從那個位置開始顯示——
   如果上一步的內容比較長(比如生涯軌跡清單、長篇敘事)，捲動位置留在
   下面，新卡片的開頭(骰子/剩餘點數這些最重要的資訊)反而看不到，
   變成每季開始都要多一個「往上拉」的多餘操作。
   桌面版(見 index.css min-width:1100px)跟手機版的捲動容器不是同一個
   元素：桌面版是 .game-content/.game-panel 各自獨立捲動，手機版是
   .game-body 整條一起捲——這裡三個都重置，桌面版用到 content/panel，
   手機版用到 body，用不到的那個(手機版的 content/panel 本來就
   overflow:visible，不是捲動容器)重置 scrollTop 是無害的 no-op，不用
   另外判斷現在是哪種版面。
   用 useLayoutEffect 不用 useEffect：要在瀏覽器真正畫出下一幀之前把
   捲動位置歸零，不然玩家會先閃一下「還沒歸零的舊位置」才跳回頂部，
   一格不容易發現但確實是可以避免的視覺瑕疵。 */
export function useResetScrollOnMode(mode) {
  const bodyRef = useRef(null);
  const contentRef = useRef(null);
  const panelRef = useRef(null);

  useLayoutEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    if (contentRef.current) contentRef.current.scrollTop = 0;
    if (panelRef.current) panelRef.current.scrollTop = 0;
  }, [mode]);

  return { bodyRef, contentRef, panelRef };
}
