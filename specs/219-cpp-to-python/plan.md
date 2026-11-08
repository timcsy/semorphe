# Implementation Plan: 跨語言互轉第二對——C++ → Python（第一版）

**Branch**: `362-cpp-to-python` | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/219-cpp-to-python/spec.md`

## Summary

使用者把目標從 C++ 換到 Python 時，C++ 的語意樹改寫成 Python 的語意樹（樹上的改寫，C++ 元件 → Python 元件），
判準是兩邊交給 Cella 判，判決、輸出、assumes 相同。今天切過去只會產出 `⟨unknown component: cpp:program⟩`（research R1）。
換法由**來源語言**（C++）的語言套件提供（新的可選介面 `convertToLanguage`），app 在換目標而語言變了時問它；
整支程式換或不換（R5），意思會變的構造保留並說出原因（R4）。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: 既有的語意樹、元件建構子（`src/components/python/*/lift.ts` 的 build 函式）、Cella（`@cella-lang/cpp`、`@cella-lang/python`）作判準
**Storage**: N/A（換寫法不改存檔格式）
**Testing**: Vitest；護欄 `tests/integration/cpp-to-python-verdict.test.ts`（Cella 兩邊判決比對）；換目標的 e2e 一支
**Target Platform**: 瀏覽器（網頁版）與 VSCode／Theia 的 webview（同一套 app）
**Project Type**: 網頁應用（純前端）
**Performance Goals**: 換寫法 ＋ 問型別在 3 秒內（SC-004；第一對實測在 1 秒內）
**Constraints**: 純前端；Cella 是唯一的判準；核心不認識任何一顆元件（身分只在語言套件與膠囊裡）
**Scale/Scope**: 第一刀約 25 種 C++ 元件（cpp-beginner 用到的前段，R3）

## Constitution Check

| 原則 | 檢查 | 結果 |
|---|---|---|
| I. 簡約優先 | 只接 cpp-beginner 量出來的子集；新介面只有一個可選方法，形狀沿用第一對的回傳 | ✅ |
| II. 測試驅動 | 先寫護欄（課文 66 支、反例 6 種）再寫換法；每一類構造先有紅的測試 | ✅ |
| III. Git 紀律 | worktree `semorphe-362`、合併前在合併後的狀態跑長測試 | ✅ |
| IV. 規格文件保護 | spec 由本流程產生、不改既有 spec | ✅ |
| V. 繁體中文優先 | 文件、提示、註解用繁體中文 | ✅ |

## Project Structure

### Documentation (this feature)

```text
specs/219-cpp-to-python/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/convert-to-language.md
└── tasks.md            # /speckit-tasks 產生
```

### Source Code (repository root)

```text
src/core/language-packs.ts                  # LanguagePack 多一個可選的 convertToLanguage（型別而已）
src/languages/cpp/cpp-to-python.ts          # 新：C++ 樹 → Python 樹的改寫（整支換或不換、保留原因）
src/languages/cpp/pack.ts                   # 掛上 convertToLanguage: (tree, 'python', types) → convertCppToPython
src/components/python/*/lift.ts             # 用既有的 build 函式建 Python 節點（缺的才補一個 build）
src/components/cpp/*/                        # 必要時補「認出形狀」的小工具（身分只寫在膠囊裡，同 357）
src/ui/app.ts                               # 換目標時語言變了 ⟹ 問來源語言的套件；寫回兩個投影、說結果
src/i18n/*/                                 # 提示文字（換了幾行、保留原因）
tests/integration/cpp-to-python-verdict.test.ts   # 護欄：課文 66 支 ＋ 反例
e2e/cpp-to-python.spec.ts                   # 換目標之後編輯器裡是 Python
```

**Structure Decision**: 換法放在 C++ 語言套件（來源語言懂自己的元件，R2）；核心只多一個介面型別；Python 側只被呼叫 build 函式。

## Complexity Tracking

無違反。
