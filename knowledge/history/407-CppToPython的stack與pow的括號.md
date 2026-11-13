# 407：C++ → Python 收下 stack，修 `pow(-2, 2)` 的括號；queue 與 priority_queue 寫好等 Cella（448）

**之前**：stack／queue／priority_queue 的六顆元件（宣告、push、pop、empty、front、top）沒有 Python 的寫法。cpp-advanced 有 5 支卡在這裡。量的時候又找到一個**靜默失真**：`pow(-2, 2)` 換成 `-2 ** 2`。Python 的 `**` 比一元負號綁得緊，所以 C++ 印 4、Python 印 -4，兩邊都 accept。原因是加括號的判準 `paren` 只看「是不是二元運算」。

**之後**：
- **stack → list**：push → `append`，pop → `pop()`，top → `s[-1]`。
- **empty → `len(x) == 0`**：stack、queue、priority_queue、vector、string 都適用。
- **指定與參數照「複製」處理**：stack 的指定寫成 `list(…)`。樣板型別以值傳的參數（`stack<int> s`、`queue<int> q`）一律保留；之前的正規式只擋 vector，stack 換得過去之後它會漏掉。
- **`**` 兩邊不是原子就加括號**：原子是名字、屬性、下標、單層呼叫、非負數字。最大堆存負數時，`-` 接在負數字面量前面也用同一個判準，否則會寫成 `--3`。判準住在 `to-python/contract.ts` 的 `atom`。
- **queue → `collections.deque()`、priority_queue → heapq 管理的 list**：最大堆存負數，所以只收整數；浮點的 -0.0 與 NaN 會亂序。寫法已經寫好，可是 Cella 的 Python 還不支援這兩個模組（`import collections`／`import heapq` 判 unknown）。宣告那顆先照實保留、寫明原因（`WAITING_FOR_CELLA`）。cella 排在 11-14 晚上到 11-15 發版，發版後拿掉那一行就接上。
- cpp-advanced 22 支換過去 7 → 8（05 括號配對那支），棘輪下限 8。手寫 7 條：4 條換過去且判決相同、3 條照實保留。

**同一夜談定的 Cella 判決修正**：純量用預設比較時，sort 不再附 `sort.order`；stable_sort 一律不附；回傳參照參數不再被當成隱式搬移。三件都排在 11-14 白天發。發版後 `sort` 也換得過去，可望再加 3 支（02 兩支、08 視比較子而定）。

**為什麼這樣做**：Python 的 deque 與 heapq 才是道地寫法。用 `list.pop(0)` 可以馬上換過去、判決也會相同，可是學生看到的不是 Python 該有的樣子，而且 Cella 支援之後又要改一次。所以寧可照實保留幾小時。
