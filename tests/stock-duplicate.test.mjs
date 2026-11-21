import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/lib/stock/duplicate.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {duplicateComplete}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const original={id:'old',businessId:null,stockKind:'complete',platform:'Prime Video',username:'fixture@example.test'};
test('blocks only the same complete account in the same platform and business',()=>{
  assert.equal(duplicateComplete([original],{...original,id:'',username:' FIXTURE@example.test ',platform:'Prime Video '}),original);
  assert.equal(duplicateComplete([original],{...original,id:'',platform:'Crunchyroll'}),undefined);
  assert.equal(duplicateComplete([original],{...original,id:'',businessId:'another'}),undefined);
  assert.equal(duplicateComplete([original],original),undefined);
});
test('profiles sharing a login can be added again after deletion and do not reserve complete accounts',()=>{
  const profile={...original,id:'profile',stockKind:'profile'};
  assert.equal(duplicateComplete([original],profile),undefined);
  assert.equal(duplicateComplete([profile],{...original,id:''}),undefined);
  assert.equal(duplicateComplete([],{...original,id:''}),undefined);
});
