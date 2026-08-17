# Implementation Plan：目標第二刀——讓它有第一個真消費者

**Branch**: `136-target-first-consumer` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)
**Input**: [research.md](./research.md)（**兩個假設在 research 階段就被推翻了**）

## Summary

把 `TargetRegistry`（上一刀交付、**零產品消費者**）接上工具列，
並補一份 C 專屬課程清單，讓「選一次而不是三次」真的兌現。
同時蓋第四十七條護欄，讓「機制有了沒人接上」**下一次會自己出聲**。

## Technical Context

**Language**: TypeScript 5.x
**Primary Dependencies**: Blockly 12.4.1、Vite 7.x、Vitest、Playwright
**Storage**: localStorage（`semorphe-state`）
**Testing**: `npm test`（4201 綠）＋ `npx playwright test`
**Target Platform**: 瀏覽器
**Project Type**: 單一前端專案
**Performance Goals**: 無新增（切換目標的成本 = 今天切換課程清單 ＋ 切換風格）
**Constraints**: 中立性護欄 `total: 0`；既有 46 條護欄基線一個數字不動
**Scale/Scope**: 189 顆元件、11 個登錄表、2 → 3 筆目標資料

## Constitution Check

| 憲章條目 | 本功能 | 判定 |
|---|---|---|
| 根公理（唯一真實，各式投影） | 目標只換投影，不換語義樹 | 🟢 |
| P3 開放擴充 | 第三筆目標＝加一個 JSON，不改既有程式碼 | 🟢 |
| P4 漸進揭露 | C 課程清單是**過濾**不是簡化——語義樹仍完整 | 🟢 |
| P8 不做向後相容 | ⚠️ 存檔遷移**不在**豁免範圍（`history/026`）→ FR-009 | 🟡 已處理 |
| P9 語言中立 | 目標資料**注入**不 import（`target-registry.ts:5-8`） | 🟢 |
| 執行機構 | 🔴 本功能**就是**在清償這一條，並補上它缺的護欄 | 🟢 |

**Gate 結果**：通過，無未辯護的違規。

---

## 設計決定（全部來自 research，不是這裡新想的）

### D1 目標下拉**取代**課程清單下拉（research Q4 方案 A）

```
之前   [課程清單 ▾][🌳]  [風格 ▾]  [積木外觀 ▾]  [語言 ▾]     選 3 次
之後   [目標   ▾][🌳]  [風格 ▾]  [積木外觀 ▾]  [語言 ▾]     選 1 次
        ↑ 同一個 widget，下拉的內容從課程清單換成目標；🌳 分支開關職責不變
```

🔴 **風格選擇器留著**——否則 `google`／`competitive` 拿不到（違反第十九條護欄）。

### D2 三筆目標資料（第三筆是為了不讓 `cpp-competitive` 消失）

```
cpp             topic: cpp-beginner     style: apcs
c               topic: c-beginner       style: c          ← topic 改指新的
cpp-competitive topic: cpp-competitive  style: competitive ← 新增，防功能倒退
```

### D3 C 課程清單用**推導**產生，不手抄（research Q2）

判準：`requires` 到 C 沒有的標頭 **∧** 沒有 `ioRole` 等價邊 → 排除。**59 顆**。
⚠️ 產物是一份 JSON（要進版控、要人看得懂），
而**產生它的腳本與判準要留在測試裡**，否則 `cpp-beginner` 一改它就漂移。
→ 用一支測試斷言「這份 JSON == 由判準推出來的集合」，**漂移當場紅**。

### D4 護欄錨點（research Q1）

```
★ 入口條件   掃到的 *registry*.ts 檔數 ≥ 8      ← 合成量，不隨修復變小
★ 硬性零     src 內 import 數為 0 的登錄表 = 0
★ 注入①     假造一個零消費者的登錄表 → 必須被指名
★ 注入②     全部有消費者 → 不得亂報
```

⚠️ **不可**斷言「零消費者的登錄表數 > 0」——那正是要推向零的東西
（`build-guardrail` 簽名一）。

---

## Phase 0：先讓護欄變紅（🔴 順序不可調換）

`build-guardrail` 6.5 逐字：「先跑、確認紅、**逐項指名**、修好，**最後才產基線**」。

1. 寫第四十七條護欄
2. 跑它 → **必須紅**，且報表**指名 `target-registry.ts`**
3. **不產基線**（硬性零沒有基線檔）

**若第一次是綠的** → 判準寫錯或掃描沒吃到檔案，停下來查，**不要往下走**。

## Phase 1：接上 + C 課程清單

4. `targets/cpp-competitive.json`（第三筆）
5. `topics/c-beginner.json`（推導產生）＋ 一支「不得漂移」的測試
6. `targets/c.json` 的 `topic` 改指 `c-beginner`
7. `app.ts`：註冊三筆目標；`TopicSelector` 的下拉改列目標
8. 選目標 → 同時走今天的 `onTopicChange` ＋ `onStyleChange` 兩條路
9. 存檔加 `targetId`，還原時優先讀它、回退到 `topicId`

## Phase 2：驗

10. 第四十七條護欄 → **綠**
11. `npm test` 全綠、46 條基線不動、中立性 `total: 0`
12. e2e：⚠️ **先展開全部層級**（research Q3——不展開的話那個 0 什麼都沒證明）
13. 🔴 **開瀏覽器實測**（`experience`「重構後開瀏覽器實測」）

## Phase 3：反流

14. 坑逐條記進 `findings.md`，含「因為知道答案而跳過的」
15. knowie：`history/` 轉變 ＋ `experience` 教訓 ＋ vision 收成

---

## 風險

| 風險 | 出處 | 對策 |
|---|---|---|
| 🔴 e2e 在預設狀態下**空過** | research Q3 | 步驟 12 的入口條件 |
| 🔴 排除清單誤殺（`print` 那族） | research Q2 | 判準用合取；人工複核 3 顆 |
| 兩條產出路徑 | `history/072`§三 | 步驟 13 |
| `cpp-competitive` 消失 | research Q4 | D2 第三筆 |
| C 課程清單與 `cpp-beginner` 漂移 | 雙重真相來源 | D3 的漂移測試 |
| 護欄第一次就綠 | `build-guardrail` 6.5 | Phase 0 步驟 2 是**閘門** |

## Complexity Tracking

無憲章違規需要辯護。
⚠️ 唯一接近的是「加了第三筆目標資料」——而那是**資料**不是機制，
且它的存在理由是**防止功能倒退**，不是新功能。
