import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const moduleURL=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const themeURL=moduleURL(compile(await readFile(new URL('../src/lib/appearance/theme.ts',import.meta.url),'utf8')));
const theme=await import(themeURL);
const factory=moduleURL(`export const createServerFn=()=>({validator:validate=>({handler:handler=>async({data})=>handler({data:validate(data)})})});`);
const auth=moduleURL(`export const requireAdminCode=async code=>{if(code!==globalThis.__appearance.code)throw new Error('Unauthorized')};`);
const owner=moduleURL(`export const requireOwnerCtx=async token=>{if(token!=='owner-token-valid')throw new Error('Unauthorized');return {business:{id:globalThis.__appearance.businessId}}};export const requireFeature=()=>{if(!globalThis.__appearance.enabled)throw new Error('Feature disabled')};`);
const db=moduleURL(`export const supabaseAdmin=new Proxy({},{get:(_,key)=>globalThis.__appearance.db[key]});`);
const api=await import(moduleURL(compile(await readFile(new URL('../src/lib/appearance/appearance.functions.ts',import.meta.url),'utf8'))
.replaceAll('"@tanstack/react-start"',JSON.stringify(factory)).replaceAll('"zod"',JSON.stringify(import.meta.resolve('zod')))
.replaceAll('"./theme"',JSON.stringify(themeURL)).replaceAll('"@/lib/notify/notify.server"',JSON.stringify(auth))
.replaceAll('"@/lib/menus/menus.server"',JSON.stringify(owner)).replaceAll('"@/integrations/supabase/client.server"',JSON.stringify(db))));
function fixture(){const s={code:'ma2s_'+'a'.repeat(64),businessId:crypto.randomUUID(),enabled:true,writes:[],uploads:[]};s.db={from:table=>{assert.equal(table,'menu_businesses');let payload,id;const q={update:p=>{payload=p;return q},eq:(k,v)=>{assert.equal(k,'id');id=v;return q},select:()=>q,maybeSingle:async()=>{s.writes.push({id,payload});return{data:{id},error:null}}};return q;},storage:{from:bucket=>{assert.equal(bucket,'ma2-images');return{createSignedUploadUrl:async(path,opts)=>{s.uploads.push({path,opts});return{data:{token:'signed'},error:null}},getPublicUrl:path=>({data:{publicUrl:`https://example.test/${path}`}})}}}};globalThis.__appearance=s;return s;}
test('appearance rejects unsafe image URLs and clamps percentages without fading text',()=>{
 const a=theme.normalizeAppearance({coverImage:'javascript:alert(1)',logoImage:'https://example.test/"bad',pageImage:'data:image/svg+xml,test',cardImage:'https://example.test/season.jpg',cardOpacity:-5,imageOpacity:120,season:'unknown'});
 assert.equal(a.coverImage,'');assert.equal(a.logoImage,'');assert.equal(a.pageImage,'');assert.equal(a.cardOpacity,0);assert.equal(a.imageOpacity,100);assert.equal(a.season,'normal');
 const style=theme.appearanceStyle(a);assert.equal(style.opacity,undefined);assert.equal(style['--ma2-card-opacity'],'0%');assert.equal(style['--ma2-decoration-opacity'],1);assert.match(style['--ma2-card-image'],/season.jpg/);
 assert.deepEqual(theme.normalizeAppearance(null),theme.DEFAULT_APPEARANCE);
});
test('appearance endpoints reject unauthenticated callers before issuing uploads or writing',async()=>{
 const s=fixture();await assert.rejects(api.appearanceUploadTicket({data:{code:'wrong',contentType:'image/png',size:100}}),/Unauthorized/);await assert.rejects(api.businessSaveAppearance({data:{code:'wrong',businessId:s.businessId,appearance:theme.DEFAULT_APPEARANCE}}),/Unauthorized/);assert.equal(s.writes.length+s.uploads.length,0);
});
test('business owners are scoped to their own business and their edit permission',async()=>{
 const s=fixture();const data={ownerToken:'owner-token-valid',businessId:crypto.randomUUID(),appearance:theme.DEFAULT_APPEARANCE};await assert.rejects(api.businessSaveAppearance({data}),/No tienes acceso/);assert.equal(s.writes.length,0);
 data.businessId=s.businessId;s.enabled=false;await assert.rejects(api.businessSaveAppearance({data}),/Feature disabled/);assert.equal(s.writes.length,0);s.enabled=true;await api.businessSaveAppearance({data});assert.equal(s.writes[0].id,s.businessId);assert.deepEqual(s.writes[0].payload,{appearance:theme.DEFAULT_APPEARANCE});
 const ticket=await api.appearanceUploadTicket({data:{ownerToken:data.ownerToken,contentType:'image/png',size:100}});assert.match(ticket.path,new RegExp(`^branding/${s.businessId}/`));assert.equal(s.uploads[0].opts.upsert,false);
});
test('administrator appearance saves preserve all unrelated business fields',async()=>{
 const s=fixture();const appearance={...theme.DEFAULT_APPEARANCE,cardOpacity:40,season:'navidad',coverImage:'https://example.test/cover.png'};await api.businessSaveAppearance({data:{code:s.code,businessId:s.businessId,appearance}});assert.deepEqual(s.writes[0],{id:s.businessId,payload:{appearance}});
});
test('oversized files and SVG are rejected before issuing upload credentials',async()=>{
 const s=fixture();for(const data of [{contentType:'image/svg+xml',size:100},{contentType:'image/png',size:5_242_881}])await assert.rejects(api.appearanceUploadTicket({data:{code:s.code,...data}}));assert.equal(s.uploads.length,0);
});
const typesURL=moduleURL(compile(await readFile(new URL('../src/lib/catalog/types.ts',import.meta.url),'utf8')));
const seedURL=moduleURL(compile(await readFile(new URL('../src/lib/catalog/seed.ts',import.meta.url),'utf8')).replaceAll('"./types"',JSON.stringify(typesURL)));
const {createSeedState}=await import(seedURL);
const {normalizeState}=await import(moduleURL(compile(await readFile(new URL('../src/lib/catalog/storage.ts',import.meta.url),'utf8')).replaceAll('"./types"',JSON.stringify(typesURL)).replaceAll('"./seed"',JSON.stringify(seedURL)).replaceAll("'@/lib/appearance/theme'",JSON.stringify(themeURL))));
test('main catalog appearance survives JSON reload and stays separate per catalog',()=>{
 const state=createSeedState();state.catalogs.clientes.appearance={...theme.DEFAULT_APPEARANCE,cardOpacity:35,season:'halloween',coverImage:'https://example.test/cover.png'};
 const reloaded=normalizeState(JSON.parse(JSON.stringify(state)));assert.deepEqual(reloaded.catalogs.clientes.appearance,state.catalogs.clientes.appearance);assert.equal(reloaded.catalogs.revendedores.appearance.season,'normal');
});
