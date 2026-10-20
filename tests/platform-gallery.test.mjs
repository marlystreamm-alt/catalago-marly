import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const moduleURL=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
const factory=moduleURL(`export const createServerFn=()=>({validator:validate=>({handler:handler=>async({data})=>handler({data:validate(data)})})});`);
const auth=moduleURL(`export const requireAdminCode=async code=>{if(code!==globalThis.__gallery.code)throw new Error('Unauthorized')};export const admin=async()=>globalThis.__gallery.db;`);
const encryption=moduleURL(`export const encryptPayload=async v=>'encrypted:'+JSON.stringify(v);export const decryptPayload=async v=>JSON.parse(v.slice(10));`);
const source=await readFile(new URL('../src/lib/gallery/gallery.functions.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
 .replaceAll("'@tanstack/react-start'",JSON.stringify(factory)).replaceAll("'zod'",JSON.stringify(import.meta.resolve('zod')))
 .replaceAll("'@/lib/notify/notify.server'",JSON.stringify(auth)).replaceAll("'@/lib/deliveries/deliveries.server'",JSON.stringify(encryption));
const api=await import(moduleURL(compiled));
function fixture(){
 const state={code:'ma2s_'+ 'a'.repeat(64),rows:[],calls:0};
 state.db={from:table=>{assert.equal(table,'ma2_platform_gallery');state.calls++;let cols='*',patch=null,insert=null,filters=[];
 const execute=()=>{if(insert)state.rows.push({id:crypto.randomUUID(),created_at:new Date().toISOString(),archived_at:null,...insert});let rows=state.rows.filter(r=>filters.every(([k,v])=>r[k]===v));if(patch)rows.forEach(r=>Object.assign(r,patch));return rows.map(r=>cols==='*'?{...r}:Object.fromEntries(cols.split(',').map(k=>[k,r[k]])));};
 const q={select:c=>{cols=c;return q;},insert:v=>{insert=v;return q;},update:v=>{patch=v;return q;},eq:(k,v)=>{filters.push([k,v]);return q;},is:(k,v)=>{filters.push([k,v]);return q;},order:()=>q,range:()=>q,ilike:()=>q,single:async()=>({data:execute()[0]??null,error:null}),maybeSingle:async()=>({data:execute()[0]??null,error:null}),then:(resolve,reject)=>Promise.resolve({data:execute(),error:null}).then(resolve,reject)};return q;}};
 globalThis.__gallery=state;return state;
}
const image='data:image/jpeg;base64,ZmFrZQ==';
async function save(state){await api.gallerySave({data:{code:state.code,title:'Cómo ingresar',platform:'Netflix',image,thumbnail:image}});return state.rows[0].id;}
test('gallery requires the administrator for reading, saving, selecting and archiving',async()=>{
 const s=fixture();const id=crypto.randomUUID();
 for(const [fn,data] of [[api.galleryList,{}],[api.gallerySave,{title:'Guide',platform:'Test',image,thumbnail:image}],[api.galleryGetImage,{id}],[api.galleryArchive,{id}]])await assert.rejects(fn({data:{code:'wrong',...data}}),/Unauthorized/);
 assert.equal(s.calls,0);
});
test('gallery saves the full image encrypted and lists only previews',async()=>{
 const s=fixture();const id=await save(s);assert.notEqual(s.rows[0].image_cipher,image);assert.equal(s.rows[0].image,undefined);
 const list=await api.galleryList({data:{code:s.code}});assert.equal(list.images.length,1);assert.equal(list.images[0].image_cipher,undefined);assert.equal(list.images[0].thumbnail,image);
 assert.equal((await api.galleryGetImage({data:{code:s.code,id}})).image,image);
});
test('retiring a gallery image leaves the existing delivery snapshot intact',async()=>{
 const s=fixture();const id=await save(s);const document={images:[(await api.galleryGetImage({data:{code:s.code,id}})).image]};
 await api.galleryArchive({data:{code:s.code,id}});assert.equal((await api.galleryList({data:{code:s.code}})).images.length,0);
 await assert.rejects(api.galleryGetImage({data:{code:s.code,id}}),/no está disponible/);assert.deepEqual(document.images,[image]);assert.equal(s.rows.length,1);
});
test('SVG and oversized uploads are rejected before database writes',async()=>{
 const s=fixture();for(const invalid of ['data:image/svg+xml;base64,ZmFrZQ==','data:image/jpeg;base64,'+'A'.repeat(1_800_000)])await assert.rejects(api.gallerySave({data:{code:s.code,title:'Test',platform:'Test',image:invalid,thumbnail:image}}));assert.equal(s.calls,0);
});

const linkedDB=moduleURL(`export const supabaseAdmin={from:()=>({update:()=>({eq:()=>({is:async()=>({error:null})})})})};`);
const linkedOrders=moduleURL(`
 export const listCyberDocsOrders=async()=>[globalThis.__linkedGallery.order];
 export const assignStockToOrder=async input=>{globalThis.__linkedGallery.assignments.push(input);Object.assign(globalThis.__linkedGallery.order,{stockItemId:input.stockItemId,protectedDeliveryId:'doc-1'});return {order:globalThis.__linkedGallery.order,token:'delivery-token'}};
 export const updateOrderRenewal=async()=>{};
 export const finalizeCyberDocsOrder=async()=>{globalThis.__linkedGallery.order.status='completed'};
`);
const linkedDeliveries=moduleURL(`export const getDeliveryRow=async()=>({detail:JSON.stringify({status:'active',token:'delivery-token'})});export const decryptPayload=async s=>JSON.parse(s);`);
const linkedSource=await readFile(new URL('../src/lib/stock/linked-delivery.server.ts',import.meta.url),'utf8');
const linkedCompiled=ts.transpileModule(linkedSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
 .replaceAll('"@/integrations/supabase/client.server"',JSON.stringify(linkedDB)).replaceAll('"@/lib/cyberdocs/cyberdocs.server"',JSON.stringify(linkedOrders)).replaceAll('"@/lib/deliveries/deliveries.server"',JSON.stringify(linkedDeliveries));
const linked=await import(moduleURL(linkedCompiled));
test('stock delivery forwards gallery images to the Cyberdoc document and retry reuses its link',async()=>{
 globalThis.__linkedGallery={order:{id:'order-1',cyberdocsOrderId:'external-1',status:'new',stockItemId:null,protectedDeliveryId:null,clientName:'Fixture'},assignments:[]};
 const input={itemId:'stock-1',relatedOrderId:'order-1',accessPassword:'',expiresAt:'2099-01-01T00:00:00Z',maxViews:null,notes:'',stockExpiresOn:null,salePrice:80,attachment:null,images:[image]};
 const first=await linked.deliverLinkedOrder(input);const retry=await linked.deliverLinkedOrder(input);
 assert.deepEqual(globalThis.__linkedGallery.assignments[0].images,[image]);assert.equal(globalThis.__linkedGallery.assignments.length,1);assert.equal(first.token,retry.token);assert.equal(first.id,'doc-1');
});
