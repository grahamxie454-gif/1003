// ================= 行程分享頁 =================
// 照片依「行程項目」上傳：每個景點／餐廳／當地自由行旁邊都有照片按鈕，
// 打開後可新增照片（每張各自填註解）、逐張修改註解或刪除照片。
var TID='',SHARE=null,PHOTOS=[],NOTES=[],ITEMS={},pollTimer=null;
var MOD=null; // {k, name, day, pending:[{file,url,caption}]}

async function enter(user){
  $('boot').hidden=false;$('boot').textContent='載入中…';$('auth').hidden=true;
  TID=tripIdParam();
  if(!TID){$('boot').textContent='連結不正確。';return}
  try{
    var r=await sb.rpc('get_shared_trip',{p_id:TID});
    if(r.error)throw r.error;
    if(!r.data){$('boot').textContent='找不到這份行程，或擁有者尚未開啟分享。';return}
    SHARE=r.data;ME={id:user.id,email:user.email};
    $('whoEmail').textContent=user.email;
    $('sTitle').textContent=SHARE.name;
    $('sSub').textContent='擁有者：'+(SHARE.owner||'')+'　行程更新：'+fmtDT(SHARE.updated_at);
    $('goSlides').href='slideshow.html?trip='+TID;
    buildItems();
    await refresh();
    $('boot').hidden=true;$('app').hidden=false;
    clearInterval(pollTimer);
    pollTimer=setInterval(function(){
      var a=document.activeElement;
      if(!$('modal').hidden)return;
      if(a&&a.closest&&a.closest('#itin'))return;
      refresh().catch(function(){});
    },60000);
  }catch(err){
    $('boot').hidden=false;$('boot').textContent='載入失敗：'+(err.message||err);
  }
}
function buildItems(){
  ITEMS={};
  ((SHARE.share_data&&SHARE.share_data.days)||[]).forEach(function(d){
    d.rows.forEach(function(r){if(r.k)ITEMS[r.k]={name:r.n,day:d.no}});
  });
}

async function refresh(){
  var res=await Promise.all([loadPhotos(TID),sb.from('trip_notes').select('*').eq('trip_id',TID).order('created_at',{ascending:true})]);
  PHOTOS=res[0];
  if(res[1].error)throw res[1].error;
  NOTES=res[1].data;
  renderShare();
  if(MOD&&!$('modal').hidden)renderModal(true);
}

