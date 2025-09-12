/**
 * LINE Messaging API 買い物リスト・タスクリストBot
 *
 * 主な仕様:
 * - LINEからのメッセージを受信し、買い物リストとタスクリストを管理
 * - スプレッドシートにアイテムの追加・削除・一覧表示機能
 * - シート1: 買い物リスト、シート2: タスクリスト、シート3: リマインド設定
 * - リマインド機能: 指定時間に買い物リスト・タスクリストを自動送信
 * - デバッグ用ログ出力機能付き
 *
 * 制限事項:
 * - チャンネルアクセストークンの有効期限に注意
 * - スプレッドシートの権限設定が必要
 * - リマインド機能はGoogle Apps Scriptのトリガー制限に依存
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
    // リマインド関連のコマンド
    else if (normalizedMessage.match(/^買い物通知\s+/)) {
      const timeText = normalizedMessage.replace(/^買い物通知\s+/, '').trim();
      console.log('買い物リマインド設定時間:', timeText);
      if (timeText) {
        const result = setReminder('shopping', timeText);
        replyText = result;
      }
    } else if (normalizedMessage.match(/^タスク通知\s+/)) {
      const timeText = normalizedMessage.replace(/^タスク通知\s+/, '').trim();
      console.log('タスクリマインド設定時間:', timeText);
      if (timeText) {
        const result = setReminder('task', timeText);
        replyText = result;
      }
    } else if (normalizedMessage.match(/^リマインド削除\s+/)) {
      const timeText = normalizedMessage.replace(/^リマインド削除\s+/, '').trim();
      console.log('リマインド削除時間:', timeText);
      if (timeText) {
        const result = deleteReminder(timeText);
        replyText = result;
      }
    } else if (userMessage === 'リマインド一覧') {
      console.log('リマインド一覧表示リクエスト');
      replyText = getReminderListFromSheet();
    }
    // ヘルプメッセージ
    else {
      console.log('未対応のメッセージ:', userMessage);
      replyText = '使い方:\n\n【買い物リスト】\n・「買い物追加　牛乳」でアイテム追加\n・「買い物追加　パン、バナナ、トマト」で複数アイテム追加（読点区切り）\n・「買い物追加　パン　バナナ　トマト」で複数アイテム追加（スペース区切り）\n・「買い物削除　卵」でアイテム削除\n・「買い物削除　パン、バナナ、トマト」で複数アイテム削除（読点区切り）\n・「買い物削除　パン　バナナ　トマト」で複数アイテム削除（スペース区切り）\n・「買い物一覧」でリスト表示\n\n【タスクリスト】\n・「タスク追加　掃除」でタスク追加\n・「タスク追加　洗濯、料理、買い物」で複数タスク追加（読点区切り）\n・「タスク追加　掃除　洗濯　料理」で複数タスク追加（スペース区切り）\n・「タスク削除　洗濯」でタスク削除\n・「タスク削除　掃除、洗濯、料理」で複数タスク削除（読点区切り）\n・「タスク削除　掃除　洗濯　料理」で複数タスク削除（スペース区切り）\n・「タスク一覧」でリスト表示\n\n【リマインド機能】\n・「買い物通知　12」で12時に買い物リストをリマインド\n・「タスク通知　9」で9時にタスクリストをリマインド\n・「リマインド削除　12」で12時のリマインドを削除\n・「リマインド一覧」で設定済みリマインドを表示';
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
 * リマインド設定をスプレッドシートのシート3に保存する関数
 * @param {string} type - リマインドタイプ（'shopping' または 'task'）
 * @param {string} timeText - 時間テキスト（例：'12', '9'）
 * @returns {string} 設定結果メッセージ
 */
function setReminder(type, timeText) {
  try {
    console.log('=== setReminder開始 ===');
    console.log('リマインドタイプ:', type);
    console.log('時間テキスト:', timeText);

    // 時間の検証（0-23の整数）
    const hour = parseInt(timeText);
    if (isNaN(hour) || hour < 0 || hour > 23) {
      return '時間は0〜23の数字で入力してください。例：9、12、23';
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    // シート3が存在しない場合は作成
    let sheet;
    if (spreadsheet.getSheets().length < 3) {
      sheet = spreadsheet.insertSheet('シート3');
      // ヘッダー行を追加
      sheet.getRange(1, 1, 1, 4).setValues([['タイプ', '時間', '有効', '作成日時']]);
      console.log('シート3を作成しました');
    } else {
      sheet = spreadsheet.getSheets()[2]; // シート3（リマインド設定）
    }

    // 既存のリマインド設定を確認
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) { // ヘッダー行をスキップ
      if (data[i][0] === type && data[i][1] === hour) {
        return `${type === 'shopping' ? '買い物' : 'タスク'}の${hour}時のリマインドは既に設定されています。`;
      }
    }

    // 新しいリマインド設定を追加
    const timestamp = new Date();
    sheet.appendRow([type, hour, true, timestamp]);

    // トリガーを設定
    setupReminderTrigger(hour);

    console.log('リマインド設定完了');
    return `${type === 'shopping' ? '買い物' : 'タスク'}の${hour}時のリマインドを設定しました。`;

  } catch (error) {
    console.error('setReminderでエラーが発生:', error);
    return 'リマインド設定に失敗しました。';
  }
}

