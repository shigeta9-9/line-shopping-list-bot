/**
 * LINE Messaging API 買い物リスト・タスクリストBot
 *
 * 主な仕様:
 * - LINEからのメッセージを受信し、買い物リストとタスクリストを管理
 * - スプレッドシートにアイテムの追加・削除・一覧表示機能
 * - シート1: 買い物リスト、シート2: タスクリスト
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
      console.log('- testAddShoppingItem() : 買い物アイテム追加テスト');
      console.log('- testAddMultipleShoppingItems() : 複数買い物アイテム追加テスト（読点区切り）');
      console.log('- testAddMultipleShoppingItemsWithSpace() : 複数買い物アイテム追加テスト（スペース区切り）');
      console.log('- testDeleteShoppingItem() : 買い物アイテム削除テスト');
      console.log('- testDeleteMultipleShoppingItems() : 複数買い物アイテム削除テスト（読点区切り）');
      console.log('- testDeleteMultipleShoppingItemsWithSpace() : 複数買い物アイテム削除テスト（スペース区切り）');
      console.log('- testGetShoppingList() : 買い物一覧取得テスト');
      console.log('- testAddTask() : タスク追加テスト');
      console.log('- testAddMultipleTasks() : 複数タスク追加テスト（読点区切り）');
      console.log('- testAddMultipleTasksWithSpace() : 複数タスク追加テスト（スペース区切り）');
      console.log('- testDeleteTask() : タスク削除テスト');
      console.log('- testDeleteMultipleTasks() : 複数タスク削除テスト（読点区切り）');
      console.log('- testDeleteMultipleTasksWithSpace() : 複数タスク削除テスト（スペース区切り）');
      console.log('- testGetTaskList() : タスク一覧取得テスト');
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

    // 全角スペース（U+3000）を半角スペース（U+0020）に正規化
    const normalizedMessage = userMessage.replace(/\u3000/g, ' ');

    let replyText = '';

    // 買い物リスト関連のコマンド
    if (normalizedMessage.match(/^買い物追加\s+/)) {
      const itemsText = normalizedMessage.replace(/^買い物追加\s+/, '').trim();
      console.log('買い物追加アイテム:', itemsText);
      if (itemsText) {
        // 読点（、）とスペース（全角・半角）で区切って複数アイテムを処理
        const items = itemsText.split(/[、\s]+/).map(item => item.trim()).filter(item => item.length > 0);
        console.log('分割されたアイテム:', items);

        if (items.length > 0) {
          const addedItems = [];
          for (const item of items) {
            addShoppingItemToSheet(item);
            addedItems.push(item);
          }

          if (items.length === 1) {
            replyText = `買い物リストに「${addedItems[0]}」を追加しました。`;
          } else {
            replyText = `買い物リストに以下のアイテムを追加しました：\n${addedItems.map(item => `・${item}`).join('\n')}`;
          }
        }
      }
    } else if (normalizedMessage.match(/^買い物削除\s+/)) {
      const itemsText = normalizedMessage.replace(/^買い物削除\s+/, '').trim();
      console.log('買い物削除アイテム:', itemsText);
      if (itemsText) {
        // 読点（、）とスペース（全角・半角）で区切って複数アイテムを処理
        const items = itemsText.split(/[、\s]+/).map(item => item.trim()).filter(item => item.length > 0);
        console.log('分割された削除アイテム:', items);

        if (items.length > 0) {
          const successItems = [];
          const failedItems = [];

          for (const item of items) {
            const success = deleteShoppingItemFromSheet(item);
            if (success) {
              successItems.push(item);
            } else {
              failedItems.push(item);
            }
          }

          if (items.length === 1) {
            replyText = successItems.length > 0 ?
              `「${successItems[0]}」を買い物リストから削除しました。` :
              `「${failedItems[0]}」は買い物リストに見つかりませんでした。`;
          } else {
            let resultText = '';
            if (successItems.length > 0) {
              resultText += `削除成功：\n${successItems.map(item => `・${item}`).join('\n')}`;
            }
            if (failedItems.length > 0) {
              if (resultText) resultText += '\n\n';
              resultText += `削除失敗（見つかりませんでした）：\n${failedItems.map(item => `・${item}`).join('\n')}`;
            }
            replyText = resultText;
          }
        }
      }
    } else if (userMessage === '買い物一覧') {
      console.log('買い物一覧表示リクエスト');
      replyText = getShoppingListFromSheet();
    }
    // タスクリスト関連のコマンド
    else if (normalizedMessage.match(/^タスク追加\s+/)) {
      const tasksText = normalizedMessage.replace(/^タスク追加\s+/, '').trim();
      console.log('タスク追加:', tasksText);
      if (tasksText) {
        // 読点（、）とスペース（全角・半角）で区切って複数タスクを処理
        const tasks = tasksText.split(/[、\s]+/).map(task => task.trim()).filter(task => task.length > 0);
        console.log('分割されたタスク:', tasks);

        if (tasks.length > 0) {
          const addedTasks = [];
          for (const task of tasks) {
            addTaskToSheet(task);
            addedTasks.push(task);
          }

          if (tasks.length === 1) {
            replyText = `タスクリストに「${addedTasks[0]}」を追加しました。`;
          } else {
            replyText = `タスクリストに以下のタスクを追加しました：\n${addedTasks.map(task => `・${task}`).join('\n')}`;
          }
        }
      }
    } else if (normalizedMessage.match(/^タスク削除\s+/)) {
      const tasksText = normalizedMessage.replace(/^タスク削除\s+/, '').trim();
      console.log('タスク削除:', tasksText);
      if (tasksText) {
        // 読点（、）とスペース（全角・半角）で区切って複数タスクを処理
        const tasks = tasksText.split(/[、\s]+/).map(task => task.trim()).filter(task => task.length > 0);
        console.log('分割された削除タスク:', tasks);

        if (tasks.length > 0) {
          const successTasks = [];
          const failedTasks = [];

          for (const task of tasks) {
            const success = deleteTaskFromSheet(task);
            if (success) {
              successTasks.push(task);
            } else {
              failedTasks.push(task);
            }
          }

          if (tasks.length === 1) {
            replyText = successTasks.length > 0 ?
              `「${successTasks[0]}」をタスクリストから削除しました。` :
              `「${failedTasks[0]}」はタスクリストに見つかりませんでした。`;
          } else {
            let resultText = '';
            if (successTasks.length > 0) {
              resultText += `削除成功：\n${successTasks.map(task => `・${task}`).join('\n')}`;
            }
            if (failedTasks.length > 0) {
              if (resultText) resultText += '\n\n';
              resultText += `削除失敗（見つかりませんでした）：\n${failedTasks.map(task => `・${task}`).join('\n')}`;
            }
            replyText = resultText;
          }
        }
      }
    } else if (userMessage === 'タスク一覧') {
      console.log('タスク一覧表示リクエスト');
      replyText = getTaskListFromSheet();
    }
    // ヘルプメッセージ
    else {
      console.log('未対応のメッセージ:', userMessage);
      replyText = '使い方:\n\n【買い物リスト】\n・「買い物追加　牛乳」でアイテム追加\n・「買い物追加　パン、バナナ、トマト」で複数アイテム追加（読点区切り）\n・「買い物追加　パン　バナナ　トマト」で複数アイテム追加（スペース区切り）\n・「買い物削除　卵」でアイテム削除\n・「買い物削除　パン、バナナ、トマト」で複数アイテム削除（読点区切り）\n・「買い物削除　パン　バナナ　トマト」で複数アイテム削除（スペース区切り）\n・「買い物一覧」でリスト表示\n\n【タスクリスト】\n・「タスク追加　掃除」でタスク追加\n・「タスク追加　洗濯、料理、買い物」で複数タスク追加（読点区切り）\n・「タスク追加　掃除　洗濯　料理」で複数タスク追加（スペース区切り）\n・「タスク削除　洗濯」でタスク削除\n・「タスク削除　掃除、洗濯、料理」で複数タスク削除（読点区切り）\n・「タスク削除　掃除　洗濯　料理」で複数タスク削除（スペース区切り）\n・「タスク一覧」でリスト表示';
    }

    console.log('返信テキスト:', replyText);
    replyToUser(replyToken, replyText);

  } catch (error) {
    console.error('doPostでエラーが発生:', error);
    console.error('エラースタック:', error.stack);
  }
}

/**
 * スプレッドシートのシート1（買い物リスト）にアイテムを追加する関数
 * @param {string} item - 追加するアイテム名
 */
