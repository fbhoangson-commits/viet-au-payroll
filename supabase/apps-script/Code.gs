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
    if (payload.action === 'save_backup') return saveBackup_(payload);
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


/** MONTHLY DATABASE BACKUP GATEWAY
 * Script Properties required:
 * BACKUP_SECRET, SUPABASE_FUNCTION_URL, SUPABASE_ANON_KEY
 * Run setupMonthlyBackup() once while signed in as tckt@thptvietau.edu.vn.
 * Deploy this project as Web App: Execute as Me; access Anyone.
 */
function saveBackup_(payload) {
  var props = PropertiesService.getScriptProperties();
  var expected = props.getProperty('BACKUP_SECRET');
  if (!expected || !payload.token || payload.token !== expected) return output_({success:false,error:'BACKUP_UNAUTHORIZED'});
  var name = String(payload.file_name || '').replace(/[\\/:*?"<>|]/g, '_').slice(0,150);
  var encoded = String(payload.content_base64 || '');
  if (!/^VIET-AU-PAYROLL-BACKUP-\d{4}-\d{2}\.json\.gz$/.test(name) || !encoded) return output_({success:false,error:'INVALID_BACKUP_PAYLOAD'});
  if (encoded.length > 45 * 1024 * 1024) return output_({success:false,error:'BACKUP_TOO_LARGE_FOR_APPS_SCRIPT_GATEWAY'});
  var bytes = Utilities.base64Decode(encoded);
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  var checksum = digest.map(function(b){var v=(b<0?b+256:b).toString(16);return v.length===1?'0'+v:v;}).join('');
  if (checksum !== String(payload.checksum_sha256 || '').toLowerCase()) return output_({success:false,error:'CHECKSUM_MISMATCH'});
  var folderId = props.getProperty('BACKUP_FOLDER_ID');
  if (!folderId) return output_({success:false,error:'BACKUP_FOLDER_NOT_INITIALIZED_RUN_SETUP_MONTHLY_BACKUP'});
  var folder = DriveApp.getFolderById(folderId);
  var blob = Utilities.newBlob(bytes, 'application/gzip', name);
  var file = folder.createFile(blob);
  file.setDescription('VIET AU PAYROLL monthly database snapshot | ' + (payload.source || 'MANUAL') + ' | SHA-256: ' + checksum);
  // Keep one canonical file per month. Trash older duplicates only after new file is safely created.
  var duplicates = folder.getFilesByName(name);
  while (duplicates.hasNext()) {
    var oldFile = duplicates.next();
    if (oldFile.getId() !== file.getId()) oldFile.setTrashed(true);
  }
  return output_({success:true,file_id:file.getId(),file_url:file.getUrl(),size_bytes:bytes.length});
}

function setupMonthlyBackup() {
  var props = PropertiesService.getScriptProperties();
  ['BACKUP_SECRET','SUPABASE_FUNCTION_URL','SUPABASE_ANON_KEY'].forEach(function(key){
    if (!props.getProperty(key)) throw new Error('Missing Script Property: ' + key);
  });
  var folderName = 'VIET AU PAYROLL BACKUP';
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  props.setProperty('BACKUP_FOLDER_ID', folder.getId());
  ScriptApp.getProjectTriggers().forEach(function(trigger){
    if (trigger.getHandlerFunction() === 'scheduledBackup') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('scheduledBackup').timeBased().onMonthDay(1).atHour(23).create();
  return {success:true,folder_url:folder.getUrl(),schedule:'Ngày 01 hằng tháng, khoảng 23:00 (múi giờ dự án Apps Script)'};
}

function scheduledBackup() {
  var props = PropertiesService.getScriptProperties();
  var endpoint = props.getProperty('SUPABASE_FUNCTION_URL');
  var anon = props.getProperty('SUPABASE_ANON_KEY');
  var secret = props.getProperty('BACKUP_SECRET');
  if (!endpoint || !anon || !secret) throw new Error('Missing backup Script Properties');
  var response = UrlFetchApp.fetch(endpoint, {
    method:'post', contentType:'application/json', payload:JSON.stringify({source:'SCHEDULED'}),
    headers:{apikey:anon,'x-backup-secret':secret}, muteHttpExceptions:true
  });
  var code = response.getResponseCode();
  var text = response.getContentText();
  var result;
  try { result = JSON.parse(text); } catch (err) { throw new Error('Invalid response from backup function: HTTP ' + code); }
  if (code < 200 || code >= 300 || result.success !== true) throw new Error(result.error || ('Backup failed: HTTP ' + code));
  return result;
}

function testBackupGateway() {
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty('BACKUP_FOLDER_ID');
  if (!folderId) throw new Error('Run setupMonthlyBackup() first');
  var folder = DriveApp.getFolderById(folderId);
  return {success:true,folder_name:folder.getName(),folder_url:folder.getUrl(),file_count:folder.getFiles().hasNext()?'HAS_FILES':'EMPTY'};
}
