import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import ts from "typescript";
const src=await readFile(new URL("../src/lib/customer/identity-policy.ts",import.meta.url),"utf8");
const {eligibleIdentityEmail,isCyberdocLogin,freshIdentityProof}=await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString("base64")}`);
const sid="ed6b43eb-a589-4fd5-994e-41c3857bf501";
test("normal customers can recover; reserved Cyberdoc and admin aliases cannot",()=>{assert.equal(isCyberdocLogin("Cyberdoc0001@martgor.shop"),true);assert.equal(eligibleIdentityEmail("cyberdoc0001@martgor.shop","admin@example.com"),false);assert.equal(eligibleIdentityEmail("ADMIN@example.com","admin@example.com"),false);assert.equal(eligibleIdentityEmail("buyer@example.com","admin@example.com"),true);});
test("identity proofs require a recent specific authentication method and session id",()=>{const now=1_000_000;const claims={session_id:sid,amr:[{method:"otp",timestamp:now-100}]};assert.equal(freshIdentityProof(claims,"otp",now),sid);assert.equal(freshIdentityProof({...claims,amr:[{method:"magiclink",timestamp:now-100}]},"otp",now),sid);assert.equal(freshIdentityProof(claims,"oauth",now),null);assert.equal(freshIdentityProof({...claims,amr:[{method:"password",timestamp:now}]},"otp",now),null);assert.equal(freshIdentityProof({...claims,amr:[{method:"otp",timestamp:now-901}]},"otp",now),null);assert.equal(freshIdentityProof({...claims,session_id:"fake"},"otp",now),null);assert.equal(freshIdentityProof({...claims,amr:[{method:"otp",timestamp:now+60}]},"otp",now),null);});
