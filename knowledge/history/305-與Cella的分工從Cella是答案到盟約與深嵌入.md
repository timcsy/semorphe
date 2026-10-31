# 305 · 與 Cella 的分工：從「Cella 是答案」到盟約與深嵌入

> 日期：2026-10-13～2026-10-20（使用者在 cella 那側逐次定、在這側確認）
> 轉變：[304](304-網頁版的執行器從可插拔的位置到一律是Cella.md) 定了「網頁版的執行一律用 Cella」之後，
> 分工又往前走了三步，而每一步都改掉 semorphe 這一側的一個前提。
> 現場與逐條內容在 [draft/第六路的控制流](../draft/2026-10-06-第六路的控制流——對-cella-提的需求.md) 四之九～四之十三；
> Cella 那側的對應是它的 history 477、533。

## 三步

```
10-13  分工重定「Cella 是答案」        semorphe 只對 Cella 驗；diff-translation 撤下；從 Cella 產 C／C++ 撤下
10-14  Cella 語言套件改走深嵌入        formalize 從「每顆元件寫一份翻譯（contract.cella）」
                                        變成「語義樹 → 語法資料值的結構對應」；不再投資淺嵌入
10-20  盟約                             措辭改成「形式的問題 Cella 是答案，呈現與編輯的問題 semorphe 是答案」；
                                        Cella 觀測（剖析器）、semorphe 行動（執行器，照 DAP、宣告能力）；
                                        八條約定，第 8 條「修復而非解約」；不升成原則
```

**盟約的八條**（逐字照 Cella 的 history 533；semorphe 這側只引用、不另立版本——條文由兩邊共同維護）：

1. 共通語言：Cella 的套件是 Published Language，兩邊精確釘版加 merkle。
2. 翻譯的義務：semorphe 的 formalize（Anti-Corruption Layer）翻成 Cella 的項，帶節點標籤；`raw_code` 不送。
3. 判決綁定：翻譯驗證是判定者；`assumes` 帶兩邊的引擎雜湊；等級由 Cella 算出，任何一方不手寫。
4. 行動插槽：照 DAP；致動器宣告能力（粒度 `statement`／`node`、`setInput` 與 `setVariable` 分開、給不給步數）；一步 = 進入帶標籤的節點一次，由 Cella 的語意決定。
5. 觀測插槽：感測器（剖析器是文字的感測器）的輸出帶來源，受綁定檢查。
6. 變更程序：新構造先溝通；牽涉使用者定案的，兩邊都先不改。
7. 法律：ISO C++17（clang 加 libc++ 代表）；硬體是物理（模擬器、實機代表）。
8. 修復而非解約：一方失約（formalize 翻錯、引擎變了、執行器少了某項能力）時，判決降級（Unknown、證書過期）並標出哪一環斷了，修好再驗；不切斷整合。

同一天（10-20）在這側定的兩件，改的是**元件的形狀**：

- **形態一律 render／lift，每個視圖一對**：`generate`／`extract` 退場。理由（使用者）：未來有程式以外的領域，
  名字綁在「程式碼」「Blockly」上會逼新領域動結構。也順帶解掉與 Cella 的 `generate` 撞名。
- **`execute` 拆兩件**：語意併進 `formalize`（執行的語意在 Cella），驅動移到應用層的執行器；
  與拆 JS 直譯器同一天拆。

## 被否決的

- **「從 Cella 產生 C／C++」的撤下**（10-13）在 10-20 被取代：使用者把它加回路線圖，「當時撤回是因為淺嵌入……
  現在改成深嵌入而且又有 generate，所以可以加回來」。
- **generate 改一個新名字**（unparse／unlift／lower／print 的候選表）：我沒先和使用者討論就送出「推薦 unparse」，撤回；
  之後使用者自己提出「所有東西都是 render 與 lift」，候選表停用。
- **讓 Cella 的程式 JSON 當唯一的樹**（語義樹交出去）：違反盟約「各自可以獨立運作」——formalize 是防腐層，
  刻意保留自己的模型、在邊界上翻譯。
