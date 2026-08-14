# Implementation Plan: 學生看到的是代號，不是句子

**Branch**: `126-runtime-message-and-lesson-2` | **Date**: 2026-08-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/126-runtime-message-and-lesson-2/spec.md`

## Summary

執行期停下來時，畫面上出現的是 `RUNTIME_ERR_UNDECLARED_VAR: {"%1":"Cout"}`。
修顯示端查表、補缺的文案、補缺的參數，用**一條錨在顯示邊界的護欄**釘住，
再寫**第二課**當它的消費者——而那一課的教學主軸**就是那則錯誤訊息**。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Blockly 12.4.1、web-tree-sitter 0.26.6、Monaco、Vite、Vitest、Playwright
**Storage**: N/A（文案是靜態 JSON；一課是一個資料夾）
**Testing**: Vitest（單元／護欄）＋ Playwright（走查）
**Target Platform**: 瀏覽器
**Project Type**: Single project
**Performance Goals**: N/A
**Constraints**: 既有 43 條護欄基線**一個數字都不動**；既有測試全綠（4161）
**Scale/Scope**: 72 個拋出點／10 個停止原因身分／3 個顯示點／1 課

## Constitution Check

| 原則 | 本功能 |
|---|---|
| I. 簡約優先 | ✅ 不新增抽象層——查表函式**擴充**成吃兩套佔位符，不另開函式（研究決策 1） |
| II. TDD（非妥協） | ✅ 護欄**先跑必須紅**（SC-003）；走查測試**先注入驗過**再定案 |
| III. Git 紀律 | ✅ 分支已開；⚠️ **先 commit 再注入**（`history/064`§六 的教訓） |
| IV. 規格文件保護 | ✅ spec 三輪驗證通過；本 plan 不改 spec |
| V. 繁體中文優先 | ✅ 文案、課文、失敗訊息全繁體 |

**Gate**: 🟢 通過，無需 Complexity Tracking。

## Project Structure

### Documentation (this feature)

```
specs/126-runtime-message-and-lesson-2/
├── spec.md
├── plan.md              # 本檔
├── research.md          # ✅ 五個決策 ＋ 三種缺陷的實測
├── tasks.md             # /speckit-tasks 產生
└── findings.md          # 🔴 走第二課撞到的坑——US3 真正的產出
```

### Source Code (repository root)

```
src/
├── i18n/
│   ├── messages.ts              # 查表函式 → 吃兩套佔位符
│   ├── zh-TW/blocks.json        # 補 3 則缺的文案
│   └── en/blocks.json           # 同上
├── interpreter/
│   └── （32 個 TYPE_MISMATCH 拋出點 → 補第二個參數）
└── ui/
    └── execution-controller.ts  # 3 處顯示端 → 查表

tests/
├── integration/
│   └── audit-runtime-message.test.ts   # 🆕 第四十四條護欄
└── probes/
    └── （兩個 __ 開頭的暫時檔 → 升格或刪除，FR-013）

lessons/02-記住一個數字/           # 🆕 一課 ＝ 一個資料夾
├── lesson.md
└── goal.txt

