count = [0, 0, 0, 0, 0, 0]
n = int(input())
for i in range(n):
    v = int(input())
    count[v] = count[v] + 1
best = 1
for i in range(2, 6):
    if count[i] > count[best]:
        best = i
for i in range(1, 6):
    print(i, count[i])
print("當選", best)
