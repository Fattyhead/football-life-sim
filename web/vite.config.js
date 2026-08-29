import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// server.fs.allow：引擎(core/data/flow)放在 web/ 外層(專案根目錄)，
// 純前端要直接 import 那幾個目錄，Vite 預設只允許讀專案根(web/)以下的
// 檔案，這裡放行到整個 football-life-sim 專案根，讓 ../core、../data、
// ../flow 這種上層相對路徑 import 能正常運作。
export default defineConfig({
  plugins: [react()],
  // base 用相對路徑，不是寫死的絕對路徑——這個 SPA 沒有任何路由(單一元件
  // 樹靠內部 state 切畫面，不吃 URL 路徑)，用相對路徑打包，不管最後部署在
  // 網域根目錄還是 GitHub Pages 的 /repo名/ 子路徑下都能直接動，不用因為
  // 换部署位置就要跟著改設定。
  base: './',
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
});
