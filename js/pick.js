// ================= 左側條件 =================
function chip(type,name,val,text,on,extra){
  return '<label class="chip"><input type="'+type+'" name="'+name+'" value="'+esc(val)+'"'+(on?' checked':'')+(extra||'')+'><span>'+esc(text)+'</span></label>';
}
function buildStatic(){
  $('modes').innerHTML=Object.keys(MODES).map(function(k){return chip('checkbox','modes',k,MODES[k],st.modes.indexOf(k)>-1)}).join('');
  $('tier').innerHTML=TIERS.map(function(t,i){return chip('radio','tier',i,t[0],i===st.tier)}).join('');
  $('pace').innerHTML=[['full','緊湊（含上午）'],['relax','悠閒（睡到飽）']].map(function(p){return chip('radio','pace',p[0],p[1],p[0]===st.pace)}).join('');
  syncDays();
}
function buildCities(){
  // 可選的城市：依「已選國家」的順序列出（只是選擇用的清單；行程順序請看下方的已選城市順序）
  var ks=[];
  st.co.forEach(function(c){Object.keys(C).forEach(function(k){if(C[k].co===c)ks.push(k)})});
  $('ci').innerHTML=ks.map(function(k){var ar=arrivalCities().indexOf(k)>-1,dp=departureCities().indexOf(k)>-1;return chip('checkbox','ci',k,C[k].n+(ar?'（航班抵達）':(dp?'（航班出發）':'')),st.ci.indexOf(k)>-1,(ar||dp)?' disabled':'')}).join('');
}
function buildAdder(){
  var cus=Object.keys(CO).filter(function(k){return CO[k].custom}),cuc=Object.keys(C).filter(function(k){return C[k].custom});
  $('adder').innerHTML=
    '<div class="addrow"><input type="text" id="nco" maxlength="12" placeholder="國家名稱，例如：越南" aria-label="新國家名稱"><input type="number" id="nfl" min="0" step="1000" placeholder="來回機票 NT$（選填）" aria-label="來回機票"><button type="button" class="ghost" data-act="addco">新增國家</button></div>'+
    '<div class="addrow"><input type="text" id="nci" maxlength="14" placeholder="城市名稱，例如：沖繩" aria-label="新城市名稱"><select id="ncc" aria-label="城市所屬國家">'+
      Object.keys(CO).map(function(k){return '<option value="'+esc(k)+'">'+esc(CO[k].n)+'</option>'}).join('')+'</select>'+
      '<input type="number" id="nkm" min="1" placeholder="距其他已選城市約幾公里（預設 150）" aria-label="與其他城市的距離"><button type="button" class="ghost" data-act="addci">新增城市</button></div>'+
    '<p class="hint">自訂城市以預設費用估算，距離用來推算城際移動時間。新增後到右側加入地區與地點。</p>'+
    ((cus.length||cuc.length)?'<ul>'+cus.map(function(k){return '<li><span>國家：'+esc(CO[k].n)+'</span>'+reqUi(k,'country','data-k="'+esc(k)+'"')+'<button type="button" class="ghost" data-act="delco" data-k="'+esc(k)+'">移除</button></li>'}).join('')+
      cuc.map(function(k){return '<li><span>城市：'+esc(C[k].n)+'（'+esc(CO[C[k].co].n)+'）</span>'+reqUi(k,'city','data-k="'+esc(k)+'"')+'<button type="button" class="ghost" data-act="delci" data-k="'+esc(k)+'">移除</button></li>'}).join('')+'</ul>':'');
}
// 國家由航班抵達的順序決定（不能手動調整）；城市只保留屬於這些國家的，順序依國家分組
function normalize(){
  var p=flightPlan(),F=flList();
  // 航班指到已被刪除的自訂國家／城市時，清掉
  F.forEach(function(f){
    if(f.toCo&&!CO[f.toCo]&&f.toCo!==HOME_DEFAULT){f.toCo='';f.toCity=''}
    if(f.toCity&&!C[f.toCity])f.toCity='';
  });
  p=flightPlan();
  st.ci=(st.ci||[]).filter(function(k){return C[k]});
  if(!p.ok){st.co=[];return}      // 航班還沒設好時保留已選城市，不要清掉
  st.co=p.countries.slice();
  st.ci=st.ci.filter(function(k){return st.co.indexOf(C[k].co)>-1});
  // 航班抵達的城市一定會排進行程；不再是抵達城市的自動加入項目會被移除
  var auto=st.ciAuto=st.ciAuto&&typeof st.ciAuto==='object'?st.ciAuto:{},arrs=arrivalCities(),deps=departureCities(),req=arrs.concat(deps);
  st.ci=st.ci.filter(function(k){return !(auto[k]&&req.indexOf(k)<0)});
  Object.keys(auto).forEach(function(k){if(st.ci.indexOf(k)<0&&req.indexOf(k)<0)delete auto[k]});
  arrs.forEach(function(k){if(st.ci.indexOf(k)<0){st.ci.unshift(k);auto[k]=1}});
  deps.forEach(function(k){if(st.ci.indexOf(k)<0){st.ci.push(k);auto[k]=1}});
  st.co.forEach(function(c){
    if(st.ci.some(function(k){return C[k].co===c}))return;
    var f=F.filter(function(x){return x.toCo===c})[0],ks=Object.keys(C).filter(function(k){return C[k].co===c});
    var k0=f&&f.toCity&&C[f.toCity]?f.toCity:ks[0];
    if(k0)st.ci.push(k0);
  });
  st.ci=st.co.reduce(function(a,c){return a.concat(st.ci.filter(function(k){return C[k].co===c}))},[]);
}