function addShoppingItemToSheet(item) {
  try {
    console.log('=== addShoppingItemToSheet開始 ===');
    console.log('追加アイテム:', item);

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    console.log('スプレッドシートID:', spreadsheet.getId());

    const sheet = spreadsheet.getSheets()[0]; // シート1（買い物リスト）
    console.log('シート名:', sheet.getName());

    const timestamp = new Date();
    console.log('タイムスタンプ:', timestamp);

    sheet.appendRow([item, timestamp]);
    console.log('買い物アイテム追加完了');

  } catch (error) {
    console.error('addShoppingItemToSheetでエラーが発生:', error);
    throw error;
  }
}

/**
 * スプレッドシートのシート1（買い物リスト）からアイテムを削除する関数
 * @param {string} item - 削除するアイテム名
 * @returns {boolean} 削除成功時true、失敗時false
 */
function deleteShoppingItemFromSheet(item) {
  try {
    console.log('=== deleteShoppingItemFromSheet開始 ===');
    console.log('削除アイテム:', item);

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]; // シート1（買い物リスト）
    const data = sheet.getDataRange().getValues();

    console.log('シートデータ行数:', data.length);
    console.log('シートデータ:', JSON.stringify(data, null, 2));

    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === item) {
        console.log('削除対象行:', i + 1);
        sheet.deleteRow(i + 1); // スプレッドシートは1始まり
        console.log('買い物アイテム削除完了');
        return true;
      }
    }

    console.log('削除対象アイテムが見つかりませんでした');
    return false;

  } catch (error) {
    console.error('deleteShoppingItemFromSheetでエラーが発生:', error);
    return false;
  }
}

