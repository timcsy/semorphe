s = input()
counts = {}
for w in s.split():
    counts[w] = counts.get(w, 0) + 1
print(max(counts, key=lambda w: counts[w]))
