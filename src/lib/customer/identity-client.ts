import {createClient} from "@supabase/supabase-js";
import {CUSTOMER_IDENTITY_CALLBACK,CUSTOMER_IDENTITY_AUTH_URL,CUSTOMER_IDENTITY_PUBLIC_KEY} from "./identity-policy";
let googleClient:ReturnType<typeof createClient>|undefined,emailClient:ReturnType<typeof createClient>|undefined;
// Isolate customer identity proofs from the administrator's existing Auth session.
export function customerIdentityClient(mode:"google"|"email"){
 const existing=mode==="google"?googleClient:emailClient;if(existing)return existing;
 const url=CUSTOMER_IDENTITY_AUTH_URL,key=CUSTOMER_IDENTITY_PUBLIC_KEY;
 const client=createClient(url,key,{global:{fetch:(input,init)=>{const headers=new Headers(typeof Request!=="undefined"&&input instanceof Request?input.headers:undefined);if(init?.headers)new Headers(init.headers).forEach((v,k)=>headers.set(k,v));if(key.startsWith("sb_publishable_")&&headers.get("Authorization")===`Bearer ${key}`)headers.delete("Authorization");headers.set("apikey",key);return fetch(input,{...init,headers});}},auth:{storageKey:`ma2-customer-proof-${mode}`,persistSession:mode==="google",autoRefreshToken:false,detectSessionInUrl:true,flowType:mode==="google"?"pkce":"implicit"}});
 if(mode==="google")googleClient=client;else emailClient=client;return client;
}
export async function startCustomerGoogle(){
 const {error}=await customerIdentityClient("google").auth.signInWithOAuth({provider:"google",options:{redirectTo:`${CUSTOMER_IDENTITY_CALLBACK}?modo=google`,queryParams:{prompt:"select_account"}}});
 if(error)throw Error("Google no está disponible. Intenta entrar con correo y contraseña.");
}
export async function customerGoogleAvailable(){
 try{const response=await fetch(`${CUSTOMER_IDENTITY_AUTH_URL}/auth/v1/settings`,{headers:{apikey:CUSTOMER_IDENTITY_PUBLIC_KEY},signal:AbortSignal.timeout(5000)});return response.ok&&(await response.json())?.external?.google===true;}catch{return false;}
}
