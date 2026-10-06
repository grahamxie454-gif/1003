import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.mjs';
const trip='11111111-1111-4111-8111-111111111111';
const path='r2:'+trip+'/22222222-2222-4222-8222-222222222222.jpg';
const token='Bearer test-user-token';
function fixture(){
 const objects=new Map();let visible=true,owner='user-a';
 const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'public-anon',PHOTO_SIGNING_KEY:'a'.repeat(32),ALLOWED_ORIGINS:'https://example.com',PHOTOS:{
  async put(key,data,options){if(objects.has(key))return null;objects.set(key,{body:data,customMetadata:options.customMetadata});return {key}},
  async head(key){return objects.get(key)},async get(key){return objects.get(key)},async delete(key){objects.delete(key)}
 }};
 const nativeFetch=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  assert.equal(options.headers.Authorization,token);assert.equal(options.headers.apikey,'public-anon');
  if(url.endsWith('/auth/v1/user'))return Response.json({id:owner,email_confirmed_at:'2026-01-01'});
  if(url.includes('/rpc/'))return Response.json(visible?{is_owner:false}:null);
  if(url.includes('/trip_photos?'))return Response.json(visible?[{path}]:[]);
  throw new Error('Unexpected Supabase request');
 };
 return {env,objects,deny(){visible=false},otherUser(){owner='user-b'},restore(){globalThis.fetch=nativeFetch}};
}
function request(route,options={}){return new Request('https://photos.example.com'+route,{...options,headers:{Authorization:token,Origin:'https://example.com',...options.headers}})}
const objectRoute='/object?path='+encodeURIComponent(path);
const jpeg=new Uint8Array([255,216,255,217]);
function upload(){return request(objectRoute,{method:'PUT',headers:{'Content-Type':'image/jpeg','Content-Length':String(jpeg.length)},body:jpeg})}
test('upload, authorize URL, download, and delete an R2 photo',async()=>{
 const f=fixture();try{
  assert.equal((await worker.fetch(upload(),f.env)).status,200);
  assert.equal((await worker.fetch(upload(),f.env)).status,409);
  const urls=await worker.fetch(request('/urls',{method:'POST',body:JSON.stringify({paths:[path]})}),f.env);
  assert.equal(urls.status,200);const url=(await urls.json()).urls[0].url;
  const download=await worker.fetch(new Request(url),f.env);assert.equal(download.status,200);
  assert.deepEqual(new Uint8Array(await download.arrayBuffer()),jpeg);
  assert.equal((await worker.fetch(new Request(url.replace('signature=','signature=0')),f.env)).status,403);
  f.otherUser();assert.equal((await worker.fetch(request(objectRoute,{method:'DELETE'}),f.env)).status,403);
  assert.equal(f.objects.size,1);
 }finally{f.restore()}
});
test('uploader can clean up an object even after its database row is removed',async()=>{
 const f=fixture();try{
  await worker.fetch(upload(),f.env);f.deny();
  assert.equal((await worker.fetch(request(objectRoute,{method:'DELETE'}),f.env)).status,200);
  assert.equal(f.objects.size,0);
 }finally{f.restore()}
});
test('inaccessible trip cannot upload or receive photo URLs',async()=>{
 const f=fixture();try{f.deny();
  assert.equal((await worker.fetch(upload(),f.env)).status,403);
  assert.equal((await worker.fetch(request('/urls',{method:'POST',body:JSON.stringify({paths:[path]})}),f.env)).status,403);
  assert.equal(f.objects.size,0);
 }finally{f.restore()}
});
test('visible trip alone does not authorize a photo absent from RLS-visible rows',async()=>{
 const f=fixture();try{
  const other=path.replace('22222222','33333333');
  assert.equal((await worker.fetch(request('/urls',{method:'POST',body:JSON.stringify({paths:[other]})}),f.env)).status,403);
 }finally{f.restore()}
});
test('reject invalid paths, disallowed origins, and anonymous uploads',async()=>{
 const f=fixture();try{
  assert.equal((await worker.fetch(request('/object?path=../x',{method:'DELETE'}),f.env)).status,400);
  assert.equal((await worker.fetch(request(objectRoute,{method:'DELETE',headers:{Origin:'https://bad.example'}}),f.env)).status,403);
  assert.equal((await worker.fetch(new Request('https://photos.example.com'+objectRoute,{method:'DELETE'}),f.env)).status,401);
 }finally{f.restore()}
});
test('reject malformed and oversized image bodies',async()=>{
 const f=fixture();try{
  assert.equal((await worker.fetch(request(objectRoute,{method:'PUT',headers:{'Content-Type':'image/jpeg','Content-Length':'4'},body:'oops'}),f.env)).status,400);
  assert.equal((await worker.fetch(request(objectRoute,{method:'PUT',headers:{'Content-Type':'image/jpeg','Content-Length':String(11*1024*1024)},body:jpeg}),f.env)).status,413);
  assert.equal(f.objects.size,0);
 }finally{f.restore()}
});
test('expired links cannot read R2',async()=>{
 const f=fixture();try{
  assert.equal((await worker.fetch(new Request('https://photos.example.com'+objectRoute+'&expires=1&signature=aaa'),f.env)).status,403);
 }finally{f.restore()}
});
test('health check reports required Worker bindings without exposing values',async()=>{
 const f=fixture();try{
  const healthy=await worker.fetch(new Request('https://photos.example.com/health'),f.env);
  assert.equal(healthy.status,200);
  assert.deepEqual(await healthy.json(),{supabase:true,signing:true,r2:true});
  const unhealthy=await worker.fetch(new Request('https://photos.example.com/health'),{...f.env,PHOTO_SIGNING_KEY:''});
  assert.equal(unhealthy.status,503);
  assert.deepEqual(await unhealthy.json(),{supabase:true,signing:false,r2:true});
 }finally{f.restore()}
});
