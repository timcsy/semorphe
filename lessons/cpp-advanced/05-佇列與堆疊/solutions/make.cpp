int main() {
    queue<int> q;
    for (int i = 1; i <= 7; i++) q.push(i);
    int k = 3;
    while (q.size() > 1) {
        for (int i = 1; i < k; i++) {
            q.push(q.front());
            q.pop();
        }
        q.pop();
    }
    cout << q.front() << endl;
    return 0;
}
