const UUID='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PATH=new RegExp('^r2:('+UUID+')/('+UUID+')\\.jpg$','i');
const MAX_BYTES=10*1024*1024;
class Failure extends Error { constructor(status,message){super(message);this.status=status} }
function parsePath(path){const m=PATH.exec(path||'');if(!m)throw new Failure(400,'Invalid photo path');return {trip:m[1],key:path.slice(3)}}
async function api(env,token,route,options={}){
  const response=await fetch(env.SUPABASE_URL+route,{...options,headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:token,'Content-Type':'application/json',...options.headers}});
  if(!response.ok)throw new Failure(response.status===401?401:403,'Supabase authorization failed');
  return response.json();
}
async function user(env,request){
  const token=request.headers.get('Authorization');
  if(!/^Bearer \S+$/.test(token||''))throw new Failure(401,'Please sign in');
  const result=await api(env,token,'/auth/v1/user');
  if(!result.id||!result.email_confirmed_at)throw new Failure(403,'Confirmed account required');
  return {id:result.id,token};
}
async function shared(env,token,trip){
  const result=await api(env,token,'/rest/v1/rpc/get_shared_trip',{method:'POST',body:JSON.stringify({p_id:trip})});
  if(!result)throw new Failure(403,'Trip not accessible');
}
async function signature(env,path,expires){
  if(!env.PHOTO_SIGNING_KEY||env.PHOTO_SIGNING_KEY.length<32)throw new Failure(503,'Photo signing key not configured');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.PHOTO_SIGNING_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(path+'\n'+expires));
  return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
}
function equal(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})}
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin');
  const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  const cors=origin&&allowed.includes(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
  let response;
  try{
   if(origin&&!allowed.includes(origin))throw new Failure(403,'Origin not allowed');
   if(request.method==='OPTIONS')response=new Response(null,{status:204,headers:{'Access-Control-Allow-Methods':'GET, PUT, POST, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'}});
   else {
    const url=new URL(request.url),path=url.searchParams.get('path');
    if(url.pathname==='/health'&&request.method==='GET'){
     const checks={
      supabase:Boolean(env.SUPABASE_URL&&env.SUPABASE_ANON_KEY),
      signing:Boolean(env.PHOTO_SIGNING_KEY&&env.PHOTO_SIGNING_KEY.length>=32),
      r2:Boolean(env.PHOTOS&&typeof env.PHOTOS.head==='function')
     };
     response=json(checks,Object.values(checks).every(Boolean)?200:503);
    }else if(url.pathname==='/object'&&request.method==='GET'){
     const {key}=parsePath(path),expires=url.searchParams.get('expires'),sig=url.searchParams.get('signature')||'';
     const now=Math.floor(Date.now()/1000);
     if(!/^\d+$/.test(expires||'')||Number(expires)<=now||Number(expires)>now+3600||!equal(await signature(env,path,expires),sig))throw new Failure(403,'Photo link expired or invalid');
     const object=await env.PHOTOS.get(key);
     if(!object)throw new Failure(404,'Photo not found');
     response=new Response(object.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
    }else if(url.pathname==='/object'&&['PUT','DELETE'].includes(request.method)){
     const {trip,key}=parsePath(path),account=await user(env,request);
     if(request.method==='PUT'){
      await shared(env,account.token,trip);
      if(request.headers.get('Content-Type')!=='image/jpeg')throw new Failure(415,'JPEG required');
      const size=Number(request.headers.get('Content-Length'));
      if(!Number.isSafeInteger(size)||size<3||size>MAX_BYTES)throw new Failure(413,'Photo must be at most 10 MiB');
      // Enforce the limit while reading, including requests with dishonest headers.
      const reader=request.body?.getReader();if(!reader)throw new Failure(400,'Photo body required');
      const chunks=[];let total=0;
      for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>MAX_BYTES){await reader.cancel();throw new Failure(413,'Photo too large')}chunks.push(value)}
      const data=new Uint8Array(total);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length}
      if(total!==size||data[0]!==255||data[1]!==216||data[2]!==255)throw new Failure(400,'Invalid JPEG');
      const stored=await env.PHOTOS.put(key,data,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'image/jpeg'},customMetadata:{user_id:account.id}});
      if(!stored)throw new Failure(409,'Photo already exists');
      response=json({path});
     }else{
      const object=await env.PHOTOS.head(key);
      if(object&&object.customMetadata?.user_id!==account.id)throw new Failure(403,'Only the uploader may delete a photo');
      if(object)await env.PHOTOS.delete(key);
      response=json({deleted:true});
     }
    }else if(url.pathname==='/urls'&&request.method==='POST'){
     const account=await user(env,request);
     const body=await request.json();
     if(!Array.isArray(body.paths)||!body.paths.length||body.paths.length>100)throw new Failure(400,'Request 1–100 photo paths');
     const trips=new Set(body.paths.map(p=>parsePath(p).trip));
     if(trips.size!==1)throw new Failure(400,'Request one trip at a time');
     const trip=Array.from(trips)[0];await shared(env,account.token,trip);
     // Use the caller's JWT and existing database row-level security, never a service role.
     const rows=await api(env,account.token,'/rest/v1/trip_photos?select=path&trip_id=eq.'+encodeURIComponent(trip));
     const visible=new Set(rows.map(p=>p.path));
     if(body.paths.some(p=>!visible.has(p)))throw new Failure(403,'Photo not accessible');
     const expires=String(Math.floor(Date.now()/1000)+3600);
     const urls=await Promise.all(body.paths.map(async path=>({path,url:url.origin+'/object?'+new URLSearchParams({path,expires,signature:await signature(env,path,expires)})})));
     response=json({urls});
    }else throw new Failure(404,'Not found');
   }
  }catch(error){response=json({error:error instanceof Failure?error.message:'Photo request failed'},error instanceof Failure?error.status:500)}
  for(const [key,value] of Object.entries(cors))response.headers.set(key,value);
  response.headers.set('Cache-Control','private, no-store');
  return response;
 }
};
