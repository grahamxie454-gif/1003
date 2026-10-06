// Set the deployed Worker HTTPS origin here to enable new uploads to R2.
// Public configuration only; never put R2 credentials or the signing key here.
var R2_PHOTO_URL='https://1003.grahamxie454.workers.dev';
async function r2PhotoRequest(route,options){
  if(!R2_PHOTO_URL)throw new Error('尚未設定 R2 照片服務網址');
  var session=await sb.auth.getSession();
  if(session.error)throw session.error;
  if(!session.data.session)throw new Error('請先登入');
  var response=await fetch(R2_PHOTO_URL.replace(/\/$/,'')+route,Object.assign({},options,{headers:Object.assign({},options&&options.headers,{Authorization:'Bearer '+session.data.session.access_token})}));
  var data=await response.json();
  if(!response.ok)throw new Error(data.error||'照片服務暫時無法使用');
  return data;
}
function isR2Photo(path){return path.indexOf('r2:')===0}
async function uploadPhotoFile(path,blob){
  if(isR2Photo(path))return r2PhotoRequest('/object?path='+encodeURIComponent(path),{method:'PUT',headers:{'Content-Type':'image/jpeg'},body:blob});
  var result=await sb.storage.from('trip-photos').upload(path,blob,{contentType:'image/jpeg'});
  if(result.error)throw result.error;
}
async function removePhotoFile(path){
  if(isR2Photo(path))return r2PhotoRequest('/object?path='+encodeURIComponent(path),{method:'DELETE'});
  var result=await sb.storage.from('trip-photos').remove([path]);
  if(result.error)throw result.error;
}
async function photoUrls(paths){
  var map={},old=paths.filter(function(p){return !isR2Photo(p)}),r2=paths.filter(isR2Photo);
  if(old.length){
    var result=await sb.storage.from('trip-photos').createSignedUrls(old,3600);
    if(result.error)throw result.error;
    (result.data||[]).forEach(function(p){if(p.signedUrl)map[p.path]=p.signedUrl});
  }
  for(var i=0;i<r2.length;i+=100){
    var data=await r2PhotoRequest('/urls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({paths:r2.slice(i,i+100)})});
    data.urls.forEach(function(p){map[p.path]=p.url});
  }
  return map;
}
