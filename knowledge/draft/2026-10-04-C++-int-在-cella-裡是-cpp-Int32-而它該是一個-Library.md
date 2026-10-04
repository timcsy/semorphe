# C++ 的 int 在 cella 裡是 `cpp.Int32`，而它該是一個 Library

> 狀態：**問題已有答案（C15）；歸屬已定（cella 同意，2026-10-05）；等交付**。

## 一、事實（cella-ee 2026-10-04 回覆，對方原則 C15，已經使用者確認）

- C++ 的 `int` **不是** Nat、**不是** ℤ，是 `cpp.Int32`：32 位元、有號溢位是 UB（前置條件）、
  除法向零截斷（`7 / -2 = -3`）、除以零是 UB（前置條件）。
- 與數學核心的關係只由證明擔保：`cpp.Int32 ↪ ℤ` 的嵌入 ＋ 帶前提的對應定理。
- **否決：以名字等同**（C++ int 與 Python int 對到同一個型別）——一旦發現差異，
  所有依賴它的證明一起失效，而且找不出是哪些。
- 出處（cella repo）：`knowledge/history/223-跨語言型別詞彙從等觸發到各語言各自型別加證明連接.md`、
  `knowledge/principles.md` 的 C15。
- stdlib 的 `Nat` 的 `sub`／`divNat`／`modNat` 是**全函式約定**（截斷到 0、除以 0 得 0），
  **不是** C++ 的語義。`Int` 沒有除法與餘數。standalone 模式看不到任何 stdlib。
- 停機性：沒有 well-founded 遞迴（`decreasing_by` 只被 parse）。
  結構遞迴（先把 `n ≥ 0` 當前置條件轉成 Nat）或**燃料**寫法（stdlib 的 `gcd2` 就是）。
- 區域可變狀態：只能翻成狀態傳遞；效應模型還沒有。

## 二、對我們的影響：第 305 刀的三個項違反 C15

`add`／`mul`／`square` 用 `addNat`／`mulNat` 代表 C++ 的 `int +`／`int *`——
cella 判 accept、0 個洞，而它證的是 **Nat 上的運算**：沒有負數、沒有溢位。
`cpp:compare` 的 `ltNat`、`cpp:array_at` 的索引同一個問題（索引用 Nat 本身合理，
但從 int 過去要「不是負數」的前置條件，今天沒寫）。

處置：**不再新增以 Nat 代表 int 的項**；三個舊項不刪、在契約檔頭標註；
棘輪不動（走訪器學會的兩個形狀是真的）。

## 三、歸屬：使用者的提議（2026-10-04）

> 讓 cpp 之類的套件成為 cella 的 Library，我們引入它；cella 也因此開始有套件管理的實際需求。

⟹ C++ 語義的權威在 **cella 的 `cpp` Library**，我們元件的 `contract.cella` 只寫
「這顆積木對應到哪個定義」（`import cpp`）。這修正了先前「契約住在元件膠囊」的一半：
**對應**住膠囊，**語言語義**住 Library。

已向 cella-ee 提的消費端需求：
1. standalone 模式下可只引入單一 Library（stdlib 是行程全域狀態，有靜默假綠的風險）
2. 每個 Library 自己的語義指紋（我們用來守判決，紅的時候知道是哪個套件變了）
3. wasm／瀏覽器無檔案系統，Library 要能以字串或隨 npm 附帶的形式傳入
4. 判決的 assumptions 標出來自哪個 Library 的哪個 postulate

## 三之一、cella 的回覆（2026-10-05）：同意，而且大部分現成

- 形狀：`cella-lang/modules/cpp.cell`（隨 npm 附帶、**不在預載清單**），`modules/index.json` 列依賴。
  我們的契約只寫 `import cpp`。py／arduino 之後照同一個模式。
- ① standalone 下只載一個包＋依賴閉包、順序確定：**交付 cpp 時補，並有測試守著**
- ② 每個模組包一個語義指紋（在 `index.json`）：**交付時加**
- ③ 無檔案系統：`load_module_pack(bytes)`，**今天就可用**
- ④ assumption 帶完整名字（含模組前綴，如 `cpp.cpp.someAxiom`）；**cpp 本身沒有 postulate**
  ⟹ 信任分級看前綴就分得出是哪個 Library

已寫好、在 `CELLA_NO_CACHE` 下測過的內容：`cpp.Int32 = mkInt32 (v : Int) (ok : InRange v)`、
`lit v (inRange refl)`；add／sub／mul／neg 要求「結果在範圍內」，div／rem 另要求 `NonZero b`；
`toInt` 嵌入、各運算的 toInt 對應定理、`toInt_inj`；stdlib 的 ℤ 補上向零截斷的 `quotInt`／`remInt`。

⚠️ **前置**：模組快照存的是**正規化後的值**，而 `toC f = (f-32)*5/9` 這種帶變數的整數運算
正規形極大，還原時第二個 kernel 堆疊溢位。cella 的使用者決定根治——快照改存
elaborate 出來的項（同 Lean 的 `.olean`）。**這件先做，接著交付 cpp。**
（我們課文裡的 `toC` 正好是它的實例。）

## 四、還開著的

- 等交付：具體名字、`index.json` 的指紋欄位 ⟹ 我們把 `audit-cella-pinned` 擴成守 cpp 那一條
- 換過去之後：走訪器的型別表 `int → cpp.Int32`；`-`／`/`／`%` 由 Library 的前置條件版本收
- 剩下 8 個閉合函式：遞迴 4（結構或燃料）、區域可變 3（狀態傳遞）、除法 1（等 Library）
