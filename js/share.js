// ================= 分享給同行（規劃頁） =================
// 開啟分享後，行程快照會存在 trips.share_data；同行的人以已註冊帳號登入 share.html?trip=<行程編號> 才能瀏覽。
function shareUrl(page){return new URL(page+'?trip='+TRIP.id,location.href).href}
function buildSnapshot(p){
  return {
    v:3,
    cities:p.cities.map(function(k){return C[k].n}),
    days:p.days.map(function(d){
      return {
        no:d.no,date:dayDate(d.no),city:C[d.city].n,off:!!d.off&&!d.tour,
        hotel:d.hotel?{name:d.hotel.name,url:d.hotel.url||''}:null,
        rows:d.rows.map(function(r){
          var inf=rowInfo(r,d);if(!inf)return null;
          var k=(r.type==='sight'||r.type==='meal')&&r.s?'s:'+r.s.id:(r.type==='tour'?'t:'+d.no:(r.type==='flight'?'x:'+d.no+':'+d.rows.filter(function(q){return q.type==='flight'}).indexOf(r):((r.type==='free'||r.type==='meal')&&r.key?(r.type==='free'?'f:':'m:')+d.no+':'+r.key:'')));
          return {t:r.type,k:k,s:r.start,e:r.end,n:inf.name,c:typeof inf.cost==='number'?inf.cost:0,l:inf.link||'',r:(r.s&&r.s.rating)||null,o:!!r.over};
        }).filter(Boolean)
      };
    })
  };
}
function shareBoxHtml(){
  var on_=!!(TRIP&&TRIP.share_enabled);
  var h='<section class="tips sharebox"><h3>分享給同行</h3>'+
    '<p class="hint">開啟後，同行的人用已註冊的帳號登入，就能瀏覽這份行程、上傳照片與留言；沒有登入的人打開連結也看不到內容。行程更新後，分享內容會自動同步。</p>'+
    '<label class="shareon"><input type="checkbox" id="shareOn"'+(on_?' checked':'')+'> 開啟分享</label>';
  if(on_){
    var u=shareUrl('share.html'),s=shareUrl('slideshow.html');
    h+='<div class="sharerow"><input type="text" id="shareUrl" readonly value="'+esc(u)+'" aria-label="分享連結"><button type="button" data-share="copy">複製連結</button><a class="maplink" href="'+esc(u)+'" target="_blank" rel="noopener">開啟</a></div>'+
      '<div class="sharerow"><span class="muted">照片幻燈片連結（依拍照時間排序）：</span><a class="maplink" href="'+esc(s)+'" target="_blank" rel="noopener">開啟幻燈片</a></div>';
  }
  return h+'<span class="status" id="shareSt"></span></section>';
}
async function setShare(v){
  var upd={share_enabled:v};
  if(v){upd.share_data=buildSnapshot(plan());upd.share_updated_at=new Date().toISOString()}
  var r=await sb.from('trips').update(upd).eq('id',TRIP.id);
  if(r.error){setSave('設定分享失敗：'+r.error.message);render(true);return}
  TRIP.share_enabled=v;
  render(true);
}
on('res','change',function(e){
  if(e.target.id==='shareOn')setShare(e.target.checked);
});
on('res','click',function(e){
  var b=e.target.closest('button[data-share]');
  if(!b||b.dataset.share!=='copy')return;
  var u=$('shareUrl').value,st_=$('shareSt');
  var ok=function(){st_.textContent='已複製連結'};
  try{navigator.clipboard.writeText(u).then(ok,function(){$('shareUrl').select();st_.textContent='請按 Ctrl+C 複製'})}catch(err){$('shareUrl').select();st_.textContent='請按 Ctrl+C 複製'}
});
