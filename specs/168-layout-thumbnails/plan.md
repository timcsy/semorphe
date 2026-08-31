# Implementation Plan: 版面——四張示意圖，而沒有任何一層是特別的

**Branch**: `168-layout-thumbnails` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)

## Summary

把版面宣告從**一維的層清單**換成**二維的格子表**，讓它表達得出「十字」；
版面選單從文字列換成**由同一份宣告產生的四張示意圖**；`state` 的位置交給版面決定
（但不得被關掉）。核心是**一份宣告餵三個消費者**（套用／畫圖／護欄），
所以圖不可能與畫面不一致。

## Technical Context

**語言／框架**：TypeScript 5.x，無新相依（CSS Grid 是原生的）
**動到的檔**：
```
src/core/host/layout-presets.ts     宣告 ＋ 三個純函數（改）
src/ui/app-shell.ts                 applyLayout 改走 grid（改）
src/ui/toolbar/quick-pick.ts        或新元件：圖示網格（新）
src/ui/style.css                    grid 版面 ＋ 縮圖樣式（改）
src/ui/layout/bottom-panel.ts       高度改寫 grid 列高（改）
tests/integration/audit-layout-presets.test.ts   六條不變式（改）
e2e/layout-presets.spec.ts          四張圖 ＋ 位移 0（新）
```
**測試**：Vitest（護欄與單元）＋ Playwright（e2e）
**目標平台**：桌機瀏覽器 ＋ VSCode／Arduino IDE webview。行動版**不在這一刀**。

## Constitution Check

| 原則 | 評估 |
|---|---|
| **I. 簡約優先** | 🟢 無新相依；`BottomPanel` 不重做（決策 5）；`areas` 取代 `layers`——是**換掉**不是**並存**，不留兩份真相 |
| **II. TDD（非妥協）** | 🟢 順序寫死在 tasks：**先把第八十一條改成六條不變式並看它變紅**，再改宣告。e2e 的「位移 0」也先寫 |
| **III. Git 紀律** | 🟢 每一個 Phase 一個 commit |
| **IV. 規格文件保護** | 🟢 只新增 `specs/168-*`，不動既有 spec |
| **V. 繁體中文優先** | 🟢 spec／plan／tasks 全中文 |

🔴 **要記的一筆**：本刀**修改一條既有的硬性零護欄**（第八十一條的兩項）。
理由與四張圖逐一驗證見 [research.md](./research.md) 決策 2——
**是升成二維版本，不是放寬**。新規則仍然擋掉鏡像版面與「沒有 state 的版面」。

## Project Structure

### Documentation (this feature)

```
specs/168-layout-thumbnails/
├── spec.md
├── plan.md              ← 本檔
├── research.md          六個決策 ＋ 被否決的替代方案
├── data-model.md        LayoutPresetSpec ＋ 六條不變式
├── contracts/
│   └── layout-declaration.md
├── quickstart.md        五個手動驗收 ＋ 兩條自動化
└── checklists/requirements.md
```

### Source Code

```
src/
├── core/host/layout-presets.ts        ← 宣告（唯一真相）＋ 純函數
└── ui/
    ├── app-shell.ts                   ← applyLayout
    ├── toolbar/layout-thumbnails.ts   ← 新：圖示網格選單
    ├── layout/bottom-panel.ts         ← 高度改寫 grid 列高
    └── style.css
```

## 實作階段

### Phase 0：護欄先紅（TDD 的 Red）

1. 把 `audit-layout-presets` 的四條改成**六條不變式**（I1–I6，見 data-model）
2. 加入四份新宣告的**注入樣本**（含四個反例，見 contract）
3. **跑：必須紅**——因為現有宣告只有 `layers`，沒有 `areas`

⚠️ `build-guardrail` §6.5：先跑、確認紅、**逐項指名**，再改實作。

### Phase 1：宣告改成二維

1. `LayoutSlot`／`areas` 取代 `layers`；四份宣告照 data-model 填
2. `gridTemplateAreas()`／`thumbnailCells()`／`occupiedLayers()` 三個純函數
3. 🔴 **`layers` 整個移除**——留著就是兩份真相
4. **跑：Phase 0 的護欄轉綠**

