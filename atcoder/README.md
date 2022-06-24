# atcoder 概要

atcoder は vscode の拡張機能です。  
僕が AtCoder をやるときにあったらいいなと思った機能が入ってます。

### できること

- プロジェクト自動作成
  - コンテスト名（例：「abc222」とか）を入力すると、  
    自動でプロジェクトを作成します。  
    また、テストコード（入出力例）も作成します。
- workspace 切り替え機能
  - コンテスト名（例：「abc222」とか）を入力すると、  
    プロジェクトがない場合は ↑ で作成したプロジェクトを workspace に設定します。  
    もし、プロジェクトがある場合はそのプロジェクトを workspace に設定します。

インストール方法
![demo_install](https://raw.github.com/wiki/magurouhiru/vscode-extension-atcoder/images/atcoder_extension_install.gif)

使用方法
![demo_install](https://raw.github.com/wiki/magurouhiru/vscode-extension-atcoder/images/atcoder_extension_how.gif)

### 注意事項

- 対応言語は Rust だけです。  
  もっと言えば、[こちら](https://github.com/magurouhiru/vscode-atcoder-rust)の環境で無いと動かないです。
- 対応しているコンテストは ABC(AtCoder Beginner Contest)だけです。

### この後やりたいこと

- setting.json を使って、いろいろな環境で動くようにしたい。
- Rust 以外の言語にも対応できるようにしたい。
