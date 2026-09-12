words = input().split()
best = words[0]
for w in words:
    if len(w) > len(best):
        best = w
print(best)
print(len(best))
