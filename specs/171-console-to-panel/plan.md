# 實作計畫：主控台回到 panel 區，而十字退場

**分支**：`171-console-to-panel` ｜ **規格**：[spec.md](./spec.md)

## Technical Context

**語言／框架**：TypeScript 5.x（既有），**無新增外部相依**
**宿主表面**：網頁版自己的底條 ／ VSCode・Theia 的 panel 區 webview 視圖
**測試**：Vitest ＋ Playwright ＋ `tools/vscode-preflight`
**規模**：已知退場約 **329 行**，估計新增約 **120 行**（見 research.md）

## Constitution Check

| 原則 | 這一刀 | 判定 |
|---|---|---|
| I. 簡約優先 | 🟢 這一刀的**驗收條件之一就是「刪比加多」** | 通過 |
| II. TDD（非妥協） | 🔴 I4 的反轉**先讓新護欄紅**（quickstart §四、checklist 明寫） | 通過 |
| III. Git 紀律 | 一步一個 commit | 通過 |
| IV. 規格文件保護 | 兩個拍板點都給了**帶理由的預設**並記在 Assumptions | 通過 |
| V. 繁體中文優先 | 全部 | 通過 |

⚠️ **沒有豁免項。**

## Phase 0：Outline & Research

✅ [research.md](./research.md)——退場清單逐項量過（329 行）、
`state` 與十字的散佈量過、**一個替代方案被否決並寫下理由**
（「讓 `state` 跨滿整列」保留了整個病）。

## Phase 1：Design & Contracts

✅ [data-model.md](./data-model.md)——版面少一層（型別上就編不過）、
主控台的可見狀態是獨立的、「有輸出就自己回來」的規則
✅ [contracts/console-surface.md](./contracts/console-surface.md)——
宿主要接得住的三件、那條規則**住在共用的那一側**
✅ [quickstart.md](./quickstart.md)——五段驗證，每一段對一條 SC

## 實作順序（給 /speckit-tasks 的骨架）

```
① 主控台的表面契約 ＋「有輸出就自己回來」    先紅：關掉→執行→它要回來
② 網頁版：state 從 grid 的一格 → 獨立底條    SC-004 全程綠（除了十字那幾條）
③ 十字退場 ＋ areas 型別收窄成三層           編不過就是護欄
④ I4 反轉——先讓新的紅，再刪舊的
⑤ VSCode／Theia：panel 區的 view
⑥ 退場：setEditorLayout／退路／能力探測／editor-layout.ts
```

🔴 **③ 之前不要碰 VSCode 那側**：先讓網頁版與版面宣告站穩，
再去換宿主的表面——否則紅了會分不出是哪一半。

> **一次同時換「資料的形狀」與「它畫在哪」的重構，壞掉時你分不出是哪一半。**

⚠️ ②③④ 之間都要跑 `npm test` ＋ `npm run test:e2e`。

## Complexity Tracking

無違規項需要記錄。