/**
 * スプレッドシートのシート1（買い物リスト）から一覧を取得する関数
 * @returns {string} 一覧テキスト
 */
function getShoppingListFromSheet() {
  try {
    console.log('=== getShoppingListFromSheet開始 ===');

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]; // シート1（買い物リスト）
    const data = sheet.getDataRange().getValues();

    console.log('シートデータ行数:', data.length);
    console.log('シートデータ:', JSON.stringify(data, null, 2));

    if (data.length === 0) {
      console.log('買い物リストは空です');
      return '買い物リストは空です。';
    }

    const list = data.map(row => `・${row[0]}`).join('\n');
    const result = `現在の買い物リスト:\n${list}`;

    console.log('買い物一覧取得完了:', result);
    return result;

  } catch (error) {
    console.error('getShoppingListFromSheetでエラーが発生:', error);
    return '買い物リストの取得に失敗しました。';
  }
}

/**
 * スプレッドシートのシート2（タスクリスト）にタスクを追加する関数
 * @param {string} task - 追加するタスク名
 */
function addTaskToSheet(task) {
  try {
    console.log('=== addTaskToSheet開始 ===');
    console.log('追加タスク:', task);

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    console.log('スプレッドシートID:', spreadsheet.getId());

    // シート2が存在しない場合は作成
    let sheet;
    if (spreadsheet.getSheets().length < 2) {
      sheet = spreadsheet.insertSheet('シート2');
      console.log('シート2を作成しました');
    } else {
      sheet = spreadsheet.getSheets()[1]; // シート2（タスクリスト）
    }
    console.log('シート名:', sheet.getName());

    const timestamp = new Date();
    console.log('タイムスタンプ:', timestamp);

    sheet.appendRow([task, timestamp]);
    console.log('タスク追加完了');

  } catch (error) {
    console.error('addTaskToSheetでエラーが発生:', error);
    throw error;
  }
}

/**
 * スプレッドシートのシート2（タスクリスト）からタスクを削除する関数
 * @param {string} task - 削除するタスク名
 * @returns {boolean} 削除成功時true、失敗時false
 */
function deleteTaskFromSheet(task) {
  try {
    console.log('=== deleteTaskFromSheet開始 ===');
    console.log('削除タスク:', task);

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet;

    // シート2が存在しない場合はfalseを返す
    if (spreadsheet.getSheets().length < 2) {
      console.log('シート2が存在しません');
      return false;
    }

    sheet = spreadsheet.getSheets()[1]; // シート2（タスクリスト）
    const data = sheet.getDataRange().getValues();

    console.log('シートデータ行数:', data.length);
    console.log('シートデータ:', JSON.stringify(data, null, 2));

    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === task) {
        console.log('削除対象行:', i + 1);
        sheet.deleteRow(i + 1); // スプレッドシートは1始まり
        console.log('タスク削除完了');
        return true;
      }
    }

    console.log('削除対象タスクが見つかりませんでした');
    return false;

  } catch (error) {
    console.error('deleteTaskFromSheetでエラーが発生:', error);
    return false;
  }
}

