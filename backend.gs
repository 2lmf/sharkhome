/**
 * SharkHome Backend - Google Apps Script
 * Deploy as Web App: "Execute as: Me", "Who has access: Anyone"
 */

const SHEET_ID = '1JfZVUq_mM1RBvmuorpDhjUtF5-ltvcgAM1Af8Lm1OuU';

function doGet(e) {
  const action = e.parameter.action;
  const sheet = SpreadsheetApp.openById(SHEET_ID);
  
  if (action === 'getShoppingList') {
    const data = getSheetData(sheet, 'ShoppingList');
    return createResponse(data);
  }
  
  if (action === 'getExpenses') {
    const data = getSheetData(sheet, 'Expenses');
    return createResponse(data);
  }

  return createResponse({ status: 'ok', message: 'SharkHome API is live' });
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const action = body.action;
  const sheet = SpreadsheetApp.openById(SHEET_ID);

  if (action === 'updateShopping') {
    updateSheet(sheet, 'ShoppingList', body.data);
    return createResponse({ status: 'success' });
  }

  if (action === 'addExpense') {
    appendRow(sheet, 'Expenses', body.data);
    return createResponse({ status: 'success' });
  }

  return createResponse({ status: 'error', message: 'Unknown action' });
}

// Helpers
function getSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  
  const headers = values[0];
  return values.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function updateSheet(ss, sheetName, dataList) {
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  sheet.clear();
  
  if (dataList.length === 0) {
    sheet.appendRow(['id', 'text', 'completed', 'timestamp']);
    return;
  }
  
  const headers = Object.keys(dataList[0]);
  sheet.appendRow(headers);
  dataList.forEach(item => {
    sheet.appendRow(headers.map(h => item[h]));
  });
}

function appendRow(ss, sheetName, data) {
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  const headers = Object.keys(data);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  sheet.appendRow(headers.map(h => data[h]));
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
