/**
 * LINE Messaging API 買い物リストBot
 *
 * 主な仕様:
 * - LINEからのメッセージを受信し、買い物リストを管理
 * - スプレッドシートにアイテムの追加・削除・一覧表示機能
 * - デバッグ用ログ出力機能付き
 *
 * 制限事項:
 * - チャンネルアクセストークンの有効期限に注意
 * - スプレッドシートの権限設定が必要
 */

// チャンネルアクセストークン（実際のトークンに置き換えてください）
const CHANNEL_ACCESS_TOKEN = 'YOUR_CHANNEL_ACCESS_TOKEN_HERE';

/**
 * LINE WebhookからのPOSTリクエストを処理するメイン関数
 * @param {Object} e - POSTリクエストのイベントオブジェクト
 */
function doPost(e) {
  try {
    console.log('=== doPost開始 ===');

    // 手動実行時の対応
    if (!e || !e.postData) {
      console.log('手動実行または無効なリクエストです。テスト関数を使用してください。');
      console.log('使用可能なテスト関数:');
      console.log('- testBot() : 基本的なテスト');
      console.log('- testAddItem() : アイテム追加テスト');
      console.log('- testDeleteItem() : アイテム削除テスト');
      console.log('- testGetList() : 一覧取得テスト');
      return;
    }

    console.log('受信データ:', e.postData.contents);

    const json = JSON.parse(e.postData.contents);
    const event = json.events && json.events[0];

    console.log('パースされたJSON:', JSON.stringify(json, null, 2));
    console.log('イベント:', JSON.stringify(event, null, 2));

    if (!event) {
      console.log('イベントが存在しません');
      return;
    }

    if (event.type !== 'message') {
      console.log('メッセージタイプではありません:', event.type);
      return;
    }

    const replyToken = event.replyToken;
    const userMessage = event.message.text.trim();

    console.log('返信トークン:', replyToken);
    console.log('ユーザーメッセージ:', userMessage);

    let replyText = '';

    if (userMessage.startsWith('追加　')) {
      const item = userMessage.replace('追加　', '').trim();
      console.log('追加アイテム:', item);
      if (item) {
        addItemToSheet(item);
        replyText = `リストに「${item}」を追加しました。`;
      }
    } else if (userMessage.startsWith('削除　')) {
      const item = userMessage.replace('削除　', '').trim();
      console.log('削除アイテム:', item);
      if (item) {
        const success = deleteItemFromSheet(item);
        replyText = success ? `「${item}」を削除しました。` : `「${item}」は見つかりませんでした。`;
      }
    } else if (userMessage === '一覧') {
      console.log('一覧表示リクエスト');
      replyText = getListFromSheet();
    } else {
      console.log('未対応のメッセージ:', userMessage);
      replyText = '使い方:\n・「追加　牛乳」でアイテム追加\n・「削除　卵」でアイテム削除\n・「一覧」でリスト表示';
    }

    console.log('返信テキスト:', replyText);
    replyToUser(replyToken, replyText);

  } catch (error) {
    console.error('doPostでエラーが発生:', error);
    console.error('エラースタック:', error.stack);
  }
}

/**
 * スプレッドシートにアイテムを追加する関数
 * @param {string} item - 追加するアイテム名
 */
function addItemToSheet(item) {
  try {
    console.log('=== addItemToSheet開始 ===');
    console.log('追加アイテム:', item);

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    console.log('スプレッドシートID:', spreadsheet.getId());

    const sheet = spreadsheet.getActiveSheet();
    console.log('シート名:', sheet.getName());

    const timestamp = new Date();
    console.log('タイムスタンプ:', timestamp);

    sheet.appendRow([item, timestamp]);
    console.log('アイテム追加完了');

  } catch (error) {
    console.error('addItemToSheetでエラーが発生:', error);
    throw error;
  }
}

/**
 * スプレッドシートからアイテムを削除する関数
 * @param {string} item - 削除するアイテム名
 * @returns {boolean} 削除成功時true、失敗時false
 */
function deleteItemFromSheet(item) {
  try {
    console.log('=== deleteItemFromSheet開始 ===');
    console.log('削除アイテム:', item);

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();

    console.log('シートデータ行数:', data.length);
    console.log('シートデータ:', JSON.stringify(data, null, 2));

    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === item) {
        console.log('削除対象行:', i + 1);
        sheet.deleteRow(i + 1); // スプレッドシートは1始まり
        console.log('アイテム削除完了');
        return true;
      }
    }

    console.log('削除対象アイテムが見つかりませんでした');
    return false;

  } catch (error) {
    console.error('deleteItemFromSheetでエラーが発生:', error);
    return false;
  }
}