// ================= 地區與地點 =================
function ensureSel(k){
  if(!sel[k])sel[k]={d:Object.keys(C[k].d).slice(0,2),off:{},cd:[],cs:[]};
  return sel[k];
}
var styleOk=function(){return true};
var byOrd=function(a,b){return ORD[a.s]-ORD[b.s]};
function customObj(k,c){
  var has=typeof c.lat==='number';
  return {custom:true,id:c.id,k:k,name:c.name,s:c.s||'x',tag:c.tag||'',cost:c.cost||0,url:c.url||'',rating:c.rating||null,lat:has?c.lat:null,lng:has?c.lng:null,stay:(st.stay&&st.stay[c.id])||(c.s==='f'?75:60),
    desc:'自訂地點'+(has?'，座標 '+c.lat+', '+c.lng:'，位置為估計')+(c.cost?'':'，費用未計入'),dist:c.d||'自訂'};
}
function costTxt(x){return x.cost?'約 '+fmt(x.cost):(x.s==='x'?'自訂，費用未計':'免費')}
// 某地區的全部地點（不論是否勾選）
function distSpots(k,dn){
  var s=ensureSel(k),out=[];
  (C[k].d[dn]||[]).forEach(function(sp){
    var id=k+'|'+sp[4];
    out.push({id:id,k:k,name:sp[0],s:sp[1],cost:sp[2],desc:sp[3],dist:dn,rating:sp[5],url:sp[6],stay:(st.stay&&st.stay[id])||sp[7]||0,lat:sp[8]==null?null:sp[8],lng:sp[9]==null?null:sp[9],tag:sp[10]||''});
  });
  out.sort(byOrd);
  s.cs.filter(function(c){return c.d===dn}).forEach(function(c){out.push(customObj(k,c))});
  return out;
}
function sortByDord(k,ds){
  var s=ensureSel(k),d=s.dord||[];
  if(!d.length)return ds.slice();
  var out=d.filter(function(x){return ds.indexOf(x)>-1});
  ds.forEach(function(x){if(out.indexOf(x)<0)out.push(x)});
  return out;
}
function citySpots(k,all,ordered){
  var s=ensureSel(k),out=[],ds=ordered?(s.dord&&s.dord.length?sortByDord(k,s.d):orderDistricts(k,s.d)):s.d;
  ds.forEach(function(dn){distSpots(k,dn).forEach(function(x){out.push(x)})});
  s.cs.filter(function(c){return !c.d}).forEach(function(c){out.push(customObj(k,c))});
  return all?out:out.filter(function(x){return !s.off[x.id]});
}
// 樹狀選擇：地區 → 類型 → 景點。綠色＝已排入行程，紅色＝已選但未排入，灰色＝未選
var TOPEN={},LASTP=null;
var isOpenT=function(key,def){return TOPEN[key]===undefined?def:TOPEN[key]};
function treeCls(sel,ok){return !sel?'off':(ok===sel?'ok':'bad')}
function renderPick(p){
  p=p||LASTP;LASTP=p;
  var placed={};
  p.days.forEach(function(d){d.rows.forEach(function(r){if((r.type==='sight'||r.type==='meal')&&r.s)placed[r.s.id]=1})});
  var toks=PICKQ.trim().toLowerCase().split(/\s+/).filter(Boolean),shownTotal=0;
  var h='<p class="hint">地區預設全部收合。按住地區列拖曳可調整順序：自動排程時，未固定的景點會優先排排在前面的地區。</p><div class="legendt"><span class="tk ok">已排入行程</span><span class="tk bad">已選但未排入</span><span class="tk off">未選</span></div>';
  st.ci.forEach(function(k){
    var s=ensureSel(k),c=C[k],ds=Object.keys(c.d).concat(s.cd);
    h+='<section class="pick"><h3>'+esc(c.n)+'<small>'+esc(CO[c.co].n)+'</small></h3>';
    var groups=sortByDord(k,ds);
    if(s.cs.some(function(x){return !x.d}))groups.push('');
    if(!groups.length&&!toks.length)h+='<p class="empty">這是自訂城市，請先新增地區，再新增地點。</p>';
    h+='<div class="tree">';
    groups.forEach(function(dn){
      var on=dn===''||s.d.indexOf(dn)>-1,list=dn===''?s.cs.filter(function(x){return !x.d}).map(function(x){return customObj(k,x)}):distSpots(k,dn);
      var shown=toks.length?list.filter(function(x){return spotMatch(x,toks)}):list;
      if(toks.length&&!shown.length)return;
      shownTotal+=shown.length;
      var chosen=list.filter(function(x){return on&&!s.off[x.id]}),okn=chosen.filter(function(x){return placed[x.id]}).length;
      var dkey=k+'|'+dn,dopen=toks.length?true:isOpenT(dkey,false);
      h+='<div class="tn l0 '+treeCls(chosen.length,okn)+'"'+(dn===''?'':' draggable="true" data-dk="'+esc(k)+'" data-dn="'+esc(dn)+'" title="按住拖曳可調整排程優先順序"')+'>'+(dn===''?'':'<span class="grip" aria-hidden="true">⋮⋮</span>')+'<button type="button" class="tgl" data-tk="'+esc(dkey)+'" aria-expanded="'+dopen+'" aria-label="展開或收合">'+(dopen?'▾':'▸')+'</button>'+
        '<label><input type="checkbox" data-k="'+esc(k)+'" data-d="'+esc(dn)+'"'+(on?' checked':'')+(dn===''?' disabled':'')+'><b>'+esc(dn||'未指定地區')+'</b></label><span class="cnt">'+okn+'/'+chosen.length+' 已排入</span>'+(s.cd.indexOf(dn)>-1?reqUi('dist|'+k+'|'+dn,'district','data-k="'+esc(k)+'" data-dn="'+esc(dn)+'"')+'<button type="button" class="ghost sm x" data-act="delcd" data-k="'+esc(k)+'" data-dn="'+esc(dn)+'" aria-label="刪除自訂地區">✕</button>':'')+'</div>';
      if(!dopen)return;
      Object.keys(STYLE).forEach(function(sty){
        var sl=shown.filter(function(x){return x.s===sty});
        if(!sl.length)return;
        var ch=sl.filter(function(x){return on&&!s.off[x.id]}),ok2=ch.filter(function(x){return placed[x.id]}).length,tkey=dkey+'|'+sty,topen=toks.length?true:isOpenT(tkey,false);
        var allOn=sl.every(function(x){return !s.off[x.id]}),someOn=sl.some(function(x){return !s.off[x.id]});
        h+='<div class="tn l1 '+treeCls(ch.length,ok2)+'"><button type="button" class="tgl" data-tk="'+esc(tkey)+'" aria-expanded="'+topen+'" aria-label="展開或收合">'+(topen?'▾':'▸')+'</button>'+
          '<label><input type="checkbox" data-k="'+esc(k)+'" data-d="'+esc(dn)+'" data-t="'+sty+'"'+(allOn?' checked':'')+(!allOn&&someOn?' data-ind="1"':'')+'>'+STYLE[sty]+'</label><span class="cnt">'+ok2+'/'+ch.length+'</span></div>';
        if(!topen)return;
        sl.forEach(function(x){
          var chk=on&&!s.off[x.id];
          h+='<div class="tn l2 '+(chk?(placed[x.id]?'ok':'bad'):'off')+'"><label class="sp"><input type="checkbox" data-k="'+esc(k)+'" data-id="'+esc(x.id)+'"'+(s.off[x.id]?'':' checked')+'><b>'+esc(x.name)+'</b> '+(x.tag?'<span class="tag">'+esc(x.tag)+'</span> ':'')+rateTxt(x)+'</label>'+
            '<span class="cnt">'+(x.s==='f'?'餐廳・':'')+costTxt(x)+'・停留 '+(x.stay||stayOf(x))+' 分・<a class="maplink" href="'+esc(mapSearch(x))+'" target="_blank" rel="noopener">地圖</a></span>'+(x.custom?reqUi(x.id,'spot','data-k="'+esc(k)+'" data-id="'+esc(x.id)+'"')+'<button type="button" class="ghost sm x" data-act="delcs" data-k="'+esc(k)+'" data-id="'+esc(x.id)+'" aria-label="刪除自訂景點">✕</button>':'')+'</div>';
        });
      });
    });
    h+='</div><div class="addrow"><input type="text" id="cd_'+k+'" maxlength="20" placeholder="自訂地區，例如：中野" aria-label="自訂地區"><button type="button" class="ghost" data-act="addd" data-k="'+esc(k)+'">新增地區</button></div>'+
      '<div class="addrow"><input type="text" id="cs_'+k+'" maxlength="30" placeholder="自訂地點，例如：某某咖啡廳" aria-label="自訂地點"><select id="cl_'+k+'" aria-label="自訂地點所屬地區"><option value="">不指定地區</option>'+
      s.d.map(function(d){return '<option value="'+esc(d)+'">'+esc(d)+'</option>'}).join('')+'</select><select id="ct_'+k+'" aria-label="自訂地點類型"><option value="x">類型：自訂</option><option value="f">美食</option><option value="c">文化</option><option value="n">自然</option><option value="s">購物</option></select><input type="text" id="ctag_'+k+'" maxlength="12" placeholder="子分類（選填，例如：火鍋）" aria-label="自訂地點子分類"><input type="url" id="cu_'+k+'" placeholder="Google 地圖分享連結（選填，自動帶入名稱與評分）" aria-label="Google 地圖連結"><input type="text" id="cg_'+k+'" placeholder="座標（選填），例如 25.0330, 121.5654" aria-label="自訂地點座標" inputmode="decimal"><input type="number" id="cc_'+k+'" min="0" step="100" placeholder="費用 NT$（選填）" aria-label="自訂地點費用"><button type="button" class="ghost" data-act="adds" data-k="'+esc(k)+'">新增地點</button><button type="button" class="ghost" data-act="reqtoggle" data-k="'+esc(k)+'" aria-expanded="'+(REQOPEN?'true':'false')+'">我的收錄申請'+reqCountTxt()+(REQOPEN?'（收合）':'')+'</button></div></section>';
  });
  if(toks.length&&!shownTotal)h+='<p class="empty">找不到符合的景點，請換個關鍵字。</p>';
  $('pickQn').textContent=toks.length?('找到 '+shownTotal+' 個景點'):'';
  h+=myRequestsHtml();
  $('pick').innerHTML=h;
  [].forEach.call($('pick').querySelectorAll('input[data-ind]'),function(i){i.indeterminate=true});
}


