import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const trip='11111111-1111-4111-8111-111111111111';
const oldPath=trip+'/old.jpg';
const target='r2:'+trip+'/22222222-2222-4222-8222-222222222222.jpg';
const row={id:'photo-row',trip_id:trip,path:oldPath,user_id:'user-a'};
const jpeg=new Uint8Array([255,216,255,217]);

function fixture(options={}){
  const events=[];
  const storage={
    async createSignedUrl(path){events.push('sign-old:'+path);return {data:{signedUrl:'https://old.example/photo'}}},
    async remove(paths){events.push('delete-old:'+paths[0]);return {}}
  };
  const sb={
    storage:{from(bucket){assert.equal(bucket,'trip-photos');return storage}},
    from(table){
      assert.equal(table,'trip_photos');
      return {update(patch){
        const chain={eq(){return chain},async select(){
          const rollback=patch.path===oldPath;
          events.push((rollback?'rollback:':'update:')+patch.path);
          if(rollback&&options.rollbackFails)return {error:new Error('rollback denied')};
          return {data:[{id:row.id}]};
        }};
        return chain;
      }};
    }
  };
  const elements=new Map();
  const context=vm.createContext({
    sb,ME:{id:'user-a'},Blob,Response,
    crypto:{randomUUID(){return '22222222-2222-4222-8222-222222222222'}},
    fetch:async url=>{
      events.push('fetch:'+url);
      if(url.includes('new.example')&&options.verifyFails)return new Response('bad',{status:500});
      return new Response(jpeg,{status:200,headers:{'Content-Type':'image/jpeg'}});
    },
    uploadPhotoFile:async(path,blob)=>{events.push('upload:'+path);assert.equal(blob.size,jpeg.length)},
    removePhotoFile:async path=>{events.push('delete-r2:'+path)},
    photoUrls:async paths=>{events.push('sign-r2:'+paths[0]);return {[paths[0]]:'https://new.example/photo'}},
    bootPage(){},on(){},
    $(id){if(!elements.has(id))elements.set(id,{disabled:false,hidden:false,textContent:'',scrollTop:0,scrollHeight:0});return elements.get(id)}
  });
  vm.runInContext(fs.readFileSync(new URL('../js/migrate-r2.js',import.meta.url),'utf8'),context);
  return {context,events};
}

test('migration verifies R2 before deleting the Supabase source',async()=>{
  const {context,events}=fixture();
  assert.equal(await context.migratePhoto(row),'');
  assert.ok(events.indexOf('update:'+target)<events.indexOf('sign-r2:'+target));
  assert.ok(events.indexOf('fetch:https://new.example/photo')<events.indexOf('delete-old:'+oldPath));
  assert.ok(!events.some(event=>event.startsWith('delete-r2:')));
});

test('failed R2 verification restores the database path and removes the copy',async()=>{
  const {context,events}=fixture({verifyFails:true});
  await assert.rejects(context.migratePhoto(row),/R2 驗證讀取失敗/);
  assert.ok(events.includes('rollback:'+oldPath));
  assert.ok(events.includes('delete-r2:'+target));
  assert.ok(!events.includes('delete-old:'+oldPath));
});

test('failed rollback preserves R2 and reports manual recovery',async()=>{
  const {context,events}=fixture({verifyFails:true,rollbackFails:true});
  await assert.rejects(context.migratePhoto(row),/資料庫無法復原/);
  assert.ok(!events.includes('delete-r2:'+target));
  assert.ok(!events.includes('delete-old:'+oldPath));
});
