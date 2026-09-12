words = input().split()
seen = {}
for w in words:
    seen[w] = seen.get(w, 0) + 1
for w in sorted(seen):
    print(w, seen[w])
