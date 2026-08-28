# 序列埠

> 讓板子跟電腦說話。 · ⏱ 約 25 分鐘

## 你會學到三件事

1. `Serial` 是板子和電腦之間的一條線
2. `Serial.println` 印出去，`Serial.read` 讀進來
3. 為什麼一定要先 `Serial.begin`

## 開始之前

前兩課的板子只會閃燈——**你沒辦法知道它腦袋裡在想什麼**。

感測器讀到多少？迴圈跑到第幾圈？看不到。
這一課給你一個窗口，而它也是**硬體世界最重要的除錯工具**。

## 一、先開這條線

```cpp
void setup() {
    Serial.begin(9600);
}
```

`9600` 是**速度**（每秒幾個位元）。板子和電腦**兩邊要用同一個數字**，
不然收到的會是亂碼。

⚠️ **忘了 `Serial.begin` 的話，後面的 `println` 全部沒有反應**——
而且不會報錯。這是最常見的第一個坑。

## 二、印出去

```cpp
Serial.println("ready");
Serial.println(42);
```

| | 差別 |
|---|---|
| `Serial.print(x)` | 印出去，**不換行** |
| `Serial.println(x)` | 印出去，**換行**（`ln` = line） |

和 `cout` 一樣，數字和文字都印得出來。

> 「印一行看看現在的值是多少」——**這是硬體除錯的第一招，
> 而且大部分時候它就夠了。**

## 三、讀進來

```cpp
void loop() {
    if (Serial.available() > 0) {
        int n = Serial.read();
        Serial.println(n);
    }
}
```

⚠️ **`Serial.read()` 之前一定要先問 `Serial.available()`。**

因為 `loop` 每秒跑幾萬次，而人打字很慢。
大部分時候**根本沒有東西可讀**，這時 `read()` 會拿到一個沒有意義的值。

| | 意思 |
|---|---|
| `Serial.available()` | 現在有幾個字元在等著被讀 |
| `Serial.read()` | 讀走一個 |

**「先問有沒有，再去拿」**——這個形狀在所有輸入裝置上都會遇到。

## 完成的樣子

```cpp
void setup() {
    Serial.begin(9600);
    Serial.println("ready");
}

void loop() {
    if (Serial.available() > 0) {
        int n = Serial.read();
        Serial.println(n);
    }
}
```

## 換你了

回頭把第 1 課的閃燈加上一行 `Serial.println("亮");` 和
`Serial.println("暗");`，看著文字和燈一起變。

**這就是你以後除錯的方式。**

## 這一課你做了什麼

- 你用 `Serial.begin` 開了板子和電腦之間的線
- 你用 `println` 把板子裡的值印出來看
- 你知道讀之前要先問 `available()`

## 如果卡住了

| 你看到 | 多半是因為 |
|---|---|
| 什麼都沒印出來 | `Serial.begin` 漏了 |
| 印出來是亂碼 | 兩邊的速度不一樣（`9600` vs 別的） |
| 讀到一堆 `-1` | 沒先問 `available()`——沒東西可讀時就是 `-1` |
| 打了 `5` 讀到 `53` | `read()` 拿到的是**字元**。`'5'` 這個字元的編號是 53 |
