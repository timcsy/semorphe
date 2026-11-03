# Implementation Plan: 刪掉 JS 直譯器（重構 6c-4）

**Branch**: `246-delete-interpreter` | **Date**: 2026-11-03 | **Spec**: [spec.md](spec.md)

## Summary

分五段提交，每段都要能單獨綠：**搬**（非執行的模組離開直譯器那一側）→ **改格式**（宣告不再有 `execute` 這一格）→ **刪**（直譯器與 327 個 execute.ts）→ **測試**（54 支逐支判、補 Cella 背書、護欄改寫）→ **文件**（元件 skill 與範本的「五路」）。

## Technical Context

**Language/Version**: TypeScript 5.x　**Testing**: Vitest（全套 ＋ `test:guard`）、Playwright（e2e）
**Project Type**: 單一網頁應用 ＋ VSCode 擴充（兩個宿主共用 `src/`）
**Constraints**: 刪除前後，lift／generate 的產出一字不差；課文判決與 StudyCpp 判決逐支相同
**Scale**: 約 370 個產品檔、351 份 component.json、54 個測試檔

## Constitution Check

- **P6 誠實降級**：刪掉直譯器之後沒有退路，這一點 6c-3 已經做完；這一刀不新增任何降級路徑。✅
- **一份真相**：執行語義只剩 Cella。✅
- **P8 不做向後相容**：component.json 的 `execute` 格直接拿掉，不留相容讀法；存檔格式不受影響（存的是語意樹，不含執行狀態）。✅

## 分段

### 段 1 · 搬出非執行的模組（行為不變）

| 從 | 到 | 使用者 |
|---|---|---|
| `languages/cpp/lang/runtime/range-lift.ts` | `languages/cpp/range-ends.ts` | range_* 的 lift／generate（約 20 顆） |
| `languages/cpp/lang/runtime/device-names.ts` | `languages/cpp/device-names.ts` | pin_attach 的 lift |
| `languages/cpp/lang/runtime/printf.ts` 的 `extractPrintf`／`extractScanf` | `languages/cpp/lifters/printf-format.ts` | `lifters/io.ts` |
| `components/cpp/pin_constant/execute.ts` 的 `PIN_CONSTANTS` | `components/cpp/pin_constant/constants.ts` | 測試、formalize（若有） |

搬之前以 **import 圖** 確認每支的使用者（教訓：`args` 與 `call-args` 撞名）。驗收：tsc、`test:unit`、`test:capsule`、`declaration-shapes-roundtrip`。

### 段 2 · 宣告不再有 `execute` 這一格

- `core/component/views.ts`：路徑格拿掉 `execute`（不再要求、出現就報錯——避免殘留）；`judges.ts` 的 `JUDGED_CELLS`、`types.ts` 的 `PathName`、`paths.ts` 的 `EXECUTE` glob 一起改。
- 351 份 component.json：用一支一次性的腳本拿掉 `paths.execute` 與 `_execute_why`（腳本不進 repo；改動量大，用 JSON 讀寫，不用文字替換）。
- 護欄裡寫死「五路」的那幾支改量新定義（lift／render／extract／generate ＋ formalize）；每支保留或補一條注入測試。
- 基線：每份動到的基線在 note 寫「6c-4：execute 那一路退場」。

### 段 3 · 刪

`src/interpreter/`、`components/**/execute.ts`、`languages/cpp/lang/executors/`、`languages/cpp/lang/runtime/`、`providers/js-interpreter/`、只給執行用的輔助檔（見 spec 輸入）、`generators/index.ts` 的 `registerCoreExecutors`。
新增護欄：`src` 與 `tests` 裡零個 import 指向已刪的路徑（取代 `audit-cella-only` 裡較窄的那一條，或併入它）。

### 段 4 · 測試

- 54 支逐支判（分類表見 [research.md](research.md)）：D 刪（寫接手者）／C 改 Cella／M 改 import／E 參照編譯器族。
- **E 類**：拿直譯器對照參照編譯器的那幾支，在直譯器刪掉之後已經無法成立——這一刀刪掉，CLAUDE.md 的 🪦 段落改寫留給 6c-5（那一刀處理參照編譯器本身與文件）。
- 風險 3：四種 OOP／閉包語義（解構反序、lambda 捕捉、方法呼叫方法、虛擬分派），沒有 Cella 接手者的，先補程式碼字串版的測試，再刪原本的手搭樹。
- 風險 5：第四十四條護欄改掃 Cella 的錯誤鏈（`RUNTIME_ERR_*` 與 `CELLA_*` 的 kind→文案），入口條件「掃到 > 0」，加注入測試。
- `audit-tests-import-reachable` 的兩筆 ALLOWED 拿掉。

### 段 5 · 文件與 skill

元件 skill（component-generate／integrate／refactor／pipeline 等）與範本裡的「五路」「execute」改成新定義；CLAUDE.md 只動「五路」的定義，🪦 段落留給 6c-5。

## 驗收（合併前）

1. 刪之前量：全套時間、vsix 大小（取 main 這一輪長測試的數字）。
2. 刪之後：全套、整輪 e2e、vsix（大小對照）、課文判決綁定語料、StudyCpp 判決探針逐支對照。
3. 合併後看 CI。

## 風險

| 風險 | 處置 |
|---|---|
| 搬檔時漏掉一個使用者 | 以 tsc 為準（漏了就編不過），不以 grep 檔名 |
| 宣告格式改了而某支護欄仍讀 `execute` → 掃描數為零而空轉 | 每支護欄都有入口條件斷言；改完跑 `test:guard` 並看每支的掃描數 |
| 測試刪多了，某個語義變成沒人守 | 每支被刪的檔寫一行接手者（SC-005） |
| 一次改太多，紅了不知道是哪一段 | 五段分開提交，每段跑對應的測試再往下 |
