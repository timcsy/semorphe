# 072　target 的兩個假設都倒了——而其中一個反而證明了 target 該做

> 日期：2026-08-17（spec `134`，vision 階段 6.10 第一刀）
> 本檔記的是**兩個寫進 plan／spec 的假設在動手時被推翻**，
> 不是交付了什麼（那在 `specs/134-target-named-combination/`）。

## 轉變

```
old  plan：「修 6/10 不需要 target」——`c-style-parity` 用 style 直接切換就行
new  🔴 沒有任何既有欄位標得出「這是 C」，所以規則只能錨在【具名的 id】上
     → 而那【反而證明了 target 的必要性】

old  spec：「標頭名對映表今天不存在」，列為「本功能唯一新增的資料」
new  🔴 它是 19 筆，而且【反向表也已經建好】→ 新增的資料 = 0
```

## 一、第一個假設：`printf` 不等於 C

plan 的順序是「先修 6/10，再做 target」，理由是「`c-style-parity` 用 style
切換就修得到」。**動手時實測四個風格**：

```
id           io       namespace  header      naming
apcs         cout     using      individual  camelCase
c            printf   explicit   individual  snake_case
competitive  printf   using      bits        snake_case   ← 🔴 printf 而是 C++
google       cout     explicit   individual  snake_case   ← 🔴 explicit 而是 C++
```

**兩個欄位的合取今天只有 `c` 命中——而那是巧合，不是宣告。**

> **一個靠既有欄位合取推出來的身分，不是一個身分
> ——它只是今天剛好沒有別人命中。**

🟢 **而這正是 `target` 存在的理由**：`draft/2026-08-13-C和C++難分難捨.md`§三
說它是「把三個既有欄位綁成一個**具名的**組合」——
**而「具名」不是便利，是那個組合【本身就是一個身分】。**
沒有名字的時候，只能靠合取去猜它。

## 二、第二個假設：那張表已經在了，而我兩次都沒找到

`header-aliases.ts` 有 `C_TO_CPP`（19 筆）**與 `CPP_TO_C`（反向，已建好）**。

⚠️ **而我查了兩次都沒找到**：

```
第一次   grep requires    → 只看到元件宣告的【C++ 名字】
第二次   數 c* 那一族      → 數的是【元件宣告了什麼】，不是【系統認識什麼】
```

> **「這個東西存在嗎」與「這個東西被誰宣告」是兩個問題，
> 而我兩次都問了第二個。**

🟢 所以本功能新增的資料是**零**。⚠️ 而 research Q2 的「5 筆 vs 13 筆」拆分
**仍然成立且有用**：13 種在 C 裡**根本不存在**的標頭，是 `visible` 的責任
不是對映表的。

## 三、而最貴的坑是「兩條產出路徑」

`c-style-parity` **10/10 全綠**，**而瀏覽器上仍然產出 `<iostream>` ＋
`using namespace std;`**——`cpp:program` 有兩條路徑（**鷹架的**：UI 走；
**legacy 的**：測試走），第一版只改了 legacy。

> **一份只走得到其中一條路徑的測試，會讓另一條路徑的缺陷全綠通過。**

⚠️ 而它是 [experience](../experience.md)「重構後開瀏覽器實測」抓到的
——**那條規則第一次真的救了人**。已收成 `e2e/c-target.spec.ts`。

## 四、⚠️ 而 `c.json` 從來沒進過選單

本輪修好的 10/10，**在接上選單之前沒有任何人拿得到**。
那是「機制有了沒人接上」的**第六次**，而它差一點發生。

## 五、🔴 而第一刀沒有兌現它的主要承諾

```
cpp.json   topic: cpp-beginner
c.json     topic: cpp-beginner   ← 同一個
```

**SC-001（選 3 次 → 1 次）只兌現了三分之一。**

> **一個「綁定」如果兩邊綁的是同一個值，它在資料上成立，而在效果上是零。**

⚠️ 要兌現需要一個 **C 專屬的課程清單**——那是 `visible` 那一格真正的工作，
**而它與 `provides`／`reference` 一起留在 `draft` 裡**（做完才退休）。

## 相關

- `specs/134-target-named-combination/`——research Q4／Q5 有完整的推翻過程
- [draft/C 和 C++ 難分難捨](../draft/2026-08-13-C和C++難分難捨.md)§三——`target` 的設計，**仍 in-flight**
- [history/073](073-投影之間的一致性第一次被驗.md)——第二刀，而它是這一刀補齊分母才問得了的
- [experience](../experience.md) 三條——本輪反流
