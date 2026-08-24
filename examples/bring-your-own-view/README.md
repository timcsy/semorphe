# 自帶視圖 ＋ 即時互轉

**這個例子證明一件事**：你已經有自己的編輯器（Blockly、節點圖、純文字，都行），
只想加上「程式碼 ↔ 語義樹」的即時互轉——**不必用我們的面板，也不必用我們的建置工具。**

```bash
npm run build:sdk                              # 產出 dist-sdk/semorphe.mjs（我們用 Vite，你不用）
node examples/bring-your-own-view/build.mjs    # 用 esbuild 建這個例子
node examples/bring-your-own-view/dist/main.mjs
```

輸出：

```json
{"capsules":332,"updates":2,"componentIds":["python:program","python:var_assign",…],"code":"x = 5\nif x > 3:\n    print(\"big\")"}
```

## 你要寫的只有一個檔

`src/text-view.ts`——實作 `ViewHost`（六個成員），**就這樣**。
它會被 `registerViewsIn` 掃到、接上匯流排，然後收到 `semantic:update`。

## ⚠️ 而組裝今天有 40 行，那是一個發現不是範例的長度

`src/main.ts` 裡標了四個 ⚠️，每一個都是這個例子**做出來的時候真的踩到**的：

| | 症狀 | 根因 |
|---|---|---|
| ① | `import.meta.glob is not a function` | 直接 import 原始碼；正解是吃出貨產物 |
| ② | `Dynamic require of "path"`（jsdom） | 語言套件 import 了視圖層 ＋ Blockly ——**已修** |
| ③ | `if` 安靜地變成 `unresolved` | 膠囊的 lift 策略要自己登記 |
| ④ | `⟨unknown component: python:program⟩` | 產生器要靠 `pack.install()` |

③④ 今天仍然要消費者自己做，而**沒有任何東西會提醒你漏了**——
那是 `vision.md` 階段 8「核心可獨立出貨」還沒關掉的部分。

## 這個例子由護欄守著

`tests/integration/audit-portable-core.test.ts`（第五十八條）每次 CI 都會
建它、跑它、比對往返結果。**它壞掉＝「別人能用」這句話壞掉。**