function money(c){return c>0?'約 NT$ '+(Math.round(c/10)*10).toLocaleString('zh-TW'):''}
function itemPhotos(k){return PHOTOS.filter(function(p){return p.item_key===k})}
function photoCard(p){
  var mine=p.user_id===ME.id||SHARE.is_owner,it=p.item_key&&ITEMS[p.item_key];
  return '<figure class="ph"><a href="slideshow.html?trip='+TID+'&p='+p.id+'" target="_blank" rel="noopener">'+(p.url?'<img loading="lazy" src="'+esc(p.url)+'" alt="'+esc(p.caption||'旅遊照片')+'">':'<span class="muted">無法載入</span>')+'</a>'+
    '<figcaption>'+(p.caption?'<b>'+esc(p.caption)+'</b><br>':'')+'<span class="muted">'+(it?esc(it.name)+'・':'')+esc(p.user_email)+'・上傳 '+esc(fmtDT(p.created_at))+(p.taken_at?'・拍攝 '+esc(fmtDT(p.taken_at)):'')+'</span>'+
    (mine?' <button type="button" class="ghost sm x" data-del-photo="'+esc(p.id)+'" aria-label="刪除照片">刪除</button>':'')+'</figcaption></figure>';
}
function renderShare(){
  $('photoCnt').textContent='（'+PHOTOS.length+' 張，依拍照時間排序；要新增請在下方各行程項目按「照片」）';
  $('photos').innerHTML=PHOTOS.length?PHOTOS.map(photoCard).join(''):'<p class="muted">還沒有照片。在下方行程的景點、餐廳旁按「照片」就能上傳。</p>';
  var days=(SHARE.share_data&&SHARE.share_data.days)||[],h='';
  if(!days.length)h='<p class="muted">擁有者尚未發佈行程內容。</p>';
  days.forEach(function(d){
    var notes=NOTES.filter(function(n){return n.day_no===d.no});
    h+='<article class="day"><h3>第 '+d.no+' 天'+(d.date?'<em class="date">'+esc(d.date)+'</em>':'')+'<em class="city">'+esc(d.city)+'</em></h3>';
    if(d.hotel)h+='<p class="note">住宿：'+(d.hotel.url?'<a class="maplink" href="'+esc(d.hotel.url)+'" target="_blank" rel="noopener">'+esc(d.hotel.name)+'</a>':esc(d.hotel.name))+'</p>';
    if(d.off)h+='<p class="note">今天休息，不安排行程。</p>';
    h+='<ol class="tl">'+d.rows.map(function(r){
      var cls=r.t==='move'||r.t==='hop'?'mv':(r.t==='free'||r.t==='buffer'?'fr':(r.t==='meal'?'ml':''));
      var link=/^https?:\/\//i.test(r.l||'')?r.l:'';
      var ph=r.k?itemPhotos(r.k):[];
      var tools=r.k?'<div class="mvbar"><button type="button" class="ghost sm" data-ph-open="'+esc(r.k)+'">📷 照片（'+ph.length+'）'+(ph.length?'・編輯':'・上傳')+'</button>'+
        ph.slice(0,4).map(function(p){return p.url?'<img class="thumb" data-ph-open="'+esc(r.k)+'" loading="lazy" src="'+esc(p.url)+'" alt="">':''}).join('')+'</div>':'';
      return '<li class="tr '+cls+(r.o?' over':'')+'"><div class="tt">'+minStr(r.s)+(r.e>r.s?'<small>–'+minStr(r.e)+'</small>':'')+'</div><div class="tb">'+
        (link&&r.t!=='move'?'<a class="maplink" href="'+esc(link)+'" target="_blank" rel="noopener"><b>'+esc(r.n)+'</b></a>':(cls==='mv'||cls==='fr'?'<span class="soft">'+esc(r.n)+'</span>':'<b>'+esc(r.n)+'</b>'))+
        (r.r?' <span class="rate">★ '+Number(r.r).toFixed(1)+'</span>':'')+(r.c?' <span class="muted">'+money(r.c)+'</span>':'')+tools+'</div></li>';
    }).join('')+'</ol>';
    h+='<div class="notes"><h4>留言</h4>'+(notes.length?notes.map(function(n){
      return '<p class="note2"><b>'+esc(n.user_email)+'</b> <span class="muted">'+esc(fmtDT(n.created_at))+'</span><br>'+esc(n.body)+
        ((n.user_id===ME.id||SHARE.is_owner)?' <button type="button" class="ghost sm x" data-del-note="'+esc(n.id)+'" aria-label="刪除留言">刪除</button>':'')+'</p>';
    }).join(''):'<p class="muted">還沒有留言。</p>')+
      '<div class="noterow"><input type="text" maxlength="500" data-note-in="'+d.no+'" placeholder="寫下這一天的註解或心得" aria-label="第 '+d.no+' 天留言"><button type="button" data-note-add="'+d.no+'">送出</button></div></div></article>';
  });
  $('itin').innerHTML=h;
}

// ---- 照片處理：讀取拍攝時間、縮圖、移除定位資訊 ----
async function prepPhoto(file){
  var taken=null;
  try{
    var ex=await exifr.parse(file,['DateTimeOriginal','CreateDate']);
    var d=ex&&(ex.DateTimeOriginal||ex.CreateDate);
    if(d instanceof Date&&!isNaN(d))taken=d;
  }catch(e){}
  if(!taken&&file.lastModified)taken=new Date(file.lastModified);
  var bmp=await createImageBitmap(file,{imageOrientation:'from-image'});
  var sc=Math.min(1,2000/Math.max(bmp.width,bmp.height)),cv=document.createElement('canvas');
  cv.width=Math.max(1,Math.round(bmp.width*sc));cv.height=Math.max(1,Math.round(bmp.height*sc));
  cv.getContext('2d').drawImage(bmp,0,0,cv.width,cv.height);
  var blob=await new Promise(function(res){cv.toBlob(res,'image/jpeg',0.85)});
  if(!blob)throw new Error('無法處理這張照片');
  return {blob:blob,taken:taken};
}