/**
 * リマインド設定を削除する関数
 * @param {string} timeText - 時間テキスト（例：'12', '9'）
 * @returns {string} 削除結果メッセージ
 */
function deleteReminder(timeText) {
  try {
    console.log('=== deleteReminder開始 ===');
    console.log('削除時間:', timeText);

    // 時間の検証
    const hour = parseInt(timeText);
    if (isNaN(hour) || hour < 0 || hour > 23) {
      return '時間は0〜23の数字で入力してください。例：9、12、23';
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    // シート3が存在しない場合は何もしない
    if (spreadsheet.getSheets().length < 3) {
      return 'リマインド設定が見つかりませんでした。';
    }

    const sheet = spreadsheet.getSheets()[2]; // シート3（リマインド設定）
    const data = sheet.getDataRange().getValues();

    let deletedCount = 0;
    for (let i = data.length - 1; i >= 1; i--) { // ヘッダー行をスキップ、逆順で削除
      if (data[i][1] === hour) {
        sheet.deleteRow(i + 1); // スプレッドシートは1始まり
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log('リマインド削除完了');
      return `${hour}時のリマインドを${deletedCount}件削除しました。`;
    } else {
      return `${hour}時のリマインド設定が見つかりませんでした。`;
    }

  } catch (error) {
    console.error('deleteReminderでエラーが発生:', error);
    return 'リマインド削除に失敗しました。';
  }
}

/**
 * リマインド一覧を取得する関数
 * @returns {string} リマインド一覧テキスト
 */
function getReminderListFromSheet() {
  try {
    console.log('=== getReminderListFromSheet開始 ===');

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    // シート3が存在しない場合は空のリストを返す
    if (spreadsheet.getSheets().length < 3) {
      console.log('シート3が存在しません');
      return 'リマインド設定はありません。';
    }

    const sheet = spreadsheet.getSheets()[2]; // シート3（リマインド設定）
    const data = sheet.getDataRange().getValues();

    console.log('シートデータ行数:', data.length);
    console.log('シートデータ:', JSON.stringify(data, null, 2));

    if (data.length <= 1) { // ヘッダー行のみ
      console.log('リマインド設定はありません');
      return 'リマインド設定はありません。';
    }

    const reminders = [];
    for (let i = 1; i < data.length; i++) { // ヘッダー行をスキップ
      const type = data[i][0];
      const hour = data[i][1];
      const enabled = data[i][2];
      const typeText = type === 'shopping' ? '買い物' : 'タスク';
      const statusText = enabled ? '有効' : '無効';
      reminders.push(`${typeText} ${hour}時 (${statusText})`);
    }

    const result = `現在のリマインド設定:\n${reminders.join('\n')}`;
    console.log('リマインド一覧取得完了:', result);
    return result;

  } catch (error) {
    console.error('getReminderListFromSheetでエラーが発生:', error);
    return 'リマインド一覧の取得に失敗しました。';
  }
}

/**
 * リマインド送信用のトリガーを設定する関数
 * @param {number} hour - 時間（0-23）
 */
function setupReminderTrigger(hour) {
  try {
    console.log('=== setupReminderTrigger開始 ===');
    console.log('設定時間:', hour);

    // PropertiesServiceを使用してトリガーIDを管理
    const properties = PropertiesService.getScriptProperties();
    const triggerIdKey = 'reminderTriggerId';

    // 既存のトリガーIDを取得
    const existingTriggerId = properties.getProperty(triggerIdKey);

    // 既存のトリガーが存在する場合、そのトリガーのみを削除
    if (existingTriggerId) {
      try {
        const triggers = ScriptApp.getProjectTriggers();
        const targetTrigger = triggers.find(trigger =>
          trigger.getUniqueId() === existingTriggerId &&
          trigger.getHandlerFunction() === 'sendReminder' &&
          trigger.getEventType() === ScriptApp.EventType.CLOCK
        );

        if (targetTrigger) {
          ScriptApp.deleteTrigger(targetTrigger);
          console.log('既存のトリガーを削除:', existingTriggerId);
        }
      } catch (deleteError) {
        console.warn('既存トリガーの削除でエラー（無視）:', deleteError);
      }

      // プロパティからトリガーIDを削除
      properties.deleteProperty(triggerIdKey);
    }

    // 新しいトリガーを設定（毎日指定時間に実行）
    const trigger = ScriptApp.newTrigger('sendReminder')
      .timeBased()
      .everyDays(1)
      .atHour(hour)
      .create();

    // 新しいトリガーのIDを保存
    properties.setProperty(triggerIdKey, trigger.getUniqueId());

    console.log('トリガー設定完了:', trigger.getUniqueId());
    console.log('トリガーIDを保存:', trigger.getUniqueId());

  } catch (error) {
    console.error('setupReminderTriggerでエラーが発生:', error);
  }
}

/**
 * リマインド送信を実行する関数（トリガーから呼び出される）
 */
function sendReminder() {
  try {
    console.log('=== sendReminder開始 ===');
    console.log('現在時刻:', new Date());

    const currentHour = new Date().getHours();
    console.log('現在の時間:', currentHour);

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    // シート3が存在しない場合は何もしない
    if (spreadsheet.getSheets().length < 3) {
      console.log('シート3が存在しません');
      return;
    }

    const sheet = spreadsheet.getSheets()[2]; // シート3（リマインド設定）
    const data = sheet.getDataRange().getValues();

    // 現在時刻のリマインド設定を確認
    for (let i = 1; i < data.length; i++) { // ヘッダー行をスキップ
      const type = data[i][0];
      const hour = data[i][1];
      const enabled = data[i][2];

      if (hour === currentHour && enabled) {
        console.log('リマインド送信対象:', type, hour);

        let message = '';
        if (type === 'shopping') {
          message = getShoppingListFromSheet();
        } else if (type === 'task') {
          message = getTaskListFromSheet();
        }

        if (message) {
          // プッシュメッセージとして送信
          sendPushMessage(message);
          console.log('リマインド送信完了:', type, hour);
        }
      }
    }

  } catch (error) {
    console.error('sendReminderでエラーが発生:', error);
  }
}

/**
 * プッシュメッセージを送信する関数
 * @param {string} message - 送信メッセージ
 */
function sendPushMessage(message) {
  try {
    console.log('=== sendPushMessage開始 ===');
    console.log('送信メッセージ:', message);

    // 注意: 実際の実装では、ユーザーIDを取得する必要があります
    // ここでは簡易実装として、チャンネルにブロードキャストメッセージを送信
    const url = 'https://api.line.me/v2/bot/message/broadcast';
    const payload = JSON.stringify({
      messages: [{
        type: 'text',
        text: message
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
      console.log('プッシュメッセージ送信完了');
    }

  } catch (error) {
    console.error('sendPushMessageでエラーが発生:', error);
    console.error('エラースタック:', error.stack);
  }
}

/**
 * 買い物リマインド設定のテスト用関数
 */
function testSetShoppingReminder() {
  console.log('=== 買い物リマインド設定テスト開始 ===');

  // テスト用のイベントオブジェクトを作成
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-shopping-reminder-token',
          message: {
            text: '買い物通知　12'
          }
        }]
      })
    }
  };

  doPost(testEvent);
  console.log('=== 買い物リマインド設定テスト完了 ===');
}