// ===== 景點搜尋（模糊篩選）與城市／國家順序 =====
var PICKQ='';
// 每個關鍵字：出現在「名稱、說明、地區、類型、子分類」中，或名稱／子分類的字依序出現（容許中間夾別的字）
function spotMatch(x,toks){
  var hay=(x.name+' '+(x.desc||'')+' '+(x.dist||'')+' '+(STYLE[x.s]||'')+' '+(x.tag||'')).toLowerCase(),nm=(x.name+(x.tag||'')).toLowerCase();
  return toks.every(function(t){
    if(hay.indexOf(t)>-1)return true;
    if(t.length<2)return false;
    var i=0;
    for(var j=0;j<nm.length&&i<t.length;j++)if(nm.charAt(j)===t.charAt(i))i++;
    return i===t.length;
  });
}
// 依使用者的點選順序合併：保留原本順序，新勾選的接在後面，取消的移除
function mergeOrder(old,now){
  var out=old.filter(function(k){return now.indexOf(k)>-1});
  now.forEach(function(k){if(out.indexOf(k)<0)out.push(k)});
  return out;
}
// 國家依航班抵達的順序排列，不能調整；城市只能在自己的國家內調整順序
function renderOrder(){
  var box=$('order');if(!box)return;
  var btn=function(kind,i,d,dis,txt){return '<button type="button" class="ghost sm" data-ord="mv" data-kind="'+kind+'" data-i="'+i+'" data-d="'+d+'" aria-label="'+(d<0?'上移':'下移')+'"'+(dis?' disabled':'')+'>'+txt+'</button>'};
  var h='<div class="ordbox"><div class="lab">國家順序依航班抵達地排列（不能調整）；城市可拖曳或按 ▲▼，只能在自己的國家內調整</div><ol class="ord">';
  st.co.forEach(function(c,ci){
    var cities=st.ci.map(function(k,gi){return {k:k,gi:gi}}).filter(function(x){return C[x.k].co===c});
    h+='<li class="ordco"><div class="ordrow"><span class="ono">'+(ci+1)+'</span><b>'+esc(CO[c].n)+'</b><span class="muted">依航班抵達順序</span></div><ol class="ord sub">'+
      cities.map(function(x,j){
        return '<li draggable="true" data-kind="ci" data-i="'+x.gi+'" data-co="'+esc(c)+'"><span class="grip" aria-hidden="true">⋮⋮</span><b>'+esc(C[x.k].n)+'</b>'+
          '<span class="obtn">'+btn('ci',x.gi,-1,j===0,'▲')+btn('ci',x.gi,1,j===cities.length-1,'▼')+'</span></li>';
      }).join('')+'</ol></li>';
  });
  h+='</ol>';
  if(st.ci.length>1)h+='<button type="button" class="ghost sm" data-ord="auto">依距離自動排序各國的城市</button>';
  box.innerHTML=h+'</div>';
}