// ---- 行程項目的照片視窗：新增、逐張改註解、刪除 ----
function openModal(k){
  var it=ITEMS[k];if(!it)return;
  if(MOD)MOD.pending.forEach(function(p){URL.revokeObjectURL(p.url)});
  MOD={k:k,name:it.name,day:it.day,pending:[]};
  $('modal').hidden=false;
  renderModal();
  var c=$('mClose');if(c)c.focus();
}
function closeModal(){
  if(MOD)MOD.pending.forEach(function(p){URL.revokeObjectURL(p.url)});
  MOD=null;$('modal').hidden=true;
}
function renderModal(keepPending){
  if(!MOD)return;
  var ph=itemPhotos(MOD.k).sort(function(a,b){return photoTime(a)-photoTime(b)});
  $('mTitle').textContent='第 '+MOD.day+' 天・'+MOD.name;
  var h='<h3>已上傳的照片（'+ph.length+'）</h3>';
  if(!ph.length)h+='<p class="muted">這個行程還沒有照片。</p>';
  ph.forEach(function(p){
    var mine=p.user_id===ME.id;
    h+='<div class="mrow"><a href="slideshow.html?trip='+TID+'&p='+p.id+'" target="_blank" rel="noopener">'+(p.url?'<img src="'+esc(p.url)+'" alt="">':'')+'</a><div class="mcol">'+
      '<input type="text" maxlength="100" data-cap-id="'+esc(p.id)+'" value="'+esc(p.caption||'')+'" placeholder="註解"'+(mine?'':' disabled')+' aria-label="照片註解">'+
      '<span class="muted">'+esc(p.user_email)+'・上傳 '+esc(fmtDT(p.created_at))+(p.taken_at?'・拍攝 '+esc(fmtDT(p.taken_at)):'')+'</span>'+
      '<div class="mvbar">'+(mine?'<button type="button" class="sm" data-cap-save="'+esc(p.id)+'">儲存註解</button>':'')+
      ((mine||SHARE.is_owner)?'<button type="button" class="ghost sm x" data-del-photo="'+esc(p.id)+'">刪除照片</button>':'')+'</div></div></div>';
  });
  h+='<h3>新增照片</h3><input type="file" id="mFiles" accept="image/jpeg,image/png,image/webp" multiple aria-label="選擇照片">';
  MOD.pending.forEach(function(p,i){
    h+='<div class="mrow"><img src="'+esc(p.url)+'" alt=""><div class="mcol"><input type="text" maxlength="100" data-pend-cap="'+i+'" value="'+esc(p.caption)+'" placeholder="這張的註解（選填）" aria-label="新照片註解">'+
      '<div class="mvbar"><button type="button" class="ghost sm x" data-pend-del="'+i+'">移除</button></div></div></div>';
  });
  if(MOD.pending.length)h+='<div class="mvbar"><button type="button" id="mUpload">上傳 '+MOD.pending.length+' 張</button></div>';
  h+='<p class="status" id="mSt"></p>';
  $('mBody').innerHTML=h;
}
on('itin','click',async function(e){
  var o=e.target.closest('[data-ph-open]');
  if(o){openModal(o.dataset.phOpen);return}
  var b=e.target.closest('button');
  if(!b)return;
  if(b.dataset.delNote){
    var r=await sb.from('trip_notes').delete().eq('id',b.dataset.delNote);
    if(!r.error)await refresh();
  }else if(b.dataset.noteAdd){
    var inp=document.querySelector('input[data-note-in="'+b.dataset.noteAdd+'"]'),v=inp.value.trim();
    if(!v)return;
    b.disabled=true;
    var ins=await sb.from('trip_notes').insert({trip_id:TID,user_email:ME.email,day_no:+b.dataset.noteAdd,body:v});
    b.disabled=false;
    if(!ins.error)await refresh();else alert('送出失敗：'+ins.error.message);
  }
});
on('mClose','click',closeModal);
on('modal','click',function(e){if(e.target===$('modal'))closeModal()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('modal').hidden)closeModal()});
on('mBody','change',function(e){
  var el=e.target;
  if(el.id==='mFiles'){
    [].slice.call(el.files||[]).forEach(function(f){MOD.pending.push({file:f,url:URL.createObjectURL(f),caption:''})});
    renderModal();
  }else if(el.dataset.pendCap!==undefined){
    MOD.pending[+el.dataset.pendCap].caption=el.value.trim();
  }
});
on('mBody','input',function(e){
  if(e.target.dataset.pendCap!==undefined)MOD.pending[+e.target.dataset.pendCap].caption=e.target.value.trim();
});
on('mBody','click',async function(e){
  var b=e.target.closest('button');
  if(!b||!MOD)return;
  var st_=$('mSt');
  if(b.dataset.pendDel!==undefined){
    var gone=MOD.pending.splice(+b.dataset.pendDel,1)[0];
    URL.revokeObjectURL(gone.url);renderModal();
  }else if(b.dataset.capSave){
    var inp=document.querySelector('input[data-cap-id="'+b.dataset.capSave+'"]');
    b.disabled=true;
    var r=await sb.from('trip_photos').update({caption:inp.value.trim()||null}).eq('id',b.dataset.capSave);
    b.disabled=false;
    if(r.error){st_.textContent='儲存失敗：'+r.error.message;return}
    await refresh();
    $('mSt').textContent='註解已儲存。';
  }else if(b.dataset.delPhoto){
    await deletePhoto(b.dataset.delPhoto);
  }else if(b.id==='mUpload'){
    b.disabled=true;
    var ok=0,fail=0,list=MOD.pending.slice();
    for(var i=0;i<list.length;i++){
      st_.textContent='上傳中 '+(i+1)+' / '+list.length+'…';
      try{
        var pp=await prepPhoto(list[i].file);
        var path=TID+'/'+(crypto.randomUUID?crypto.randomUUID():String(Date.now())+i)+'.jpg';
        var up=await sb.storage.from('trip-photos').upload(path,pp.blob,{contentType:'image/jpeg'});
        if(up.error)throw up.error;
        var ins=await sb.from('trip_photos').insert({trip_id:TID,user_email:ME.email,path:path,caption:list[i].caption||null,day_no:MOD.day,item_key:MOD.k,taken_at:pp.taken?pp.taken.toISOString():null});
        if(ins.error){await sb.storage.from('trip-photos').remove([path]);throw ins.error}
        URL.revokeObjectURL(list[i].url);
        MOD.pending=MOD.pending.filter(function(x){return x!==list[i]});
        ok++;
      }catch(err){fail++;console.warn(err)}
    }
    await refresh();
    renderModal();
    $('mSt').innerHTML='已上傳 '+ok+' 張'+(fail?'，失敗 '+fail+' 張（已保留在清單中，可再試一次）':'')+'。<a class="maplink" href="slideshow.html?trip='+TID+'" target="_blank" rel="noopener">開啟照片幻燈片（依拍照時間排序）</a>';
  }
});
on('photos','click',function(e){
  var b=e.target.closest('button[data-del-photo]');
  if(b)deletePhoto(b.dataset.delPhoto);
});
async function deletePhoto(id){
  var p=PHOTOS.filter(function(x){return x.id===id})[0];
  if(!p||!confirm('確定刪除這張照片？'))return;
  var r=await sb.from('trip_photos').delete().eq('id',id);
  if(r.error){alert('刪除失敗：'+r.error.message);return}
  if(p.user_id===ME.id)await sb.storage.from('trip-photos').remove([p.path]);
  await refresh();
}
bootPage();
