int main() {
    priority_queue<int> q;
    q.push(5);
    q.push(1);
    q.push(9);
    q.push(3);
    q.push(7);
    int total = 0;
    for (int i = 0; i < 3; i++) {
        total = total + q.top();
        q.pop();
    }
    cout << total << endl;
    return 0;
}
