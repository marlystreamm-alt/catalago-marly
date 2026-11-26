import test from 'node:test';
import assert from 'node:assert/strict';
import {daysRemaining,renewalTone,renewalLimits,inventoryTone,inventoryLevels} from '../src/lib/stock/traffic-light.ts';
const today='2026-11-25';
test('renewal traffic lights use whole calendar days, including the due date',()=>{
 assert.equal(daysRemaining('2026-11-25',today),0);
 assert.deepEqual([-1,0,3,4,7,8,null].map(d=>renewalTone(d)),['expired','red','red','yellow','yellow','green','unknown']);
 assert.deepEqual(renewalLimits('2','5'),{red:2,yellow:5});
 assert.equal(renewalTone(3,renewalLimits('2','5')),'yellow');
 assert.deepEqual(renewalLimits('9','4'),{red:3,yellow:7});
});
test('inventory includes zero-stock products, separates kinds and excludes unavailable or invalid units',()=>{
 const unit=(id,extra={})=>({id,platform:'Disney',stockKind:'profile',durationMonths:1,parentStockId:null,accountType:'Perfil',status:'available',expiresOn:null,username:'fixture',password:'fixture',...extra});
 const groups=inventoryLevels([unit('a'),unit('b',{status:'assigned'}),unit('c',{expiresOn:'2026-11-24'}),unit('d',{password:''}),unit('e',{stockKind:'complete',accountType:'split_parent'}),unit('f',{parentStockId:'e'})],today,[{name:'Netflix',kind:'complete',months:1,available:0},{name:'Disney',kind:'complete',months:1,available:0},{name:'Canva',kind:'manual',months:1,available:0}]);
 assert.deepEqual(groups.map(x=>[x.platform,x.kind,x.available]),[['Disney','complete',0],['Netflix','complete',0],['Disney','profile',2]]);
 assert.deepEqual([0,1,2,3,20].map(inventoryTone),['red','yellow','yellow','green','green']);
});
test('published inventory counts remain authoritative instead of double counting',()=>{
 const rows=inventoryLevels([{id:'a',platform:'Prime',stockKind:'profile',parentStockId:null,accountType:'Perfil',status:'available',expiresOn:null,username:'a',password:'b'}],today,[{name:'Prime',kind:'profile',months:1,available:4}]);
 assert.equal(rows[0].available,4);
});
