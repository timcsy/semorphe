count = 0
for n in range(2, 101):
    ok = True
    for d in range(2, n):
        if n % d == 0:
            ok = False
    if ok:
        count = count + 1
print(count)
