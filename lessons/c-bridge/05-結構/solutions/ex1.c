struct Point {
    int x;
    int y;
};

int main() {
    struct Point ps[3];
    for (int i = 0; i < 3; i++) {
        ps[i].x = i;
        ps[i].y = i * 2;
    }
    for (int i = 0; i < 3; i++) {
        printf("%d %d\n", ps[i].x, ps[i].y);
    }
    return 0;
}