e2e/lesson-02.spec.ts               # 🆕 第二支走查
```

## Phase 0：Research

✅ 完成 → [research.md](research.md)。五個決策，其中兩個推翻了原本的設想：

- 🔴 **缺陷有三種不是一種**（不查表／三個身分沒文案／文案要兩參數只傳一個）
- 🔴 **護欄的單位是 (身分, 參數) 組合，不是原始碼行**——誤報靠**選對單位**消除

## Phase 1：Design

### 資料模型

沒有新實體。三個既有的東西改變了**契約**：

| 東西 | 之前 | 之後 |
|---|---|---|
| 停止原因 | 有一個「湊給人看」的字串欄位 | 🔴 **那個欄位只給開發者**；給使用者的一律走查表 |
| 查表函式 | 只認具名佔位符 | 認具名 ＋ 位置兩套；⚠️ **新文案一律用具名的** |
| 文案表 | 3 個身分沒有文案 | 全部有；查不到時仍退回一句通用的話 |

### 契約（本功能對外的兩個承諾）

1. **顯示契約**：任何交給使用者眼睛的執行期停止訊息，
   MUST 通過「不含 `RUNTIME_ERR_`／`%N`／`{name}`／JSON 大括號」的檢查。
2. **一課的契約**（沿用第一課，不擴充）：
   `lessons/<序號>-<課名>/{lesson.md, goal.txt}`，
   加它 MUST NOT 動任何既有共用檔。

### 🔴 護欄的設計（US2 的主體）

```
單位      一個 (停止原因身分, 拋出點實際傳的參數) 組合
輸入      從原始碼掃出 72 個拋出點 → 抽出 (身分, 參數) 對
處置      走一次【顯示路徑】→ 斷言結果是自然語句
硬性零    留一筆「顯示代號」，「系統說的話是人話」就是假的
入口條件  掃到的拋出點數 ≥ 60（今天 72）——⚠️ 不隨修復下降
```

**兩個方向的注入**（`build-guardrail` 第 9 步）：

| 注入 | 證明 |
|---|---|
| 一個**合成**身分，沒有文案 | **會報**，且指名是哪一個身分 |
| 一個**合成**身分，文案與參數對得上 | **不亂報** |

⚠️ **注入用合成身分，不用 `RUNTIME_ERR_UNDECLARED_VAR`**
——`build-guardrail` 簽名三：注入裡出現真實身分，
**那個缺陷被修好的那天測試會爛掉**。

### 第二課的設計

```
教三個   變數（給值一個名字）／指定（含用自己算自己）／印出一個會變的東西
不教     main、印出、文字（第一課的，當背景）
成品     int score = 90; score = score + 5; cout << "分數是 " << score << endl;
期望輸出 分數是 95
```

🔴 **而課文中間刻意讓學生打錯變數名**（`Score`）→ 系統說
「變數 'Score' 尚未宣告」→ **用那句話解釋「宣告」是什麼意思**。

⚠️ **課文必須避開「未宣告就指定」**（`score = 90;` 沒有 `int`）
——研究實測它**會跑完並輸出 90**，而 C++ 拒絕它。
**教到它會教出「C++ 可以不宣告」的錯誤觀念**，而那條缺陷寫進 `findings.md`。

## 實作順序（依賴決定，不是優先序）

```
① 護欄先蓋，確認【紅】，逐項指名        ← build-guardrail 6.5：護欄先蓋，功能後做
② 補 3 則文案 ＋ 補 TYPE_MISMATCH 的參數
③ 顯示端查表（3 處）
④ 護欄轉綠 → 產基線（硬性零）
⑤ 第二課（課文引用的訊息從【系統實際輸出】取）
⑥ 走查測試 ＋ 注入驗證
⑦ findings.md ＋ 暫時探針檔的歸屬（FR-013）
```

⚠️ **①在②之前不可換**——`build-guardrail` 6.5 逐字：
「護欄先蓋，功能後做……**一個被順便修掉的缺陷不會留下任何紀錄**」。

⚠️ **⑤在③之後不可換**——課文要引用真實訊息，而③之前的訊息是代號。

## 風險（承 research，只列 plan 新增的）

| 風險 | 對策 |
|---|---|
| 🔴 補文案動到第四十二條護欄的基線 | ②之後**立刻**跑那條，⚠️ 它掃的是 `DIAG_*` 不是 `RUNTIME_ERR_*`，預期不動——**而預期要驗** |
| 32 個 TYPE_MISMATCH 拋出點改起來很碎 | ⚠️ 先確認**文案要兩個參數**是不是對的——也可能該把文案改成一個參數，**那更便宜且不改行為** |
| 走查測試在無頭瀏覽器跑不動第二課 | 沿用 `e2e/lesson-01.spec.ts` 的做法，已驗證可行 |
| 第二支走查等於「每加一課手寫一支」 | ⚠️ FR-011 要求寫下答案——**在⑥做完當下就記，不要事後補** |

## Complexity Tracking

無違規，本節留空。
