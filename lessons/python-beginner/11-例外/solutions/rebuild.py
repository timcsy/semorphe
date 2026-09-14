try:
    n = int("abc")
    print("轉成了", n)
except ValueError:
    print("那不是數字")
print("程式繼續")
