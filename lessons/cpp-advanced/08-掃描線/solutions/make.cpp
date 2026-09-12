int main() {
    vector<pair<int, int>> ev;
    ev.push_back(make_pair(1, 1));
    ev.push_back(make_pair(5, -1));
    ev.push_back(make_pair(2, 1));
    ev.push_back(make_pair(6, -1));
    ev.push_back(make_pair(3, 1));
    ev.push_back(make_pair(4, -1));
    sort(ev.begin(), ev.end());
    int now = 0, best = 0;
    for (int i = 0; i < ev.size(); i++) {
        now = now + ev[i].second;
        if (now > best) best = now;
    }
    cout << best << endl;
    return 0;
}