/**
 * タスクリマインド設定のテスト用関数
 */
function testSetTaskReminder() {
  console.log('=== タスクリマインド設定テスト開始 ===');

  // テスト用のイベントオブジェクトを作成
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-task-reminder-token',
          message: {
            text: 'タスク通知　9'
          }
        }]
      })
    }
  };

  doPost(testEvent);
  console.log('=== タスクリマインド設定テスト完了 ===');
}

/**
 * リマインド削除のテスト用関数
 */
function testDeleteReminder() {
  console.log('=== リマインド削除テスト開始 ===');

  // テスト用のイベントオブジェクトを作成
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-delete-reminder-token',
          message: {
            text: 'リマインド削除　12'
          }
        }]
      })
    }
  };

  doPost(testEvent);
  console.log('=== リマインド削除テスト完了 ===');
}

/**
 * リマインド一覧取得のテスト用関数
 */
function testGetReminderList() {
  console.log('=== リマインド一覧取得テスト開始 ===');

  // テスト用のイベントオブジェクトを作成
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        events: [{
          type: 'message',
          replyToken: 'test-reminder-list-token',
          message: {
            text: 'リマインド一覧'
          }
        }]
      })
    }
  };

  doPost(testEvent);
  console.log('=== リマインド一覧取得テスト完了 ===');
}

/**
 * リマインド送信のテスト用関数（手動実行用）
 */
function testSendReminder() {
  console.log('=== リマインド送信テスト開始 ===');

  try {
    // 手動でリマインド送信を実行
    sendReminder();
    console.log('=== リマインド送信テスト完了 ===');
  } catch (error) {
    console.error('リマインド送信テストでエラー:', error);
  }
}

/**
 * リマインド機能の総合テスト用関数
 */
function testReminderFunctions() {
  console.log('=== リマインド機能総合テスト開始 ===');

  try {
    // 1. 買い物リマインド設定
    console.log('1. 買い物リマインド設定テスト');
    testSetShoppingReminder();

    // 2. タスクリマインド設定
    console.log('2. タスクリマインド設定テスト');
    testSetTaskReminder();

    // 3. リマインド一覧取得
    console.log('3. リマインド一覧取得テスト');
    testGetReminderList();

    // 4. リマインド削除
    console.log('4. リマインド削除テスト');
    testDeleteReminder();

    // 5. 最終確認
    console.log('5. 最終確認');
    testGetReminderList();

    console.log('=== リマインド機能総合テスト完了 ===');
  } catch (error) {
    console.error('リマインド機能総合テストでエラー:', error);
  }
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
