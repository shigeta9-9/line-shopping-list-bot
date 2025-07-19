# LINE Messaging API 買い物リストBot

Google Apps Script (GAS) を使用したLINE Messaging APIの買い物リスト管理Botです。

## 機能

- **アイテム追加**: 「追加　牛乳」でリストにアイテムを追加
- **アイテム削除**: 「削除　卵」でリストからアイテムを削除
- **一覧表示**: 「一覧」で現在のリストを表示
- **スプレッドシート連携**: Google Spreadsheetでデータを管理

## セットアップ手順

### 1. LINE Developers Console での設定

1. [LINE Developers Console](https://developers.line.biz/console/) にアクセス
2. 新しいプロバイダーを作成（または既存のプロバイダーを選択）
3. **Messaging API** チャンネルを作成
4. **チャンネルアクセストークン（長期）** を取得
5. **Webhook URL** を設定（後述のGAS WebアプリURL）

### 2. Google Apps Script での設定

1. [Google Apps Script](https://script.google.com/) にアクセス
2. 新しいプロジェクトを作成
3. `shopping_list_bot.gs` のコードをコピー&ペースト
4. **CHANNEL_ACCESS_TOKEN** を実際のトークンに置き換え
5. **デプロイ** → **新しいデプロイ** → **ウェブアプリ** を選択
   - 説明: 「LINE Bot Webhook」
   - 次のユーザーとして実行: 「自分」
   - アクセスできるユーザー: **「全員」**
6. **デプロイ** をクリックしてWebアプリURLを取得

### 3. LINE側のWebhook設定

1. LINE Developers Console で **Webhook URL** にGASのWebアプリURLを設定
2. **Webhookの利用** を有効化
3. **検証** ボタンで動作確認（タイムアウトエラーが出ても問題ありません）

### 4. Google Spreadsheet の準備

1. 新しいGoogle Spreadsheetを作成
2. シート名を「シート1」にする（デフォルト）
3. GASプロジェクトと同じGoogleアカウントでアクセス可能にする

## 使用方法

LINEアプリでBotに以下のメッセージを送信：

- `追加　牛乳` - リストに「牛乳」を追加
- `削除　卵` - リストから「卵」を削除
- `一覧` - 現在のリストを表示

## ファイル構成

```
├── shopping_list_bot.gs    # メインのGASコード
├── README.md              # このファイル
└── .gitignore             # Git除外設定
```

## テスト機能

GASエディタで以下の関数を実行してテストできます：

- `checkSpreadsheet()` - スプレッドシートの状態確認
- `testAddItem()` - アイテム追加テスト
- `testDeleteItem()` - アイテム削除テスト
- `testGetList()` - 一覧取得テスト

## トラブルシューティング

### Webhook検証でタイムアウトエラーが出る場合
- GASのWebアプリが「全員」に公開されているか確認
- 実際のLINEアプリからメッセージを送信して動作確認

### 認証エラー（HTTP 403）が出る場合
- チャンネルアクセストークンが正しいか確認
- トークンの有効期限を確認

### スプレッドシートにアクセスできない場合
- GASプロジェクトとスプレッドシートが同じGoogleアカウントか確認
- スプレッドシートの共有設定を確認

## セキュリティ注意事項

⚠️ **重要**: チャンネルアクセストークンは機密情報です。GitHubにアップロードする際は必ず環境変数や設定ファイルで管理してください。

## ライセンス

MIT License

## 作者

[shigeta9-9]

## 更新履歴

- v1.0.0 - 初期リリース
  - 基本的な買い物リスト管理機能
  - LINE Messaging API連携
  - Google Spreadsheet連携 
