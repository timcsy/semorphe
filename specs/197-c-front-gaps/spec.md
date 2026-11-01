# Spec 197：C 前端的三個缺口（cella 問 C 子集時量到）

cella 2026-11-01 要動 C 子集的語法樹，先問我們七項構造現在怎麼處理。逐項 lift → formalize 實測，七項的實況已回 cella（他們照推薦做：
巨集由前端展開、後綴與進位的欄位、指定初始化子、eCompound、storage 欄位、區塊內的型別定義、opPlus）。量的時候抓到三個我們自己的缺口：

- **FR-001** `int main(void)`：`void` 被當成一個參數 → 整支卡在「型別 void 還沒有對應」。改成：參數列只有一個沒名字的 `void` ＝沒有參數（C11 6.7.6.3p10）。
- **FR-002** `extern int x;`：lift 時 `extern` 被悄悄丟掉，轉一圈回來是 `int x;`——宣告變成定義。改成誠實降級（原樣保留，理由「extern 宣告尚未支援」）；
  函式的 `extern` 與一般原型同義，照舊。
- **FR-003** 物件巨集 `#define N 10`：前端展開（cella 的推薦）——formalize 把數字字面量的巨集代進使用處（標籤用使用處的 id）、陣列長度也認得；
  `#define` 本身不產生項目；值不是數字的照實標 unknown。

## 驗收

- 單元：三條（`tests/unit/providers/formalize.test.ts`）。
- 實測：`#define N 10` ＋ `int a[N]` ＋ `int main(void)` 交給 Cella 判 accept、輸出 `10 3`。
- 判決綁定語料維持 109／109。
