// ====================================================
// Vibella CRM → Google Sheets Sync Script
// ====================================================
// Deploy as Web App:
//   Execute as: Me
//   Who has access: Anyone
// ====================================================

var SHEET_ID = "1uiQBdwqqZeXMQht0fyxmG8no09-Phuhh0tX5K78NQNs";

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    
    // ── Batch export from CRM (multiple orders) ──
    if (data.orders && Array.isArray(data.orders)) {
      var orders = data.orders;
      var allData = sheet.getDataRange().getValues();
      var existingIds = {};
      for (var i = 1; i < allData.length; i++) {
        existingIds[String(allData[i][0]).replace("#","")] = i + 1; // row number
      }
      
      var newRows = [];
      for (var j = 0; j < orders.length; j++) {
        var o = orders[j];
        var cleanId = String(o.orderId).replace("#","");
        var row = [
          "#" + cleanId,
          "Vibella",
          o.customer || "",
          o.phone || "",
          o.notes || "",
          o.area || "",
          o.address || "",
          o.governorate || "",
          o.content || "",
          o.quantity || 1,
          o.amount || 0,
          o.status || "",
          o.date || ""
        ];
        
        // If order exists → update row
        if (existingIds[cleanId]) {
          sheet.getRange(existingIds[cleanId], 1, 1, 13).setValues([row]);
        } else {
          newRows.push(row);
        }
      }
      
      // Append all new rows at once (faster)
      if (newRows.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 13).setValues(newRows);
      }
      
      return ContentService.createTextOutput(
        JSON.stringify({ success: true, added: newRows.length, updated: orders.length - newRows.length })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ── Single order from Supabase Webhook ──
    var record = data.record;
    if (!record) return ContentService.createTextOutput("no record");
    
    var orderId = record.order_number || record.id || "";
    var type = data.type;
    
    if (type === "UPDATE") {
      var allData2 = sheet.getDataRange().getValues();
      for (var k = 1; k < allData2.length; k++) {
        if (String(allData2[k][0]).replace("#","") === String(orderId).replace("#","")) {
          sheet.getRange(k + 1, 1, 1, 13).setValues([[
            "#" + String(orderId).replace("#",""),
            "Vibella",
            record.customer_name || "",
            record.phone || "",
            record.notes || "",
            record.address || "",
            record.address || "",
            record.governorate || "",
            record.notes || "",
            record.quantity || 1,
            record.total_amount || 0,
            record.status || "",
            record.created_at ? new Date(record.created_at).toLocaleDateString("ar-EG") : ""
          ]]);
          return ContentService.createTextOutput("updated");
        }
      }
    }
    
    sheet.appendRow([
      "#" + String(orderId).replace("#",""),
      "Vibella",
      record.customer_name || "",
      record.phone || "",
      record.notes || "",
      record.address || "",
      record.address || "",
      record.governorate || "",
      record.notes || "",
      record.quantity || 1,
      record.total_amount || 0,
      record.status || "",
      record.created_at ? new Date(record.created_at).toLocaleDateString("ar-EG") : ""
    ]);
    
    return ContentService.createTextOutput("ok");
  } catch(err) {
    return ContentService.createTextOutput("error: " + err.message);
  }
}
