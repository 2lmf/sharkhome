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
    : ['id', 'text', 'completed', 'recipient', 'timestamp'];

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

  // v2.1: Track changes for email notifications
  if (sheetName === 'ShoppingList' && dataList.length > 0) {
    PropertiesService.getScriptProperties().setProperty('LAST_CHANGE', new Date().getTime().toString());
  }
}

/**
 * Hourly Trigger Function: Checks if Shopping List changed and sends targeted emails
 */
function checkAndNotifyShoppingList() {
  const props = PropertiesService.getScriptProperties();
  const lastChange = parseInt(props.getProperty('LAST_CHANGE') || "0");
  const lastNotified = parseInt(props.getProperty('LAST_NOTIFIED') || "0");

  if (lastChange > lastNotified) {
    const data = getSheetData(SpreadsheetApp.openById(SHEET_ID), 'ShoppingList');
    if (data.length === 0) return;

    // Filter items added after last notification that have a recipient
    const uncompleted = data.filter(item => !item.completed && item.recipient);
    
    if (uncompleted.length === 0) return;

    // Group items by recipient
    const mailGroups = {};
    uncompleted.forEach(item => {
      const rec = item.recipient.trim().toLowerCase();
      if (!mailGroups[rec]) mailGroups[rec] = [];
      mailGroups[rec].push(item.text);
    });

    // Send personalized emails
    for (const recipient in mailGroups) {
      const itemsText = mailGroups[recipient].map(t => "- " + t).join("\n");
      const subject = "Novi upis u popis za dućan 🛒";
      const body = "Pozdrav,\n\nImaš nove stavke na popisu za dućan:\n\n" + itemsText + "\n\nSretna kupnja!\nSharkHome";
      
      try {
        MailApp.sendEmail(recipient, subject, body);
        Logger.log("Email poslan na: " + recipient);
      } catch (e) {
        Logger.log("Greška pri slanju na " + recipient + ": " + e.message);
      }
    }
    
    // Update notified timestamp
    props.setProperty('LAST_NOTIFIED', lastChange.toString());
  } else {
    Logger.log("Nema novih promjena za obavijesti.");
  }
}


/**
 * Pomoćna funkcija za JSON odgovor
 */
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
