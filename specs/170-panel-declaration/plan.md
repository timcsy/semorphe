# 實作計畫：一種投影 ＝ 一份宣告

**分支**：`170-panel-declaration` ｜ **規格**：[spec.md](./spec.md)

## Technical Context

**語言／框架**：TypeScript 5.x（既有），無新增外部相依
**宣告收集**：`import.meta.glob`（eager）——與 templates／lessons／language-packs 同一招
**儲存**：N/A（宣告是不變的資料）
**測試**：Vitest（單元／整合／護欄）＋ Playwright（e2e，**一條都不改**）
**目標宿主**：網頁版（四層）、VSCode／Arduino IDE（單層視窗 ×3）
**規模**：`app-shell.ts` 約 1400 行，其中「四個一起列」的結構 5 處（實測）

## Constitution Check

| 原則 | 這一刀 | 判定 |
|---|---|---|
| I. 簡約優先 | 🟢 它**刪掉**重複，不新增機制——沿用既有的 glob 形狀 | 通過 |
| II. TDD（非妥協） | 🔴 SC-001／SC-002 的護欄**必須先紅**（quickstart §一、§二明寫） | 通過 |
| III. Git 紀律 | 一刀一個 commit，訊息說明轉變 | 通過 |
| IV. 規格文件保護 | 規格已依實測**更正過兩個數字**（4→5、4→5） | 通過 |
| V. 繁體中文優先 | 全部 | 通過 |

⚠️ **沒有豁免項**。

## Phase 0：Outline & Research

✅ [research.md](./research.md)——三條基準線都是量出來的，而其中**兩條推翻了規格初稿**。

## Phase 1：Design & Contracts

✅ [data-model.md](./data-model.md)——`PanelSpec`／`PanelAction`／「一層可多份宣告」
✅ [contracts/panel-registry.md](./contracts/panel-registry.md)——核心可以問什麼、**不可以**問什麼、四種要出聲的情形
✅ [quickstart.md](./quickstart.md)——五段驗證，每一段對應一條 SC

## 實作順序（給 /speckit-tasks 的骨架）

```
① 登錄表 ＋ 契約的四條「要出聲」        先紅：一份宣告都沒有時要喊
② 四份既有面板改寫成宣告（行為不動）     SC-004 全程綠
③ app-shell 的五處「四個一起列」收成迴圈  SC-002
④ 四條頭收成一支產生器                  SC-003
⑤ probe 測試 ＋ 兩條護欄                SC-001／SC-005
```

🔴 **②③④ 之間每一步都要跑 `npm test` ＋ `npm run test:e2e`**——這一刀動的是
所有人都會經過的組裝點，而它壞掉的方式是**安靜的**（少一格、順序變了、
某個宿主少一層）。

## Complexity Tracking

無違規項需要記錄。
