// ================= 距離與移動時間 =================
function parseLL(v){
  var m=String(v).trim().match(/^(-?\d+(?:\.\d+)?)\s*[,，\s]\s*(-?\d+(?:\.\d+)?)$/);
  if(!m)return null;
  var a=+m[1],b=+m[2];
  return Math.abs(a)<=90&&Math.abs(b)<=180?[a,b]:null;
}
function hash(s){var h=5381;for(var i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return Math.abs(h)}
function off(h,m){return ((h%2001)/1000-1)*m}
function distLL(k,dn){
  var c=C[k];
  if(c.pos&&c.pos[dn])return c.pos[dn];
  var h=hash(k+dn);
  return [(c.lat||0)+off(h,0.04),(c.lng||0)+off(h>>3,0.04)];
}
function spotLL(x){
  if(typeof x.lat==='number')return [x.lat,x.lng];
  var b=distLL(x.k,x.dist),h=hash(x.name);
  return [b[0]+off(h,0.007),b[1]+off(h>>5,0.007)];
}
function hav(a,b){
  var r=Math.PI/180,dl=(b[0]-a[0])*r,dn=(b[1]-a[1])*r;
  var x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dn/2)*Math.sin(dn/2);
  return 12742*Math.asin(Math.sqrt(x));
}
var round5=function(m){return Math.max(5,Math.round(m/5)*5)};
var LSPD={metro:[30,12],bus:[18,12],train:[40,15],drive:[28,15]};
function localLeg(a,b,ms){
  var km=hav(a,b),route=km*1.3,best={mode:'',min:1e9};
  ms.forEach(function(m){var t=LSPD[m][1]+route/LSPD[m][0]*60;if(t<best.min)best={mode:m,min:t}});
  if(route<1.5)best={mode:'walk',min:route/5*60};
  return {km:route,min:round5(best.min),mode:best.mode};
}
function hopKm(a,b){
  var A=C[a],B=C[b];
  if(!A.custom&&!B.custom)return hav([A.lat,A.lng],[B.lat,B.lng]);
  return Math.max(A.custom?(A.km||150):0,B.custom?(B.km||150):0);
}
function hop(a,b,ms){
  var km=hopKm(a,b),same=C[a].co===C[b].co,r=km*1.15,rail=CO[C[a].co].rail||100;
  var av={
    train:same&&km<1000?{min:40+r/rail*60,cost:200+4*km}:null,
    drive:same&&km<900?{min:15+r/75*60,cost:150+2.5*km}:null,
    bus:same&&km<900?{min:30+r/60*60,cost:100+2*km}:null
  };
  var fl={mode:'flight',min:180+km/800*60,cost:2500+2.5*km},pool=[];
  // 渡輪：只有選了渡輪，且該城市組合有航線（內建航線或自訂城市）才會採用
  if(st.modes.indexOf('ferry')>-1&&(FERRY[[a,b].sort().join('|')]||C[a].custom||C[b].custom)){
    var fr=km*1.2;
    return {from:a,to:b,km:fr,min:round5(60+fr/35*60),mode:'ferry',cost:300+3*km};
  }
  ['train','drive','bus'].forEach(function(m){if(av[m]&&ms.indexOf(m)>-1)pool.push({mode:m,min:av[m].min,cost:av[m].cost})});
  if(!pool.length)['train','drive','bus'].forEach(function(m){if(av[m])pool.push({mode:m,min:av[m].min,cost:av[m].cost})});
  var best=pool.sort(function(x,y){return x.min-y.min})[0];
  if(!best||(best.min>360&&fl.min<best.min))best=fl;
  return {from:a,to:b,km:r,min:round5(best.min),mode:best.mode,cost:best.cost};
}
function orderCities(list){return list.slice()}
// 一次性「依距離自動排序」：從離台北最近的城市出發，每次接最近的下一個城市
function distOrder(list){
  if(list.length<2)return list.slice();
  var TP=[25.04,121.55],pre=list.filter(function(k){return !C[k].custom}),cu=list.filter(function(k){return C[k].custom});
  var start=pre.length?pre.slice().sort(function(a,b){return hav(TP,[C[a].lat,C[a].lng])-hav(TP,[C[b].lat,C[b].lng])})[0]:cu[0];
  var out=[start],rest=list.filter(function(k){return k!==start});
  while(rest.length){var cur=out[out.length-1];rest.sort(function(a,b){return hopKm(cur,a)-hopKm(cur,b)});out.push(rest.shift())}
  return out;
}
function orderDistricts(k,ds){
  if(ds.length<2)return ds.slice();
  var pos=ds.map(function(d){return {d:d,p:distLL(k,d)}}),out=[pos.shift()];
  while(pos.length){var cur=out[out.length-1];pos.sort(function(a,b){return hav(cur.p,a.p)-hav(cur.p,b.p)});out.push(pos.shift())}
  return out.map(function(o){return o.d});
}
// 自駕：選了自駕又選其他工具 → 每天自選；只選自駕 → 每天自動勾選
function hasDrive(){return st.modes.indexOf('drive')>-1}
function onlyDrive(){return st.modes.length===1&&st.modes[0]==='drive'}
function dayDrive(no){return hasDrive()&&(onlyDrive()||!!(DAYS[no]&&DAYS[no].drive))}
var FERRY={'fuk|pus':1};
function modesFor(drv){
  if(drv)return ['drive'];
  var o=st.modes.filter(function(m){return m!=='drive'&&m!=='ferry'});
  return o.length?o:['metro'];
}

