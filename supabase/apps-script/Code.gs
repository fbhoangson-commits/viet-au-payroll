/** VIET AU PAYROLL - Gmail Workspace PDF mail gateway.
 * Script Properties required: PAYROLL_EMAIL_TOKEN
 * Deploy as Web App: Execute as Me; access Anyone.
 */
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({success:true,service:'VIET_AU_PAYROLL_EMAIL',status:'READY'})).setMimeType(ContentService.MimeType.JSON);
}
function doPost(e) {
  try {
    var payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var expected = PropertiesService.getScriptProperties().getProperty('PAYROLL_EMAIL_TOKEN');
    if (!expected || !payload.token || payload.token !== expected) return output_({success:false,error:'UNAUTHORIZED'});
    var to = String(payload.to || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return output_({success:false,error:'INVALID_RECIPIENT'});
    var html = String(payload.html || '');
    if (html.length < 300 || !/^\s*<!doctype html/i.test(html)) return output_({success:false,error:'INVALID_PAYSLIP_HTML'});
    var filename = String(payload.filename || 'PHIEU_LUONG.pdf').replace(/[\\/:*?"<>|]/g, '_').slice(0,150);
    var pdf = HtmlService.createHtmlOutput(html).getBlob().getAs(MimeType.PDF).setName(filename);
    var options = {htmlBody:String(payload.html_body || ''), attachments:[pdf], name:'PHÒNG TÀI CHÍNH – TRƯỜNG THPT VIỆT ÂU'};
    GmailApp.sendEmail(to, String(payload.subject || '[VIỆT ÂU] Phiếu lương'), String(payload.text_body || 'Trường THPT Việt Âu gửi phiếu lương đính kèm.'), options);
    return output_({success:true});
  } catch (err) {
    console.error(err);
    return output_({success:false,error:String(err && err.message || err)});
  }
}
function output_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
