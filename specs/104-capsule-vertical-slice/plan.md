# Implementation Plan: F 膠囊搬家——第一顆垂直切片

**Branch**: `104-capsule-vertical-slice` | **Date**: 2026-08-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/104-capsule-vertical-slice/spec.md`

## Summary

把 `cpp:vector_declare` 從 8 個落點搬進 `src/components/cpp/vector_declare/`，
行為零改變，並蓋一條**雙向**的膠囊護欄（含今天沒有任何護欄看得到的標籤那一維）。
產出是一份**成本與卡點紀錄**，用來乘出剩餘 176 顆的範圍、並決定
`component-encapsulate` skill 要收哪些步驟。

**最大的技術決定**（見 [research.md](research.md) R1）：`lift` 那一路不是可搬的函式，
是七顆容器共用的判別式裡的一列 → **共用函式塌成路由器，映射資料由膠囊登錄**。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Blockly 12.4.1、web-tree-sitter 0.26.6、Vite（皆不新增）
**Storage**: 不動（搬家 ≠ 改名 ⇒ 存檔版本維持 v9）
**Testing**: Vitest（235 檔／3700 tests，每一步必須綠）
**Target Platform**: 瀏覽器 ＋ Node（測試）
**Project Type**: 單一專案
**Performance Goals**: 無新要求
**Constraints**:
- 搬移不重寫（089 純機械改名 560 處出錯三次，全靠測試抓到）
- 每一步是一個可獨立 `git revert` 的單位
- 未搬的 176 顆不得受影響
**Scale/Scope**: 本切片 1 顆；量出的數字用來估剩餘 176 顆

## Constitution Check

| 條 | 檢查 | 結果 |
|---|---|---|
| **I 簡約優先** | 有沒有為假設性未來預留擴充？ | ⚠️ **有一處**：`component.json` 的 `requires` 槽。但它**當前就有兩個消費者**（`#include` 依賴解析、工具箱 owner 章），不是預留 → 通過。**明確不做**的：`attachments`／`relation`（C2 資訊軸，今天零消費者）、共同測 harness（一顆推不出價值） |
| **II TDD** | 測試先於實作？ | ✅ 護欄先蓋且**第一次必須紅**（FR-013）；搬家前先錄基準（US1 場景 1） |
| **III Git 紀律** | 每個邏輯步驟 commit？ | ✅ 每一顆／每一路一個 commit，皆可獨立還原 |

**無違規需要記錄。**

## Project Structure

### Documentation (this feature)

```
specs/104-capsule-vertical-slice/
├── spec.md
├── plan.md              ← 本檔
├── research.md          ← 五個未知的查證與決定
├── data-model.md        ← 膠囊的宣告格式
├── quickstart.md        ← 怎麼驗這一顆真的搬對了
├── contracts/
│   └── capsule.md       ← 膠囊對系統的介面契約
├── slice-record.md      ← ⬅ 本切片的主產出（成本、卡點、範圍估計）
└── checklists/requirements.md
```

### Source Code (repository root)

```
src/
├── components/                          ← 新增
│   └── cpp/
│       └── vector_declare/
│           ├── component.json           身分／參數／接點／requires（＝規格）
│           ├── forms/blocks.json         積木形態
│           ├── generate.ts               產生那一路
│           ├── execute.ts                執行那一路
│           ├── lift.ts                   lift 那一路（登錄樣板名映射）
│           ├── labels/zh-TW.json         標籤（一個語言一個檔）
│           ├── labels/en.json
│           └── spec.test.ts              自證測（強制正負兩向）
│
├── core/capsule/                        ← 新增（膠囊的載入與登錄機制）
│   ├── registry.ts                      掃描並登錄膠囊，記錄「註冊來源」
│   └── labels.ts                        合併各膠囊的標籤（鍵撞了要爆）
│
├── languages/cpp/
│   ├── std/vector/{concepts,blocks}.json   4 顆 → 3 顆
│   ├── std/index.ts                        模組陣列少一筆
│   └── core/lifters/strategies.ts          容器映射硬編 → 讀登錄表
│
└── i18n/{zh-TW,en}/blocks.json            移除該顆的 8 筆／檔

tests/
├── integration/
│   ├── audit-capsule-locality.test.ts     ⬅ 新護欄（雙向，FR-010/011/012）
│   └── capsule-move-parity.test.ts        ⬅ 兩條防線（FR-007/008/009）
└── baselines/capsule-locality.json        ⬅ 第一次跑必須紅，逐項指名後才產
```

