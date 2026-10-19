import { createFileRoute } from "@tanstack/react-router";
import { MenuMissing, MenuUnavailable, PublicMenuView } from "@/components/menus/public-menu";
import { menuPublicLoad } from "@/lib/menus/public.functions";
import type { MenuData, MenuSpace } from "@/lib/menus/types";
const RESERVED=new Set(["acceso","mi-catalogo","api","m","sitemap.xml","robots.txt","favicon.ico"]);
export const Route=createFileRoute("/$slug")({loader:({params})=>RESERVED.has(params.slug.toLowerCase())?null:menuPublicLoad({data:{slug:params.slug}}),head:({loaderData})=>{const d=loaderData as any;const name=d?.spaces?.length>1?d?.business?.name:(d?.space?.name||d?.business?.name||"Catálogo no disponible");return{meta:[{title:`${name} — MA² Connect`},{name:"description",content:d?.unavailable?"Servicio no disponible":`Consulta ${name}.`},...(!d||d.unavailable?[{name:"robots",content:"noindex"}]:[])]}},errorComponent:()=> <MenuMissing/>,notFoundComponent:()=> <MenuMissing/>,component:PublicCatalog});
function PublicCatalog(){const raw=Route.useLoaderData() as any;if(!raw)return <MenuMissing/>;if(raw.unavailable)return <MenuUnavailable business={raw.business}/>;return <PublicMenuView data={raw as MenuData & {space:MenuSpace}}/>}
