#include <stdio.h>
int main() {
    int x;
    int best;
    scanf("%d", &x);
    best = x;
    while (x != 0) {
        if (x > best) {
            best = x;
        }
        scanf("%d", &x);
    }
    printf("%d\n", best);
    return 0;
}