**Structure Decision**：膠囊放 `src/components/<scope>/<name>/`，與 `src/languages/`
**平行**而不是巢狀。理由：scope 是所有權不是位置（膠囊契約 §一），
放進 `languages/cpp/` 底下會讓「第三方 `@someone:` 套件住哪」沒有答案。
⚠️ 這是 spec 標記為**未拍板的假設**——若人否決，改的是路徑常數一處。

## 執行順序（每一步都是可還原的單位）

> **順序的硬理由**：護欄先於搬家。膠囊契約 §七與 `build-guardrail` 6.5 同一條——
> 搬家會「順便」修掉違規，而**被順便修掉的缺陷不留紀錄**。

| # | 步驟 | 結束時的狀態 |
|---|---|---|
| **0** | 錄搬家前基準（五路輸出、來回轉換、標籤字串、conceptId 集合） | 基準檔存在，全綠 |
| **1** | 蓋膠囊護欄（雙向 ＋ 標籤維度），**第一次跑必須紅**，逐項指名 | 紅，且違規已逐項列出 |
| **2** | 蓋兩條防線（漏失／錯置）＋ 各自的「抓不到什麼」聲明 | 綠（此時無膠囊，防線是恆等的） |
| **3** | 建 `core/capsule/`（登錄機制 ＋ 標籤合併），零膠囊時是 no-op | 全綠 |
| **4** | 搬**宣告**：`component.json` ＋ `forms/blocks.json`；`std/vector` 4 → 3 | 全綠，防線一綠 |
| **5** | 搬**標籤**：`labels/{zh-TW,en}.json`；i18n 共用檔各刪 8 筆 | 全綠，UI 標籤逐字相同 |
| **6** | 搬 **generate**／**execute** | 全綠，防線二指出來源是膠囊 |
| **7** | 搬 **lift**：`strategies.ts` 的容器映射塌成路由器 | 全綠，7 顆容器行為不變 |
| **8** | 寫 `spec.test.ts` 自證測（正負兩向 ＋ 證明真的碰到這顆） | 全綠 |
| **9** | 護欄收數字：該顆「自己資料夾外」8 → 0，產基線 | 綠 |
| **10** | 寫 `slice-record.md`：成本、卡點、形狀分類、範圍估計 | 交付 |

**若任一步變紅：整步 `git revert`，改工具再來**（`component-rename` 步驟 4 的同一條紀律
——在紅的狀態上手動補，那些補丁會混進下一輪的量測）。

## Complexity Tracking

| 新增的複雜度 | 當前需求 | 不加會怎樣 |
|---|---|---|
| `core/capsule/registry.ts` | 膠囊要能被載入，且要記錄註冊來源 | 防線二（抓錯置）沒有地基 |
| `core/capsule/labels.ts` | 標籤要能從膠囊合回 loader 的扁平字典 | 標籤那一維搬不出去，FR-012 達不到 |
| `component.json` 的 `requires` | `#include` 依賴解析 ＋ 工具箱 owner 章，**當前兩個消費者** | 產生的碼少 `#include <vector>`；工具箱分類錯 |
| `strategies.ts` 塌成路由器 | lift 那一路搬不出去（R1） | SC-001 達不到 |

**明確不加**：`attachments`／`relation`（C2，零消費者）、共同測 harness（一顆推不出價值）、
`std/index.ts` 改成掃描膠囊（會讓成本數字混進架構改動）。
