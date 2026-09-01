# Phase 0：把基準線量準

> 🔴 這份規格的驗收**全是數字**（7~8 → 0、4 → 0、4 → 1）。
> 那些數字如果是猜的，SC 就只是修辭。以下每一個都是量出來的。

## ① 加一種投影今天要改哪些既有檔（SC-001 的基準線）

實際走一遍「加第五種投影」要碰的檔：

| # | 檔 | 要加什麼 |
|---|---|---|
| 1 | `src/core/view-host.ts` | `LAYER_ORDER` 多一層 |
| 2 | `src/core/host/layout-presets.ts` | 四張版面的 `areas` 都要重排 |
| 3 | `src/ui/app-shell.ts` | 建容器 ＋ `grid-area` ＋ display 分支 ＋ `SLOT_BARS` 一列 |
| 4 | `src/i18n/zh-TW/blocks.json` | `LAYER_*` 鍵 |
| 5 | `src/i18n/en/blocks.json` | 同上 |
| 6 | `src/core/host/controls.ts` | 它的控制項投影到哪（若有） |
| 7 | `src/ui/host/web-profile.ts` | `controlSurfaces` 表態 |
| 8 | `src/vscode/vscode-profile.ts` | 同上 ＋ `layers`／`VscodeViewKind`／`VIEW_TYPES`／`TITLES` |

**⟹ 8 個既有檔**（VSCode 那一個裡面還有四處）。與規格寫的 7～8 相符。

## ② `app-shell` 裡的手寫分支（SC-002 的基準線）

```
grep -n "codeColumn|flowColumn|blocksColumn|bottomContainer" src/ui/app-shell.ts
  → 66 處提及
grep -nE "'element'|'relation'|'space'|'state'|四個一起列出來"
  → 18 處「四個一起列」的段落
```

🔴 而 SC-002 數的**不是提及數**（那含合法的持有），是**「四個一起列出來」的段落**：

```
SLOT_BARS                    四列（元素／格子／那條頭的選擇器）
建四個容器 ＋ 四個 grid-area   四段
applyLayout 的 display 分支   四行
layerAvailable                三個分支（element／state／其餘）
mountSlotPickers 的迴圈        跑那四列
```

**⟹ 基準線：5 個「四個一起列」的結構**（SC-002 寫 4，實測 5 ——規格要更正）。

## ③ 四條頭的產生器（SC-003 的基準線）

```
src/ui/panels/monaco-panel.ts:611      bar.className = 'monaco-clipboard-bar'
src/ui/panels/flow-panel.ts:977        bar.className = 'flow-toolbar'
src/ui/layout/bottom-panel.ts:37       this.tabBar.className = 'bottom-panel-tabs'
src/ui/toolbar/quick-access-bar.ts:17  class QuickAccessBar
＋ src/ui/app-shell.ts 的 `.panel-head`（沒有工具列時的那條）
```

**⟹ 基準線：5 個產生器**（規格寫 4，漏了 `.panel-head` ——要更正）。
🟢 而**樣式定義已經是 1 份**（2026-09-01 清償），這一格是「不得回退」。

## ④ 沿用哪一個既有機制：`import.meta.glob`（eager）

```
src/core/load-templates.ts:16   '/templates/*/template.json'
src/core/load-lessons.ts:13     '/lessons/*/*/lesson.json'
src/core/language-packs.ts:186  ⚠️ 「glob 的鍵順序不保證，而選單順序是設計出來的」
```

**決定**：面板宣告用同一招（build-time、eager）。
**理由**：三個既有的宣告來源都走它，而它是這個 repo 已經驗證過的形狀。
**⚠️ 而 `language-packs.ts:186` 那句警告直接適用**——面板的**順序**（版面裡由左到右）
不能靠 glob 的鍵順序，宣告裡要有一格 `order`，或由 `LAYER_ORDER` 決定。

**否決的替代方案**：
- 手寫一張 import 表 → 那正是「加一種要改既有檔」，與 SC-001 直接衝突。
- 執行期註冊（`registerPanel()`）→ 順序與時序都變成隱含的，
  而 `concepts/宣告登記處.md` 記著那個病（「一個沒有人宣告的登記處就是殼」）。

