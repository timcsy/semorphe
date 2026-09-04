s = input()
counts = {}
for c in s:
    counts[c] = counts.get(c, 0) + 1
for k in counts:
    print(k, counts[k])