/**
 * スプレッドシートのシート2（タスクリスト）から一覧を取得する関数
 * @returns {string} 一覧テキスト
 */
function getTaskListFromSheet() {
  try {
    console.log('=== getTaskListFromSheet開始 ===');

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet;

    // シート2が存在しない場合は空のリストを返す
    if (spreadsheet.getSheets().length < 2) {
      console.log('シート2が存在しません');
      return 'タスクリストは空です。';
    }

    sheet = spreadsheet.getSheets()[1]; // シート2（タスクリスト）
    const data = sheet.getDataRange().getValues();

    console.log('シートデータ行数:', data.length);
    console.log('シートデータ:', JSON.stringify(data, null, 2));

    if (data.length === 0) {
      console.log('タスクリストは空です');
      return 'タスクリストは空です。';
    }

    const list = data.map(row => `・${row[0]}`).join('\n');
    const result = `現在のタスクリスト:\n${list}`;

    console.log('タスク一覧取得完了:', result);
    return result;

  } catch (error) {
    console.error('getTaskListFromSheetでエラーが発生:', error);
    return 'タスクリストの取得に失敗しました。';
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
            text: '買い物一覧'
          }
        }]
      })
    }
  };

  doPost(testEvent);
  console.log('=== 基本的なテスト完了 ===');
}

/**
 * 買い物アイテム追加のテスト用関数
 */
function testAddShoppingItem() {
  console.log('=== 買い物アイテム追加テスト開始 ===');

  // テスト用のイベントオブジェクトを作成
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-add-shopping-token',
          message: {
            text: '買い物追加　テストアイテム'
          }
        }]
      })
    }
  };

  doPost(testEvent);
  console.log('=== 買い物アイテム追加テスト完了 ===');
}

/**
 * 複数買い物アイテム追加のテスト用関数（読点区切り）
 */
function testAddMultipleShoppingItems() {
  console.log('=== 複数買い物アイテム追加テスト開始（読点区切り） ===');

  // テスト用のイベントオブジェクトを作成
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-add-multiple-shopping-token',
          message: {
            text: '買い物追加　パン、バナナ、トマト、牛乳'
          }
        }]
      })
    }
  };

  doPost(testEvent);
  console.log('=== 複数買い物アイテム追加テスト完了（読点区切り） ===');
}

/**
 * 複数買い物アイテム追加のテスト用関数（スペース区切り）
 */
function testAddMultipleShoppingItemsWithSpace() {
  console.log('=== 複数買い物アイテム追加テスト開始（スペース区切り） ===');

  // テスト用のイベントオブジェクトを作成
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-add-multiple-shopping-space-token',
          message: {
            text: '買い物追加　パン　バナナ　トマト　牛乳'
          }
        }]
      })
    }
  };

  doPost(testEvent);
  console.log('=== 複数買い物アイテム追加テスト完了（スペース区切り） ===');
}

/**
 * 買い物アイテム削除のテスト用関数
 */
function testDeleteShoppingItem() {
  console.log('=== 買い物アイテム削除テスト開始 ===');

  // テスト用のイベントオブジェクトを作成
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-delete-shopping-token',
          message: {
            text: '買い物削除　テストアイテム'
          }
        }]
      })
    }
  };

  doPost(testEvent);
  console.log('=== 買い物アイテム削除テスト完了 ===');
}

/**
 * 複数買い物アイテム削除のテスト用関数（読点区切り）
 */
function testDeleteMultipleShoppingItems() {
  console.log('=== 複数買い物アイテム削除テスト開始（読点区切り） ===');

  // テスト用のイベントオブジェクトを作成
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-delete-multiple-shopping-token',
          message: {
            text: '買い物削除　パン、バナナ、トマト'
          }
        }]
      })
    }
  };

  doPost(testEvent);
  console.log('=== 複数買い物アイテム削除テスト完了（読点区切り） ===');
}

/**
 * 複数買い物アイテム削除のテスト用関数（スペース区切り）
 */
function testDeleteMultipleShoppingItemsWithSpace() {
  console.log('=== 複数買い物アイテム削除テスト開始（スペース区切り） ===');

  // テスト用のイベントオブジェクトを作成
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-delete-multiple-shopping-space-token',
          message: {
            text: '買い物削除　パン　バナナ　トマト'
          }
        }]
      })
    }
  };

  doPost(testEvent);
  console.log('=== 複数買い物アイテム削除テスト完了（スペース区切り） ===');
}

