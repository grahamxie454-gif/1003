// ================= 左側條件 =================
function chip(type,name,val,text,on,extra){
  return '<label class="chip"><input type="'+type+'" name="'+name+'" value="'+esc(val)+'"'+(on?' checked':'')+(extra||'')+'><span>'+esc(text)+'</span></label>';
}
function buildStatic(){
  $('co').innerHTML=Object.keys(CO).map(function(k){return chip('checkbox','co',k,CO[k].n,st.co.indexOf(k)>-1)}).join('');
  $('auto').innerHTML=chip('checkbox','auto','1','依距離自動排列城市順序',st.auto);
  $('modes').innerHTML=Object.keys(MODES).map(function(k){return chip('checkbox','modes',k,MODES[k],st.modes.indexOf(k)>-1)}).join('');
  $('tier').innerHTML=TIERS.map(function(t,i){return chip('radio','tier',i,t[0],i===st.tier)}).join('');
  $('pace').innerHTML=[['full','緊湊（含上午）'],['relax','悠閒（睡到飽）']].map(function(p){return chip('radio','pace',p[0],p[1],p[0]===st.pace)}).join('');
  syncDays();
}
function buildCities(){
  $('ci').innerHTML=Object.keys(C).filter(function(k){return st.co.indexOf(C[k].co)>-1}).map(function(k){
    return chip('checkbox','ci',k,C[k].n,st.ci.indexOf(k)>-1)}).join('');
}
function buildAdder(){
  var cus=Object.keys(CO).filter(function(k){return CO[k].custom}),cuc=Object.keys(C).filter(function(k){return C[k].custom});
  $('adder').innerHTML=
    '<div class="addrow"><input type="text" id="nco" maxlength="12" placeholder="國家名稱，例如：越南" aria-label="新國家名稱"><input type="number" id="nfl" min="0" step="1000" placeholder="來回機票 NT$（選填）" aria-label="來回機票"><button type="button" class="ghost" data-act="addco">新增國家</button></div>'+
    '<div class="addrow"><input type="text" id="nci" maxlength="14" placeholder="城市名稱，例如：沖繩" aria-label="新城市名稱"><select id="ncc" aria-label="城市所屬國家">'+
      Object.keys(CO).map(function(k){return '<option value="'+esc(k)+'">'+esc(CO[k].n)+'</option>'}).join('')+'</select>'+
      '<input type="number" id="nkm" min="1" placeholder="距其他已選城市約幾公里（預設 150）" aria-label="與其他城市的距離"><button type="button" class="ghost" data-act="addci">新增城市</button></div>'+
    '<p class="hint">自訂城市以預設費用估算，距離用來推算城際移動時間。新增後到右側加入地區與地點。</p>'+
    ((cus.length||cuc.length)?'<ul>'+cus.map(function(k){return '<li><span>國家：'+esc(CO[k].n)+'</span><button type="button" class="ghost" data-act="delco" data-k="'+esc(k)+'">移除</button></li>'}).join('')+
      cuc.map(function(k){return '<li><span>城市：'+esc(C[k].n)+'（'+esc(CO[C[k].co].n)+'）</span><button type="button" class="ghost" data-act="delci" data-k="'+esc(k)+'">移除</button></li>'}).join('')+'</ul>':'');
}
function normalize(){
  st.co=st.co.filter(function(k){return CO[k]});
  st.ci=st.ci.filter(function(k){return C[k]&&st.co.indexOf(C[k].co)>-1});
  st.co.forEach(function(c){
    var ks=Object.keys(C).filter(function(k){return C[k].co===c});
    if(ks.length&&!st.ci.some(function(k){return C[k].co===c}))st.ci.push(ks[0]);
  });
  if(!st.ci.length){var k0=Object.keys(C)[0];st.co=[C[k0].co];st.ci=[k0]}
  st.ci=Object.keys(C).filter(function(k){return st.ci.indexOf(k)>-1});
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
  return {id:c.id,k:k,name:c.name,s:c.s||'x',cost:c.cost||0,url:c.url||'',rating:c.rating||null,lat:has?c.lat:null,lng:has?c.lng:null,stay:(st.stay&&st.stay[c.id])||(c.s==='f'?75:60),
    desc:'自訂地點'+(has?'，座標 '+c.lat+', '+c.lng:'，位置為估計')+(c.cost?'':'，費用未計入'),dist:c.d||'自訂'};
}
function costTxt(x){return x.cost?'約 '+fmt(x.cost):(x.s==='x'?'自訂，費用未計':'免費')}
// 某地區的全部地點（不論是否勾選）
function distSpots(k,dn){
  var s=ensureSel(k),out=[];
  (C[k].d[dn]||[]).forEach(function(sp){
    var id=k+'|'+sp[4];
    out.push({id:id,k:k,name:sp[0],s:sp[1],cost:sp[2],desc:sp[3],dist:dn,rating:sp[5],url:sp[6],stay:(st.stay&&st.stay[id])||sp[7]||0});
  });
  out.sort(byOrd);
  s.cs.filter(function(c){return c.d===dn}).forEach(function(c){out.push(customObj(k,c))});
  return out;
}
function citySpots(k,all,ordered){
  var s=ensureSel(k),out=[],ds=ordered?orderDistricts(k,s.d):s.d;
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
  var h='<div class="legendt"><span class="tk ok">已排入行程</span><span class="tk bad">已選但未排入</span><span class="tk off">未選</span></div>';
  st.ci.forEach(function(k){
    var s=ensureSel(k),c=C[k],ds=Object.keys(c.d).concat(s.cd);
    h+='<section class="pick"><h3>'+esc(c.n)+'<small>'+esc(CO[c.co].n)+'</small></h3>';
    var groups=ds.slice();
    if(s.cs.some(function(x){return !x.d}))groups.push('');
    if(!groups.length)h+='<p class="empty">這是自訂城市，請先新增地區，再新增地點。</p>';
    h+='<div class="tree">';
    groups.forEach(function(dn){
      var on=dn===''||s.d.indexOf(dn)>-1,list=dn===''?s.cs.filter(function(x){return !x.d}).map(function(x){return customObj(k,x)}):distSpots(k,dn);
      var chosen=list.filter(function(x){return on&&!s.off[x.id]}),okn=chosen.filter(function(x){return placed[x.id]}).length;
      var dkey=k+'|'+dn,dopen=isOpenT(dkey,on);
      h+='<div class="tn l0 '+treeCls(chosen.length,okn)+'"><button type="button" class="tgl" data-tk="'+esc(dkey)+'" aria-expanded="'+dopen+'" aria-label="展開或收合">'+(dopen?'▾':'▸')+'</button>'+
        '<label><input type="checkbox" data-k="'+esc(k)+'" data-d="'+esc(dn)+'"'+(on?' checked':'')+(dn===''?' disabled':'')+'><b>'+esc(dn||'未指定地區')+'</b></label><span class="cnt">'+okn+'/'+chosen.length+' 已排入</span></div>';
      if(!dopen)return;
      Object.keys(STYLE).forEach(function(sty){
        var sl=list.filter(function(x){return x.s===sty});
        if(!sl.length)return;
        var ch=sl.filter(function(x){return on&&!s.off[x.id]}),ok2=ch.filter(function(x){return placed[x.id]}).length,tkey=dkey+'|'+sty,topen=isOpenT(tkey,false);
        var allOn=sl.every(function(x){return !s.off[x.id]}),someOn=sl.some(function(x){return !s.off[x.id]});
        h+='<div class="tn l1 '+treeCls(ch.length,ok2)+'"><button type="button" class="tgl" data-tk="'+esc(tkey)+'" aria-expanded="'+topen+'" aria-label="展開或收合">'+(topen?'▾':'▸')+'</button>'+
          '<label><input type="checkbox" data-k="'+esc(k)+'" data-d="'+esc(dn)+'" data-t="'+sty+'"'+(allOn?' checked':'')+(!allOn&&someOn?' data-ind="1"':'')+'>'+STYLE[sty]+'</label><span class="cnt">'+ok2+'/'+ch.length+'</span></div>';
        if(!topen)return;
        sl.forEach(function(x){
          var chk=on&&!s.off[x.id];
          h+='<div class="tn l2 '+(chk?(placed[x.id]?'ok':'bad'):'off')+'"><label class="sp"><input type="checkbox" data-k="'+esc(k)+'" data-id="'+esc(x.id)+'"'+(s.off[x.id]?'':' checked')+'><b>'+esc(x.name)+'</b> '+rateTxt(x)+'</label>'+
            '<span class="cnt">'+(x.s==='f'?'餐廳・':'')+costTxt(x)+'・停留 '+(x.stay||stayOf(x))+' 分・<a class="maplink" href="'+esc(mapSearch(x))+'" target="_blank" rel="noopener">地圖</a></span></div>';
        });
      });
    });
    h+='</div><div class="addrow"><input type="text" id="cd_'+k+'" maxlength="20" placeholder="自訂地區，例如：中野" aria-label="自訂地區"><button type="button" class="ghost" data-act="addd" data-k="'+esc(k)+'">新增地區</button></div>'+
      '<div class="addrow"><input type="text" id="cs_'+k+'" maxlength="30" placeholder="自訂地點，例如：某某咖啡廳" aria-label="自訂地點"><select id="cl_'+k+'" aria-label="自訂地點所屬地區"><option value="">不指定地區</option>'+
      s.d.map(function(d){return '<option value="'+esc(d)+'">'+esc(d)+'</option>'}).join('')+'</select><select id="ct_'+k+'" aria-label="自訂地點類型"><option value="x">類型：自訂</option><option value="f">美食</option><option value="c">文化</option><option value="n">自然</option><option value="s">購物</option></select><input type="url" id="cu_'+k+'" placeholder="Google 地圖分享連結（選填，自動帶入名稱與評分）" aria-label="Google 地圖連結"><input type="text" id="cg_'+k+'" placeholder="座標（選填），例如 25.0330, 121.5654" aria-label="自訂地點座標" inputmode="decimal"><input type="number" id="cc_'+k+'" min="0" step="100" placeholder="費用 NT$（選填）" aria-label="自訂地點費用"><button type="button" class="ghost" data-act="adds" data-k="'+esc(k)+'">新增地點</button></div></section>';
  });
  $('pick').innerHTML=h;
  [].forEach.call($('pick').querySelectorAll('input[data-ind]'),function(i){i.indeterminate=true});
}

