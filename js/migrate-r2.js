// One-time, signed-in migration from Supabase Storage to the private R2 bucket.
var MIG_ROWS=[],MIG_RUNNING=false;

function migLog(text){
  var el=$('log');
  el.textContent+=(el.textContent?'\n':'')+text;
  el.scrollTop=el.scrollHeight;
}
async function enter(user){
  ME={id:user.id,email:user.email};
  $('whoEmail').textContent=user.email;
  $('boot').hidden=true;$('auth').hidden=true;$('app').hidden=false;
  await scanMigration();
}
async function ownedPhotos(){
  var rows=[],from=0,size=1000;
  for(;;){
    var result=await sb.from('trip_photos').select('id,trip_id,path,user_id').eq('user_id',ME.id).order('id').range(from,from+size-1);
    if(result.error)throw result.error;
    rows=rows.concat(result.data||[]);
    if(!result.data||result.data.length<size)return rows;
    from+=size;
  }
}
async function scanMigration(){
  if(MIG_RUNNING)return;
  $('scan').disabled=true;$('migrate').disabled=true;
  try{
    var rows=await ownedPhotos();
    MIG_ROWS=rows.filter(function(row){return row.path&&row.path.indexOf('r2:')!==0});
    $('summary').textContent='你的照片共 '+rows.length+' 張；已在 R2 '+(rows.length-MIG_ROWS.length)+' 張；等待搬移 '+MIG_ROWS.length+' 張。';
    $('migrate').disabled=!MIG_ROWS.length;
  }catch(error){
    $('summary').textContent='掃描失敗：'+(error.message||error);
  }
  $('scan').disabled=false;
}
function photoId(){
  if(!crypto.randomUUID)throw new Error('瀏覽器不支援安全的照片識別碼，請更新瀏覽器');
  return crypto.randomUUID();
}
async function sourceBlob(path){
  var signed=await sb.storage.from('trip-photos').createSignedUrl(path,300);
  if(signed.error)throw signed.error;
  var response=await fetch(signed.data.signedUrl,{cache:'no-store'});
  if(!response.ok)throw new Error('無法下載 Supabase 原檔（HTTP '+response.status+'）');
  var blob=await response.blob();
  if(blob.size<3||blob.size>10*1024*1024)throw new Error('照片大小不符合 R2 限制');
  return blob;
}
async function verifyR2(path,expectedSize){
  var urls=await photoUrls([path]),url=urls[path];
  if(!url)throw new Error('R2 未回傳照片連結');
  var response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw new Error('R2 驗證讀取失敗（HTTP '+response.status+'）');
  var blob=await response.blob();
  if(blob.size!==expectedSize)throw new Error('R2 檔案大小與原檔不同');
}
async function migratePhoto(row){
  var blob=await sourceBlob(row.path);
  var target='r2:'+row.trip_id+'/'+photoId()+'.jpg',updated=false;
  await uploadPhotoFile(target,blob);
  try{
    var update=await sb.from('trip_photos').update({path:target}).eq('id',row.id).eq('user_id',ME.id).eq('path',row.path).select('id');
    if(update.error)throw update.error;
    if(!update.data||update.data.length!==1)throw new Error('照片資料已變更，請重新掃描');
    updated=true;
    await verifyR2(target,blob.size);
  }catch(error){
    if(updated){
      var rollback=await sb.from('trip_photos').update({path:row.path}).eq('id',row.id).eq('user_id',ME.id).eq('path',target).select('id');
      if(rollback.error||!rollback.data||rollback.data.length!==1){
        throw new Error('驗證失敗且資料庫無法復原；請保留 R2 檔並聯絡管理者：'+(error.message||error));
      }
    }
    try{await removePhotoFile(target)}catch(cleanupError){}
    throw error;
  }
  var removal=await sb.storage.from('trip-photos').remove([row.path]);
  return removal.error?'搬移完成，但 Supabase 原檔未能刪除：'+removal.error.message:'';
}
async function runMigration(){
  if(MIG_RUNNING||!MIG_ROWS.length)return;
  MIG_RUNNING=true;$('scan').disabled=true;$('migrate').disabled=true;$('log').textContent='';
  var ok=0,failed=0,warnings=0,rows=MIG_ROWS.slice();
  for(var i=0;i<rows.length;i++){
    migLog('['+(i+1)+'/'+rows.length+'] '+rows[i].path+'：搬移中…');
    try{
      var warning=await migratePhoto(rows[i]);ok++;
      migLog(warning?'  ⚠ '+warning:'  ✓ 完成');
      if(warning)warnings++;
    }catch(error){
      failed++;migLog('  ✗ '+(error.message||error));
    }
  }
  migLog('完成：成功 '+ok+'，失敗 '+failed+(warnings?'，原檔清除警告 '+warnings:'')+'。');
  MIG_RUNNING=false;$('scan').disabled=false;
  await scanMigration();
}
on('scan','click',scanMigration);
on('migrate','click',runMigration);
bootPage();
