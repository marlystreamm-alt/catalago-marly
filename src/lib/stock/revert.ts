import type {StockItem} from './types';
/** Preserve the original account, and reject any reversal that includes delivered profiles. */
export function stockRevertPlan(items:StockItem[],selected:StockItem){
 const parentId=selected.parentStockId||selected.id;
 const parent=items.find(item=>item.id===parentId);
 if(!parent)throw new Error('No se encontró la cuenta completa original');
 const children=items.filter(item=>item.parentStockId===parentId);
 if(selected.parentStockId&&parent.stockKind!=='complete')throw new Error('El registro original no es una cuenta completa');
 if(children.some(item=>item.status!=='available'||item.businessId!==parent.businessId))throw new Error('No se puede revertir: uno o más perfiles ya están vendidos/asignados');
 if(!children.length&&parent.status!=='available')throw new Error('Solo puedes cambiar a completa un perfil disponible');
 if(children.length&&!['available','expired'].includes(parent.status))throw new Error('La cuenta original ya fue entregada; revisa su historial');
 return{children,item:{...parent,stockKind:'complete' as const,accountType:'Completa',parentStockId:null,status:'available' as const,notes:parent.notes.replace(/\n?Convertida a \d+ perfiles/g,'')}};
}