### Phase 2：套用改走 CSS Grid

1. 編輯區容器改 `display: grid`，每個面板容器帶 `grid-area: <layer>`
2. `applyLayout` 改成「設 `grid-template-areas` ＋ 代換 `'*'`」
   ——🪦 刪掉今天那一串 `display: none` ／ `flexDirection` ／ inline width 的操作
3. `BottomPanel` 的拖曳改寫 **grid 的列高**（決策 5 的已知風險）
4. **e2e 先寫**：從「對照」切到「十字」，程式碼與積木的 rect 位移為 0

### Phase 3：四張示意圖

1. `layout-thumbnails.ts`：從 `thumbnailCells()` 產生小 grid，格子裡放層的 i18n 名
2. 版面那一格的選單改用它（沿用 QuickPick 的開關與鍵盤行為，只換列的渲染）
3. i18n：`LAYOUT_PRESET_GRID` ＋ 四層的名稱鍵
4. **e2e**：選單裡有四張圖、點第四張會套用

### Phase 4：收尾

1. `npm test` ＋ `npm run test:e2e`（本刀動的全是使用者按得到的東西）
2. 基線該上調的上調，`note` 寫明「輸入量」還是「清償」
3. knowie：draft 的 in-flight 標記 → 完成後走 judge §4 反流

## Complexity Tracking

| 複雜度 | 為什麼必要 | 更簡單的做法為何不夠 |
|---|---|---|
| 二維的 `areas` | 十字要求四格各放一層 | `layers: []` 表達不出「哪一層在哪一格」——這是 FR-001 的本體 |
| 改一條硬性零護欄 | 舊規則是一維的，在二維上沒有定義 | 開例外會在第五張圖進來時再開一次 |
| 編輯區換成 CSS Grid | 二維排列 flex 表達不出（要巢狀，而巢狀就是今天那個不對稱的來源） | 巢狀 flex 能做出十字，但 `applyLayout` 會回到一堆 inline 樣式互相覆蓋——那個病 `app-shell.ts:640` 已經記過一次 |

## T001 的產出：`applyLayout` 今天寫的每一條 inline 樣式

Phase 2 的 T013／T014 要把它們**全部刪掉**——漏掉一條就會變成兩處寫同一份狀態
（`app-shell.ts:640` 那段註解記過同一個病：**兩個地方寫同一個 inline 樣式，
後寫的那個不知道自己在覆蓋一份狀態**）。

```
① codeColumn.style.display        = 'none' ／ ''
② splitPane.setDividerVisible(false ／ true)
③ blocksColumn.style.flex         = '1' ／ ''
④ blocksColumn.style.width        = '100%' ／ ''
⑤ projectionRow.style.flexDirection = 'column' ／ 'row'
⑥ blocklyContainer.style.display  = '' ／ 'none'
⑦ flowEl.style.display            = '' ／ 'none'
⑧ splitPane.refresh()
⑨ document.body.setAttribute('data-layout', id)     ← 這一條【保留】，e2e 與 CSS 靠它
⑩ requestAnimationFrame(() => dispatchEvent(new Event('resize')))  ← 【保留】
```

⚠️ ③④ 是 `SplitPane` 也在寫的那兩格（`calc(50% - 2px)`）——**它們正是那段註解裡
「兩處寫同一份狀態」的當事人**。換成 grid 之後 `SplitPane` 在編輯區的角色要一起檢討，
而本刀先讓 grid 成為唯一寫版面的人。

## 風險

```
🔴 編輯區換 grid 會動到一段【正在運作】的版面邏輯
   → 緩解：e2e 先寫「四張圖各自的格數與位置」再動手；每個 Phase 一個 commit
🟡 BottomPanel 的高度今天是 inline，改成 grid 列高時可能兩處都寫
   → 緩解：Phase 2.3 明確把 inline 那份刪掉，不是並存
🟡 Blockly／流程圖在 grid 格子裡的 resize 時機
   → 既有的 `requestAnimationFrame(() => dispatchEvent(new Event('resize')))` 沿用
```
