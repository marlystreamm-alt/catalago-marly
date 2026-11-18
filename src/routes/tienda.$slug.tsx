import {createFileRoute} from '@tanstack/react-router';
import {CustomerStore} from '@/components/customer/customer-store';
export const Route=createFileRoute('/tienda/$slug')({ssr:false,head:()=>({meta:[{title:'Mi cuenta y tienda · MA²'},{name:'robots',content:'noindex'},{name:'referrer',content:'no-referrer'}]}),component:()=>{const{slug}=Route.useParams();return <CustomerStore slug={slug}/>;}});
