int main() {
    int money;
    cin >> money;
    cout << money / 500 << endl;
    money = money % 500;
    cout << money / 100 << endl;
    money = money % 100;
    cout << money / 50 << endl;
    money = money % 50;
    cout << money / 10 << endl;
    money = money % 10;
    cout << money / 5 << endl;
    money = money % 5;
    cout << money << endl;
    return 0;
}
