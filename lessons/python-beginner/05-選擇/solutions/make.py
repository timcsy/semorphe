a = int(input())
b = int(input())
if a == b:
    print("平手")
elif (a + 1) % 3 == b:
    print("B")
else:
    print("A")
