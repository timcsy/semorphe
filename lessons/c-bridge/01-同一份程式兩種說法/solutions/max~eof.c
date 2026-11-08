#include <stdio.h>
int main() {
    int x;
    int best = 0;
    int seen = 0;
    while (scanf("%d", &x) == 1) {
        if (seen == 0 || x > best) {
            best = x;
        }
        seen = 1;
    }
    printf("%d\n", best);
    return 0;
}
