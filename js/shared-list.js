// ================= 共享行程（別人分享、我曾開啟過的行程紀錄） =================
function shMsg(t,err){setMsg($('shMsg'),t,err)}
async function renderSharedList(){
  var box=$('shList');
  box.innerHTML='<p class="muted">載入中…</p>';shMsg('');
  var r=await sb.rpc('list_shared_visits');
  if(r.error){box.innerHTML='';shMsg('讀取失敗：'+r.error.message,true);return}
  var rows=r.data||[];
  if(!rows.length){box.innerHTML='<p class="muted">還沒有紀錄。打開別人分享給你的行程連結後，會自動出現在這裡。</p>';return}
  box.innerHTML='<div class="tblwrap"><table class="t"><thead><tr><th>行程</th><th>分享者</th><th>城市</th><th>天數</th><th>最近開啟</th><th></th></tr></thead><tbody>'+
    rows.map(function(x){
      var live=x.shared,cities=(x.cities||[]).join('、');
      var link=new URL('share.html?trip='+x.trip_id,location.href).href;
      return '<tr><td>'+(live?'<b>'+esc(x.name)+'</b>':'<span class="muted">（分享者已停止分享）</span>')+'</td><td>'+esc(x.owner||'')+'</td><td>'+esc(cities)+'</td><td>'+(x.days||'')+'</td><td>'+esc(fmtDate(x.last_opened))+'</td>'+
        '<td class="cell-actions">'+(live?'<a class="maplink" href="'+esc(link)+'" target="_blank" rel="noopener">開啟</a> <button type="button" class="sm" data-sh-copy="'+esc(x.trip_id)+'" data-name="'+esc(x.name)+'">複製成我的行程</button> ':'')+
        '<button type="button" class="ghost sm danger" data-sh-del="'+esc(x.trip_id)+'">刪除紀錄</button></td></tr>';
    }).join('')+'</tbody></table></div>';
}
on('shList','click',async function(e){
  var b=e.target.closest('button');
  if(!b)return;
  if(b.dataset.shDel){
    if(!b.dataset.sure){b.dataset.sure='1';b.textContent='再按一次確認刪除';setTimeout(function(){if(b.isConnected){delete b.dataset.sure;b.textContent='刪除紀錄'}},4000);return}
    b.disabled=true;
    var d=await sb.from('shared_visits').delete().eq('trip_id',b.dataset.shDel);
    if(d.error){shMsg('刪除失敗：'+d.error.message,true);b.disabled=false;return}
    shMsg('已刪除這筆紀錄（不影響分享者的行程）。');
    renderSharedList();
  }else if(b.dataset.shCopy){
    b.disabled=true;shMsg('複製中…');
    var nm=(b.dataset.name+'（複本）').slice(0,30);
    var r=await sb.rpc('copy_shared_trip',{p_trip:b.dataset.shCopy,p_name:nm});
    b.disabled=false;
    if(r.error){shMsg('複製失敗：'+r.error.message,true);return}
    try{
      await flush();
      await loadTrips();buildTripSel();
      var t=TRIPS.filter(function(x){return x.id===r.data})[0];
      if(t){showView('plan');openTrip(t);buildTripSel();setSave('已複製為你的行程「'+t.name+'」（不含照片與留言）')}
    }catch(err){shMsg('已複製，但重新載入失敗：'+err.message+'，請重新整理頁面。',true)}
  }
});
