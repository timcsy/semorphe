# 實作計畫：元件身分的引用完備性

**Feature**: `101-component-id-integrity` ｜ **Spec**: [spec.md](spec.md) ｜ **Research**: [research.md](research.md)

## Summary

補上第二十一條護欄：**程式碼不得建出登錄表裡沒有的元件身分**。

實測今天有四筆，而其中一筆（`var_declare_expr`）是 **B 項兩天前留下的尾巴**——
身分合併了、存檔轉換寫了、全套綠，而**一條生產路徑沒有跟上**。

## Technical Context

| | |
|---|---|
| 語言／工具 | TypeScript 5.x、Vitest |
| 身分的建構入口 | `createNode(conceptId, props, children)`（`src/core/semantic-tree.ts`） |
| 登錄表 | 175 顆（`concepts.json` × N ＋ `universal-concepts.json`） |
| 推／拉通道範本 | `src/core/skip-declarations.ts`（語言套件推，核心讀） |
| 已知違反 | `var_declare_expr`／`cpp_priority_queue_declare`／`cpp_initializer_list`／`param_decl` |

**無 NEEDS CLARIFICATION**——`priority_queue` 的補齊／移除已由人拍板（補齊）。

## Constitution Check

| 原則 | 判定 | 說明 |
|---|---|---|
| **I. 簡約優先** | ✅ | 不建型別系統（branded type 已 re-route 掉）。一支護欄 ＋ 一個宣告登記處（抄既有形狀）＋ 四筆修正。 |
| **II. TDD（非妥協）** | ✅ | 護欄先蓋、必須紅、指名四筆，才動修正。 |
| **III. Git 紀律** | ✅ | 護欄／四筆修正／priority_queue 各一個 commit。 |
| **IV. 規格文件保護** | ✅ | 不動 specs/ 既有檔。 |
| **V. 繁體中文優先** | ✅ | |

## 實作順序（護欄先——與 100 同一條理由）

```
① 護欄：走流程掃樹（硬關卡）＋ 靜態掃 createNode（給行號）
      ↓  ← 必須紅，且指名那四筆
② 宣告登記處：降級／結構節點／哨兵，各自附理由
      ↓  ← 護欄的違規欄應降到剩「真的幽靈」
③ var_declare_expr → var_declare（B 項的尾巴）
      ↓
④ cpp_priority_queue_declare 五路補齊（execute 與 g++ 對答案）
      ↓
⑤ 護欄轉綠（硬性零）＋ 全套 ＋ 既有二十條複查
```

**① 先於 ③④ 是硬條件。** 先補的話那四筆會被順便修掉，而我們**不會知道護欄真的抓得到**。

## Complexity Tracking

| 複雜度 | 為什麼賺得起 | 更簡單的做法為何不夠 |
|---|---|---|
| **兩種量測（流程 ＋ 靜態）** | 流程可信但答不出「去哪修」；靜態給行號但會誤報 | 只留一種：只有流程 → 修的人要自己再掃一次；只有靜態 → 規劃階段那 27 筆假報就是下場 |
| **宣告登記處**（而非底線前綴） | `param_decl`／`raw_code` 都沒有底線而它們是非元件 | 前綴推斷會同時漏報與誤報，而且**默契不是規則** |

**明確不做的**：把五個非元件節點補成真元件。那是用宣告製造五個殼。

## 風險與已備的緩解

| 風險 | 緩解 | 誰會叫 |
|---|---|---|
| 靜態掃描把積木型別／AST 型別當身分 | 已知答案樣本先驗 | 護欄的自我驗證 |
| `priority_queue` 抄 `queue` 的執行器 | **`top()` 是最大值不是最先進來的** | 與 `g++` 對答案的執行測試 |
| 補齊 `priority_queue` 只做三路 | 五路逐路釘 | 完備性護欄 ＋ SC-004 |
| 宣告登記處變成「懶得處理」的出口 | 每筆必須附理由，且理由要能被讀 | `history/018` 的處方 |
| 護欄第一次就綠 | FR-009：必須紅且指名四筆 | — |

## Out of Scope

見 [spec.md](spec.md)。特別提醒：**branded type 不做**，理由不是成本，是它攔不到這四筆。
