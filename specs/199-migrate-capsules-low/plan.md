# Implementation Plan: 膠囊自證測換判準——第一批（重構 6c-2a）

**Branch**: `224-migrate-capsules-low` | **Spec**: [spec.md](spec.md)

## Summary

37 個膠囊自證測的執行斷言換成 spec 198 的共用入口。三種寫法各一個改法：
① `lift(code)` 後交給直譯器 → `expectCellaOut(code, 期望)`；② 手搭語義樹 → 改寫成最小的程式碼字串；
③ 斷言 JS 直譯器才有的行為 → 依 C++ 改期望值（附依據），或改斷言 Cella 的判決種類。

## Technical Context

TypeScript／Vitest；共用入口 `tests/helpers/cella-run.ts`；Cella 0.1.202611020258。不動 `src/`（只改測試）。

## Constitution Check

I 簡約：只改測試、不加機制 ✅ · II TDD：這是換判準，斷言先保留、跑一次看哪些不成立 ✅ · III 分批提交 ✅ · V 繁中 ✅

## 分工

37 個檔分三組並行改寫（彼此不同檔），每組回報：改了哪些條、哪些期望值變了與依據、哪些疑似 Cella 判錯。最後一次跑全部 37 個檔驗收。