## ⑤ SC-001 要怎麼**真的**量到（這一格最容易變成一句話）

**決定**：一支測試在**測試檔自己**裡合成一份 `probe` 面板宣告推進登錄表，
然後斷言：版面清單、槽的選項、可見的格子都認得它——**而 `src/` 一個字都沒改**。

**⚠️ 「沒改」怎麼證明**：不是靠人看。測試裡取一份**既有檔的清單快照**
（`src/` 底下那 8 個檔的 mtime／內容雜湊），跑完再比一次。
🔴 而更強的版本是：那支測試**只 import 登錄表與組裝點**，
它能跑起來本身就證明了不需要碰別的。

**同一個形狀的既有例子**：`tests/integration/assembly-speaks-up.test.ts`
（「組裝漏了一步時要出聲」）。

## ⑥ 風險：這一刀最容易弄壞的三件事

1. **VSCode 的單層視窗**（`profile.layers` ＋ `reduceAreas` ＋ `hostLayoutOptions`）
   ——2026-09-01 才踩過「一格都不剩就炸」。
2. **第八十一條護欄**：`areas` 的每一列每一欄必須是 `LAYER_ORDER` 的子序列。
   宣告化之後 `LAYER_ORDER` 若由宣告導出，那條護欄的輸入就變了。
3. **`state` 那一層有兩個內容**（主控台／變數）——宣告是「一層一份」還是
   「一份一層、而一層可有多份」？**規格假設維持現況**，但資料模型要說得出來。

---

# Phase 4 動手時發現的：`mount` 進宣告，卡在一個規格沒講到的地方

> 2026-09-02，實作 T014 之前查證。

## 表面上的相依不是問題

`app-shell` 對視圖的 **8 處直接呼叫**（護欄量的那 21 的一部分）長這樣：

```
blocklyPanel.init(toolbox)                                    1 處
consolePanel.{copyOutput,clear,getInlineInput,onInputShow,…}  7 處
```

🟢 它們**全部是建構與接線**，不是跨層行為——把它們搬進各自的 `mount` 之後
那個數字會**下降**。所以它們不擋 T014，反而是 T014 的收益。

## 🔴 真正卡住的是：`AppShellElements` 把型別化的面板交出去

```ts
return { blocklyPanel, codeView, consolePanel, variablePanel, flowPanel, bottomPanel, … }
```

而 `app.ts` 拿它們**照型別**用。`mount` 進宣告之後，組裝點只拿得到
`PanelInstance`，於是要把它轉回 `BlocklyPanel`——**一個 `as`**。

> **把一個編譯期的型別換成一個執行期的轉型，
> 是在把「錯了會編不過」換成「錯了會在使用者那裡炸」。**

⚠️ 而這個專案有一條護欄正在盯同一件事的另一半
（`directViewCalls: 21`，P9 ④「跨層通訊只走 Bus」）。

## 三條路，而我建議第三條

| | 做法 | 代價 |
|---|---|---|
| 甲 | `PanelInstance.view` ＋ 組裝點 `as` 轉回去 | 🔴 用型別安全換模組化，**方向錯了** |
| 乙 | 每個宣告 export 一支型別化的 getter | ⚠️ `app-shell` 又要按 id import 五個檔——**id 分支換個地方寫** |
| 丙 | **`mount` 先只給「這一格自己畫得完」的東西**，而 `app.ts` 要的那幾支改走 Bus／ViewHost | 🟢 與 P9 ④ 同向，而**它是一刀不是一步** |

## ⟹ 對這份規格的影響

**SC-001（加一種投影改 0 個既有檔）在丙做完之前只到得了「metadata 層級」**：
新宣告可以進得來、被版面認得、被選單認得、頭長得出來——
**而它畫得出東西的前提是它不需要組裝點餵**。

🔴 這**不是把 SC-001 降級**，是發現它有一個沒被寫下來的前置。
規格的 Out of Scope 應該補一條，而丙那一刀要單獨立項。

> **一份規格如果沒有把它的前置寫出來，那個前置會在實作到一半時
> 以「這裡卡住了」的形式出現——而那時它看起來像實作的問題。**
