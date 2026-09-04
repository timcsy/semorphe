int main() {
    priority_queue<int, vector<int>, greater<int>> q;
    q.push(1);
    q.push(2);
    q.push(3);
    q.push(4);
    int total = 0;
    while (q.size() > 1) {
        int a = q.top();
        q.pop();
        int b = q.top();
        q.pop();
        total = total + a + b;
        q.push(a + b);
    }
    cout << total << endl;
    return 0;
}
