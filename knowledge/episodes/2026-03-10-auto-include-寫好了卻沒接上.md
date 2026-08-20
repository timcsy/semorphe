# auto-include：每個零件都對，就是沒接上電

> 日期：2026-03-10

## 為何值得回憶

一個**所有單元測試都通過、功能完全無效**的案例。它暴露的不是某段程式碼的錯誤，而是單元測試的一個結構性盲區：**測試自己注入依賴，於是繞過了真實的接線路徑。**

## 現象

auto-include 系統的所有元件都寫好了：

- `ModuleRegistry`：concept → header 映射
- `computeAutoIncludes()`：掃描語義樹、查詢 registry、去重
- `createPopulatedRegistry()`：工廠函式，註冊所有 std 模組
- `GeneratorContext.moduleRegistry`：可選欄位

單元測試全綠。瀏覽器中打開，`#include` 一個都沒出現。

## 追下去看到什麼

**問題一：UI 層從來沒呼叫 `setModuleRegistry()`。**

`generateCodeWithMapping()` 建構 `GeneratorContext` 時 `moduleRegistry` 永遠是 `undefined`，於是 `if (ctx.moduleRegistry)` 這個守衛永遠不進去。測試之所以通過，是因為**測試手動注入了 registry**——測的是「有 registry 時邏輯正確」，而不是「registry 會被裝上」。

**問題二：`ModuleRegistry` 用錯欄位名。**

`ComponentDefJSON` 的欄位是 `componentId`，但 `register()` 寫成 `concept.id`。TypeScript 的 structural typing 沒報錯（`id` 在某些型別中是合法屬性），於是 registry **靜默地註冊了一堆 `undefined` 當 key**。

即使問題一修好了，問題二還會讓查詢全部落空——而且同樣不會有任何錯誤訊息。

**問題三：架構定位錯了。**

program generator 同時負責「產生程式碼」和「推導需要哪些 `#include`」，違反 P1 的投影管線分離。

## 權衡過什麼

前兩個問題是修錯字等級的，第三個才是決定。

當時的選擇是：**先接上，架構債記下但暫不還**。加入全域 `setModuleRegistry()` 並在 `app.ts` 初始化時呼叫，generator 中的 auto-include 邏輯暫留（功能正確），同時明確記下正確定位——DependencyResolver 是 Scope 3 索引建構器，不是 Scope 2 generator 的一部分。

這個判斷部分正確、部分沒有：抽離在同月由 [history/007](../history/007-依賴推導從-generator-抽離.md) 完成，但**沒有做徹底**。三個月後（2026-06）仍需要 `a3beb40`、`38c4110` 兩次修補，處理 scaffold 可見時與 blocks→code 方向的 auto-include 注入。半吊子的抽離讓同一個問題以不同面貌回來了兩次。

同時也認識到**全域 setter 模式本身有風險**：`setModuleRegistry` / `setTemplateGenerator` 這種隱式全域注入，呼叫順序和遺漏都無法被型別系統捕獲——這次事故的第一個問題就是這個模式的直接後果。

## 用了哪些概念

- [投影](../concepts/投影.md) — 結構性依賴宣告是跨 Scope 衍生投影
- [開放擴充](../concepts/開放擴充.md) — DependencyResolver 介面
- [降級與認知邊界](../concepts/降級與認知邊界.md) — structural typing 造成的靜默失敗

## 結果

教訓「功能完成 ≠ 功能接通」進 [experience.md](../experience.md)——單元測試手動注入依賴會繞過真實接線路徑，端到端驗證不可省。

## how（外部產物）

- commit：`212d280` "docs: add DependencyResolver/ProgramScaffold design, wire auto-include to UI"、`8217774` "feat: DependencyResolver + ProgramScaffold + code patcher + mapping refactor"
- 後續修補：`e519df1`（去重 C-style / C++-style 等價 header）、`a3beb40`、`38c4110`
- spec：`specs/020-dependency-scaffold/`
