/**
 * SharkHome Backend - Google Apps Script (v1.5)
 * Deploy as Web App: "Execute as: Me", "Who has access: Anyone"
 */

const SHEET_ID = '1JfZVUq_mM1RBvmuorpDhjUtF5-ltvcgAM1Af8Lm1OuU';

function doGet(e) {
  if (!e || !e.parameter) {
    return ContentService.createTextOutput("SharkHome API is active. Test this via the app!")
      .setMimeType(ContentService.MimeType.TEXT);
  }
  
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

  if (action === 'updateExpenses') {
    updateSheet(sheet, 'Expenses', body.data);
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
  
  let headers = (sheetName === 'Expenses') 
    ? ['id', 'category', 'amount', 'description', 'date'] 
    : ['id', 'text', 'completed', 'timestamp'];

  sheet.appendRow(headers);
  if (dataList.length === 0) return;
  
  dataList.forEach(item => {
    const row = headers.map(h => {
      let val = item[h];
      
      // Robust number formatting for Excel (1.234,50) - avoiding Intl.NumberFormat
      if (h === 'amount' && typeof val === 'number') {
        var parts = val.toFixed(2).split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return parts.join(",");
      }
      
      // Format ISO dates to readable Croatian format
      if (typeof val === 'string' && val.includes('T') && val.includes('Z')) {
        try {
            return Utilities.formatDate(new Date(val), "GMT+1", "dd.MM.yyyy. HH:mm");
        } catch(e) { return val; }
      }
      
      return val;
    });
    sheet.appendRow(row);
  });
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Test function
function testMe() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('Test');
  if (!sheet) ss.insertSheet('Test');
  ss.getSheetByName('Test').appendRow(['Uspješno povezano!', new Date().toISOString()]);
  Logger.log('Veza radi!');
}
