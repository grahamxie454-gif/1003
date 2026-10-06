import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
function client(){
 const calls=[];
 const context=vm.createContext({sb:{auth:{async getSession(){return {data:{session:{access_token:'session-token'}}}}},storage:{from(bucket){assert.equal(bucket,'trip-photos');return {
 async createSignedUrls(paths){calls.push(['legacy-urls',paths]);return {data:paths.map(path=>({path,signedUrl:'https://old.example/'+path}))}},
 async upload(path){calls.push(['legacy-upload',path]);return {}},async remove(paths){calls.push(['legacy-delete',paths]);return {}}
 }}}},fetch:async(url,options)=>{calls.push([url,options]);assert.equal(options.headers.Authorization,'Bearer session-token');return {ok:true,json:async()=>({urls:(url.endsWith('/urls')?JSON.parse(options.body).paths:[]).map(path=>({path,url:'https://new.example/'+path}))})}}});
 vm.runInContext(fs.readFileSync(new URL('../js/photo-storage.js',import.meta.url),'utf8'),context);
 return {context,calls};
}
test('mixed photo lists preserve old signed URLs and request R2 URLs with the user session',async()=>{
 const {context,calls}=client();context.R2_PHOTO_URL='https://photos.example/';
 const urls=await context.photoUrls(['old.jpg','r2:new.jpg']);
 assert.equal(urls['old.jpg'],'https://old.example/old.jpg');assert.equal(urls['r2:new.jpg'],'https://new.example/r2:new.jpg');
 assert.equal(calls[1][0],'https://photos.example/urls');
});
test('upload and cleanup select each photo provider',async()=>{
 const {context,calls}=client();context.R2_PHOTO_URL='https://photos.example';
 await context.uploadPhotoFile('old.jpg',new Blob());await context.uploadPhotoFile('r2:new.jpg',new Blob());
 await context.removePhotoFile('old.jpg');await context.removePhotoFile('r2:new.jpg');
 assert.equal(calls[0][0],'legacy-upload');assert.equal(calls[1][1].method,'PUT');
 assert.equal(calls[2][0],'legacy-delete');assert.equal(calls[3][1].method,'DELETE');
});
test('missing endpoint and failed Worker responses report errors',async()=>{
 const {context}=client();context.R2_PHOTO_URL='';
 await assert.rejects(context.photoUrls(['r2:new.jpg']),/尚未設定/);
 context.R2_PHOTO_URL='https://photos.example';context.fetch=async()=>({ok:false,json:async()=>({error:'Access denied'})});
 await assert.rejects(context.removePhotoFile('r2:new.jpg'),/Access denied/);
});
