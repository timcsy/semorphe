# Implementation Plan: 把核心從 `localStorage` 上拔下來

**Branch**: `173-file-store-port` | **Date**: 2026-09-06 | **Spec**: [spec.md](spec.md)

## Summary

核心有 9 處直接呼叫 `localStorage`。宣告一個**鍵值存放的埠**，
做兩個實作（記憶體／瀏覽器本地），讓 `StorageService` 與進度那一支吃它，
並加一條護欄擋回頭路。

```
src/core/host/key-value-store.ts    埠 ＋ 記憶體實作（核心，不碰任何宿主 API）
src/ui/browser-store.ts             瀏覽器本地實作（UI 層——它才知道 localStorage）
src/core/storage.ts                 建構子多一格，預設值由【呼叫端】給
src/core/progress.ts                同上
tests/integration/audit-core-no-storage.test.ts   第一百零七條護欄
```

🔴 **實作住在 UI 層，不是 core**——`localStorage` 是宿主的東西，
而核心的職責是**宣告它要什麼**，不是知道誰有。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: 無新增
**Testing**: Vitest（單元 ＋ 護欄）· Playwright（既有 e2e 當回歸）
**Target Platform**: 網頁版 ＋ VSCode／Theia（⚠️ 後者**不實作**這個埠）
**Constraints**: 🔴 **零行為變化**——既有的存檔測試與 e2e 一條不改而全綠
**Scale/Scope**: 2 個新檔 · 2 個檔改建構子 · 1 條護欄

## Constitution Check

| 條款 | 判定 | 依據 |
|---|---|---|
| **I. 簡約優先** | 🟢 過 | 埠上只有三個操作（讀／寫／刪），**「列」刻意不做**（零消費者）。不預留路徑樹 |
| **II. TDD（非妥協）** | 🟢 過 | 護欄先寫，它**當場紅在 9 個真的位置上**；記憶體實作的單元測試先寫 |
| **III. Git 紀律** | 🟢 過 | 兩段：① 護欄＋埠＋實作（紅→綠）② 收尾（vision／history／基線） |
| **IV. 規格文件保護** | 🟢 過 | 「列」不做是 spec 裡就寫下的決定，不是實作時放棄的 |

🔴 **最大的風險不是技術，是範圍**：這一刀很容易滑進「順便把 side-car
檔案化」或「順便做多檔案」。Out of Scope 有五條，而它們是**這一刀能收尾的原因**。

## 實作順序（TDD）

### ① 先紅
1. 護欄 `audit-core-no-storage`：掃 `src/core/`，出現
   `localStorage`／`sessionStorage`／`indexedDB`／`node:fs` → 報檔名 ＋ 行號。
   🔴 **跑它必須紅在 9 個真的位置上**——綠就是掃描路徑寫錯了
2. 同檔加入口條件（掃到的檔案數 ≥ 1）與注入測試（第四十九條）
3. 記憶體實作的單元測試：存／讀／刪／換實例是空的

### ② 再綠
4. `core/host/key-value-store.ts`：埠 ＋ `MemoryKeyValueStore`
5. `ui/browser-store.ts`：`BrowserKeyValueStore`（唯一碰 `localStorage` 的地方）
6. `core/storage.ts`：建構子多收一個 store；**內部 9 處改叫它**
7. `core/progress.ts`：同上
8. 🔴 **接上產品路徑**——組裝點（`app.ts`／`app-shell.ts`）把瀏覽器實作傳進去。
   ⚠️ 沒有這一步，這一刀就是「機制有了沒人接」

### ③ 收尾
9. `npm test` 全綠 ＋ e2e 全綠（**一條不改**）
10. 基線上調 · vision 打勾 · `history/` 一筆轉變

## 風險與緩解

| 風險 | 緩解 |
|---|---|
| 🔴 **靜默丟資料**（存檔路徑改壞而測試沒發現） | 既有的 `storage-integrity` 護欄與存檔測試**一條不改**——它們是這一刀的回歸網 |
| ⚠️ 拒絕存檔時的**備份**也走 storage | 那一條路一起搬，否則「核心不碰 storage」只做到一半（spec 的 Edge Case 有列） |
| ⚠️ 兩把鑰匙（`semorphe-state`／`semorphe-progress`）共用一個埠 | 埠是**鍵值**的，本來就不假設只有一份 |
| ⚠️ 預設值寫在核心裡 → 又綁死一次 | 🔴 **預設值由呼叫端給**，核心的建構子參數**沒有預設**——那樣「誰決定用哪個實作」就編譯期看得見 |

## 設計後複查

| 條款 | 判定 | 說明 |
|---|---|---|
| I | 🟢 | 三個操作，零預留 |
| II | 🟢 | 護欄的先紅**不是合成的**——它紅在 9 個真的位置上 |
| III | 🟢 | 兩段 commit |
| IV | 🟢 | 沒有改動任何 FR／SC |

⚠️ **一個沒有被設計解掉的**：`ui/browser-store.ts` 仍然可能在
沒有 `localStorage` 的環境拋錯。它的處置是**回退到記憶體實作**
——那讓「沒有 storage」變成「記不住」而不是「崩掉」（spec 的 US2）。