/**
 * スプレッドシートから一覧を取得する関数
 * @returns {string} 一覧テキスト
 */
function getListFromSheet() {
  try {
    console.log('=== getListFromSheet開始 ===');

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();

    console.log('シートデータ行数:', data.length);
    console.log('シートデータ:', JSON.stringify(data, null, 2));

    if (data.length === 0) {
      console.log('リストは空です');
      return 'リストは空です。';
    }

    const list = data.map(row => `・${row[0]}`).join('\n');
    const result = `現在のリスト:\n${list}`;

    console.log('一覧取得完了:', result);
    return result;

  } catch (error) {
    console.error('getListFromSheetでエラーが発生:', error);
    return 'リストの取得に失敗しました。';
  }
}

/**
 * LINE APIを使用してユーザーに返信する関数
 * @param {string} replyToken - 返信トークン
 * @param {string} text - 返信テキスト
 */
function replyToUser(replyToken, text) {
  try {
    console.log('=== replyToUser開始 ===');
    console.log('返信トークン:', replyToken);
    console.log('返信テキスト:', text);

    const url = 'https://api.line.me/v2/bot/message/reply';
    const payload = JSON.stringify({
      replyToken: replyToken,
      messages: [{
        type: 'text',
        text: text
      }]
    });

    console.log('送信ペイロード:', payload);

    const options = {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
      },
      payload: payload
    };

    console.log('送信オプション:', JSON.stringify(options, null, 2));

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    console.log('LINE API レスポンスコード:', responseCode);
    console.log('LINE API レスポンス:', responseText);

    if (responseCode !== 200) {
      console.error('LINE API エラー:', responseCode, responseText);
    } else {
      console.log('返信送信完了');
    }

  } catch (error) {
    console.error('replyToUserでエラーが発生:', error);
    console.error('エラースタック:', error.stack);
  }
}

/**
 * 基本的なテスト用関数 - 手動で実行して動作確認
 */
function testBot() {
  console.log('=== 基本的なテスト開始 ===');

  // テスト用のイベントオブジェクトを作成
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-reply-token',
          message: {
            text: '一覧'
          }
        }]
      })
    }
  };

  doPost(testEvent);
  console.log('=== 基本的なテスト完了 ===');
}

/**
 * アイテム追加のテスト用関数
 */
function testAddItem() {
  console.log('=== アイテム追加テスト開始 ===');

  // テスト用のイベントオブジェクトを作成
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-add-token',
          message: {
            text: '追加　テストアイテム'
          }
        }]
      })
    }
  };

  doPost(testEvent);
  console.log('=== アイテム追加テスト完了 ===');
}

/**
 * アイテム削除のテスト用関数
 */
function testDeleteItem() {
  console.log('=== アイテム削除テスト開始 ===');

  // テスト用のイベントオブジェクトを作成
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-delete-token',
          message: {
            text: '削除　テストアイテム'
          }
        }]
      })
    }
  };

  doPost(testEvent);
  console.log('=== アイテム削除テスト完了 ===');
}

/**
 * 一覧取得のテスト用関数
 */
function testGetList() {
  console.log('=== 一覧取得テスト開始 ===');

  // テスト用のイベントオブジェクトを作成
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-list-token',
          message: {
            text: '一覧'
          }
        }]
      })
    }
  };

  doPost(testEvent);
  console.log('=== 一覧取得テスト完了 ===');
}

/**
 * スプレッドシートの状態を確認する関数
 */
function checkSpreadsheet() {
  console.log('=== スプレッドシート状態確認 ===');

  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    console.log('スプレッドシートID:', spreadsheet.getId());
    console.log('スプレッドシート名:', spreadsheet.getName());

    const sheet = spreadsheet.getActiveSheet();
    console.log('アクティブシート名:', sheet.getName());
    console.log('シートの行数:', sheet.getLastRow());
    console.log('シートの列数:', sheet.getLastColumn());

    const data = sheet.getDataRange().getValues();
    console.log('データ行数:', data.length);
    console.log('データ内容:', JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('スプレッドシート確認でエラー:', error);
  }
}
