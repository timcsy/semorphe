struct Student {
    int math;
    int eng;
};

int main() {
    struct Student s[3];
    s[0].math = 80; s[0].eng = 90;
    s[1].math = 95; s[1].eng = 95;
    s[2].math = 60; s[2].eng = 100;
    int best = 0;
    for (int i = 1; i < 3; i++) {
        if (s[i].math + s[i].eng > s[best].math + s[best].eng) best = i;
    }
    printf("%d\n", best);
    printf("%d\n", (s[best].math + s[best].eng) / 2);
    return 0;
}
