# 013：從「分散的手寫 extractor」到「統一的 PatternExtractor」

> 日期：2026-03-16

## 轉移

- **舊**：積木→語義的提取分散在 `extractBlockInner()` 的 switch case 和各語言的 extractor 檔案中，每個複雜積木一段手寫邏輯。
- **新**：統一為 `PatternExtractor` strategies，並引入 `dynamicRules` 引擎讓 PatternExtractor 和 PatternRenderer 共用同一套動態欄位規則。BlocklyPanel 以 PatternExtractor 作為 fallback。

## 為什麼變

extract 是四路中唯一沒有被宣告式化的一條。lift 有 astPattern、render 有 renderMapping、generate 有 codeTemplate——只有 extract 仍然是一堆手寫 switch case。

後果是**契約只存在於開發者的記憶中**：extractor 用 `getFieldValue('VAR')` 讀一個積木上根本不存在的欄位，`getFieldValue` 對不存在的欄位只回傳 null 不報錯，於是靜默降級為預設值。這類 bug 在 `cin >> s` 事故中是第三層防線的失效原因。

統一為 strategy + dynamicRules 之後，欄位對應變成**可宣告、可比對**的資料——renderer 和 extractor 讀同一份規則，欄位名不同步這個問題類別在結構上被消除，而不是靠每次 review 抓。

這是 [009 手寫 lifter 遷移為宣告式](009-手寫-lifter-遷移為宣告式-pattern.md) 在 extract 這一路的對應動作，時隔五天。

## 狀態

✅ 已採用（spec `048-unify-extractor`；commit `b414924` MVP → `b6ee371` dynamicRules 引擎 → `af2f4e6` 統一 → `33ad4d7` merge）。

**尾巴**：`18c0a18` 需要為 PatternExtractor 的 children 重建 blockId→nodeId 映射；`fcec784` / `1224d0c` 在 `u_print` 的 inputPattern 命名（`EXPR{i}` vs `EXPR_{i}`）上來回改了兩次——動態欄位命名規則的邊界當時還沒完全穩定。