/**
 * 買い物一覧取得のテスト用関数
 */
function testGetShoppingList() {
  console.log('=== 買い物一覧取得テスト開始 ===');

  // テスト用のイベントオブジェクトを作成
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-list-shopping-token',
          message: {
            text: '買い物一覧'
          }
        }]
      })
    }
  };

  doPost(testEvent);
  console.log('=== 買い物一覧取得テスト完了 ===');
}

/**
 * タスク追加のテスト用関数
 */
function testAddTask() {
  console.log('=== タスク追加テスト開始 ===');

  // テスト用のイベントオブジェクトを作成
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-add-task-token',
          message: {
            text: 'タスク追加　テストタスク'
          }
        }]
      })
    }
  };

  doPost(testEvent);
  console.log('=== タスク追加テスト完了 ===');
}

/**
 * 複数タスク追加のテスト用関数（読点区切り）
 */
function testAddMultipleTasks() {
  console.log('=== 複数タスク追加テスト開始（読点区切り） ===');

  // テスト用のイベントオブジェクトを作成
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-add-multiple-task-token',
          message: {
            text: 'タスク追加　掃除、洗濯、料理、買い物'
          }
        }]
      })
    }
  };

  doPost(testEvent);
  console.log('=== 複数タスク追加テスト完了（読点区切り） ===');
}

/**
 * 複数タスク追加のテスト用関数（スペース区切り）
 */
function testAddMultipleTasksWithSpace() {
  console.log('=== 複数タスク追加テスト開始（スペース区切り） ===');

  // テスト用のイベントオブジェクトを作成
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-add-multiple-task-space-token',
          message: {
            text: 'タスク追加　掃除　洗濯　料理　買い物'
          }
        }]
      })
    }
  };

  doPost(testEvent);
  console.log('=== 複数タスク追加テスト完了（スペース区切り） ===');
}

/**
 * タスク削除のテスト用関数
 */
function testDeleteTask() {
  console.log('=== タスク削除テスト開始 ===');

  // テスト用のイベントオブジェクトを作成
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-delete-task-token',
          message: {
            text: 'タスク削除　テストタスク'
          }
        }]
      })
    }
  };

  doPost(testEvent);
  console.log('=== タスク削除テスト完了 ===');
}

/**
 * 複数タスク削除のテスト用関数（読点区切り）
 */
function testDeleteMultipleTasks() {
  console.log('=== 複数タスク削除テスト開始（読点区切り） ===');

  // テスト用のイベントオブジェクトを作成
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-delete-multiple-task-token',
          message: {
            text: 'タスク削除　掃除、洗濯、料理'
          }
        }]
      })
    }
  };

  doPost(testEvent);
  console.log('=== 複数タスク削除テスト完了（読点区切り） ===');
}

/**
 * 複数タスク削除のテスト用関数（スペース区切り）
 */
function testDeleteMultipleTasksWithSpace() {
  console.log('=== 複数タスク削除テスト開始（スペース区切り） ===');

  // テスト用のイベントオブジェクトを作成
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-delete-multiple-task-space-token',
          message: {
            text: 'タスク削除　掃除　洗濯　料理'
          }
        }]
      })
    }
  };

  doPost(testEvent);
  console.log('=== 複数タスク削除テスト完了（スペース区切り） ===');
}

/**
 * タスク一覧取得のテスト用関数
 */
function testGetTaskList() {
  console.log('=== タスク一覧取得テスト開始 ===');

  // テスト用のイベントオブジェクトを作成
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-list-task-token',
          message: {
            text: 'タスク一覧'
          }
        }]
      })
    }
  };

  doPost(testEvent);
  console.log('=== タスク一覧取得テスト完了 ===');
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

    const sheets = spreadsheet.getSheets();
    console.log('シート数:', sheets.length);

    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      console.log(`シート${i + 1}名:`, sheet.getName());
      console.log(`シート${i + 1}の行数:`, sheet.getLastRow());
      console.log(`シート${i + 1}の列数:`, sheet.getLastColumn());

      const data = sheet.getDataRange().getValues();
      console.log(`シート${i + 1}データ行数:`, data.length);
      console.log(`シート${i + 1}データ内容:`, JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error('スプレッドシート確認でエラー:', error);
  }
}
