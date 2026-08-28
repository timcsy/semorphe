# 測距離

> 用聲音的來回時間換算距離。 · ⏱ 約 35 分鐘

## 你會學到三件事

1. 超音波感測器怎麼運作：**送一聲、量它多久回來**
2. `pulseIn` 量一個脈衝有多長
3. 為什麼這一課**非得寫成一個函式**不可

## 開始之前

**接線**：HC-SR04 的 `Trig` 接 **9 號腳**、`Echo` 接 **10 號腳**、
`VCC` 接 5V、`GND` 接 GND。

## 一、原理

```
①  Trig 送出一個 10 微秒的高電位   →  感測器發出一串超音波
②  聲音撞到東西彈回來
③  Echo 這支腳變高，持續的時間 = 聲音來回花的時間
```

聲音在空氣中大約 **340 公尺／秒**，也就是 **0.034 公分／微秒**。

所以：

```
來回距離 = 時間 × 0.034
單程距離 = 時間 × 0.034 ÷ 2 = 時間 ÷ 58
```

⚠️ **那個「除以 2」不能忘**——量到的是來回，而你要的是單程。
忘了的話所有距離都會是兩倍，而它看起來只是「不太準」。

## 二、送出那一聲

```cpp
digitalWrite(9, LOW);
delayMicroseconds(2);
digitalWrite(9, HIGH);
delayMicroseconds(10);
digitalWrite(9, LOW);
```

規格書要求：**一個乾淨的 10 微秒高電位**。

前面那個 `LOW` ＋ 2 微秒是「先確保它是低的」——
不然上一次留下的殘留會讓這一次的脈衝長度不對。

`delayMicroseconds` 和 `delay` 是同一件事，單位差一千倍
（1 毫秒 = 1000 微秒）。

## 三、量它多久回來

```cpp
long t = pulseIn(10, HIGH);
```

`pulseIn(腳, HIGH)` 的意思是：「**等這支腳變高，然後量它高了多久**」，
回傳的單位是微秒。

⚠️ **`pulseIn` 會卡住整支程式**，直到它量到（或超時）。
所以在它等待的那段時間，你的板子什麼都做不了。這是它的代價。

⚠️ 用 `long` 不用 `int`——`int` 在 Uno 上只裝得下 32767，
而 `pulseIn` 的值輕易就超過。**溢位不會報錯，只會給你一個負數。**

## 四、🔴 為什麼要寫成函式

上面那六行，每量一次距離就要全部再寫一次。

而「測距」在一支程式裡通常要用好幾次——判斷障礙、記錄、顯示。
所以它應該是**一個名字**：

```cpp
long distance() {
    digitalWrite(9, LOW);
    delayMicroseconds(2);
    digitalWrite(9, HIGH);
    delayMicroseconds(10);
    digitalWrite(9, LOW);
    long t = pulseIn(10, HIGH);
    return t / 58;
}
```

之後就只要寫 `distance()`。

> **函式不是「進階語法」——它是你第一次覺得
> 「這六行我不想再寫一遍」的時候，自然會想要的東西。**

## 完成的樣子

```cpp
long distance() {
    digitalWrite(9, LOW);
    delayMicroseconds(2);
    digitalWrite(9, HIGH);
    delayMicroseconds(10);
    digitalWrite(9, LOW);
    long t = pulseIn(10, HIGH);
    return t / 58;
}

void setup() {
    Serial.begin(9600);
    pinMode(9, OUTPUT);
    pinMode(10, INPUT);
}

void loop() {
    Serial.println(distance());
    delay(200);
}
```

## 換你了

加一顆蜂鳴器：**越近叫得越急**。

提示：`delay` 的長度用 `distance()` 算出來——
近的時候 delay 短，遠的時候 delay 長。（倒車雷達就是這樣做的。）

## 這一課你做了什麼

- 你用一個脈衝的長度換算出了距離
- 你用 `pulseIn` 量了那個脈衝
- 你把六行包成一個函式，因為你不想再寫一遍

## 如果卡住了

| 你看到 | 多半是因為 |
|---|---|
| 距離都是 0 | Echo 腳接錯，或感測器沒供電 |
| 距離是實際的兩倍 | 忘了除以 2（也就是除以 58 寫成除以 29） |
| 出現負數 | 用了 `int`。要用 `long` |
| 程式偶爾卡住不動 | `pulseIn` 沒量到就會等到超時。那是正常的 |
| 讀數跳來跳去 | 超音波會被斜面和軟布吸走。多量幾次取中位數 |
