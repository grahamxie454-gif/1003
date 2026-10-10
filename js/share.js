// ================= 分享給同行（規劃頁） =================
// 開啟分享後，行程快照會存在 trips.share_data；同行的人以已註冊帳號登入 share.html?trip=<行程編號> 才能瀏覽。
function shareUrl(page){return new URL(page+'?trip='+TRIP.id,location.href).href}
function buildSnapshot(p){
  return {
    v:6,
    cities:p.cities.map(function(k){return C[k].n}),
    days:p.days.map(function(d){
      return {
        no:d.no,date:dayDate(d.no),city:d.city?C[d.city].n:'航班日',off:!!d.off&&!d.tour,
        hotel:d.hotel?{name:d.hotel.name,url:d.hotel.url||''}:null,stops:dayStops(d),
        rows:d.rows.map(function(r){
          var inf=rowInfo(r,d);if(!inf)return null;
          var k=(r.type==='sight'||r.type==='meal')&&r.s?'s:'+r.s.id:(r.type==='tour'?'t:'+d.no:(r.type==='flight'?'x:'+d.no+':'+d.rows.filter(function(q){return q.type==='flight'}).indexOf(r):((r.type==='free'||r.type==='meal')&&r.key?(r.type==='free'?'f:':'m:')+d.no+':'+r.key:'')));
          return {t:r.type==='ferry'?'buffer':r.type,im:(r.s&&r.s.images)||'',k:k,s:r.start,e:r.end,n:inf.name,c:typeof inf.cost==='number'?inf.cost:0,l:inf.link||'',r:(r.s&&r.s.rating)||null,o:!!r.over,x:snapExtra(r,d)};
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
  var u=$('shareUrl').value;
  var ok=function(){toast('已複製分享連結。','ok')};
  try{navigator.clipboard.writeText(u).then(ok,function(){$('shareUrl').select();toast('請按 Ctrl+C 複製連結。','warn')})}catch(err){$('shareUrl').select();toast('請按 Ctrl+C 複製連結。','warn')}
});

// 分享頁要和行程規劃顯示一樣：把每一列需要的資訊（說明、風格、營業時間、交通工具與轉乘分段…）一起放進快照
function snapExtra(r,d){
  var x={};
  if((r.type==='sight'||r.type==='meal')&&r.s){
    var s=r.s;
    x.ty=s.s;x.tg=s.tag||'';x.dt=s.dist||'';x.ct=costTxt(s);x.sy=Math.round(r.end-r.start);x.hl=hoursLabel(s,d.no);
    if(r.type==='sight')x.ds=s.desc||'';else x.ml=r.n||'';
    if(r.closed)x.cl=1;else if(r.over)x.ov=1;
    if(r.short)x.sh=1;
  }else if(r.type==='meal'){x.ml=r.n||'用餐';x.ph=1}
  else if(r.type==='move'){
    x.mo=r.lg.mode;x.km=Math.round(r.lg.km*10)/10;x.mi=r.lg.min;x.wt=r.lg.wait||0;x.g=r.lg.g?1:0;x.sr=r.lg.src||'';x.tb=r.lg.tbl?1:0;x.to=r.to||'';
    if(r.lg.segs&&r.lg.segs.length)x.sg=r.lg.segs;
  }else if(r.type==='hop'){
    x.mo=r.hop.mode;x.km=Math.round(r.hop.km*10)/10;x.mi=r.hop.min;x.to=C[r.hop.to]?C[r.hop.to].n:'';
  }else if(r.type==='ferry'){
    x.fx=r.text||'';x.se=r.season||'';x.ti=r.times||'';if(r.none)x.no=1;
  }
  return x;
}
