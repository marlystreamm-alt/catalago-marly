import {createClient} from "@supabase/supabase-js";
import {CUSTOMER_IDENTITY_CALLBACK} from "./identity-policy";
let googleClient:ReturnType<typeof createClient>|undefined,emailClient:ReturnType<typeof createClient>|undefined;
// Isolate customer identity proofs from the administrator's existing Auth session.
export function customerIdentityClient(mode:"google"|"email"){
 const existing=mode==="google"?googleClient:emailClient;if(existing)return existing;
 const url=import.meta.env.VITE_SUPABASE_URL||"https://dqynxsayqpwhjtfuonyd.supabase.co";
 const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||"sb_publishable_jTnGvywiZOOCaZd_JNZ-6w_pa-SIi7j";
 const client=createClient(url,key,{global:{fetch:(input,init)=>{const headers=new Headers(typeof Request!=="undefined"&&input instanceof Request?input.headers:undefined);if(init?.headers)new Headers(init.headers).forEach((v,k)=>headers.set(k,v));if(key.startsWith("sb_publishable_")&&headers.get("Authorization")===`Bearer ${key}`)headers.delete("Authorization");headers.set("apikey",key);return fetch(input,{...init,headers});}},auth:{storageKey:`ma2-customer-proof-${mode}`,persistSession:mode==="google",autoRefreshToken:false,detectSessionInUrl:true,flowType:mode==="google"?"pkce":"implicit"}});
 if(mode==="google")googleClient=client;else emailClient=client;return client;
}
export async function startCustomerGoogle(){
 const {error}=await customerIdentityClient("google").auth.signInWithOAuth({provider:"google",options:{redirectTo:`${CUSTOMER_IDENTITY_CALLBACK}?modo=google`,queryParams:{prompt:"select_account"}}});
 if(error)throw Error("Google no está disponible. Intenta entrar con correo y contraseña.");
}
