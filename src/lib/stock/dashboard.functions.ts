import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { stockDashboardSummary, type DashboardStock } from './dashboard-summary';

export const adminDashboard = createServerFn({ method: 'POST' })
  .validator((d: unknown) => z.object({ code: z.string().min(4) }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdminCode, admin } = await import('@/lib/notify/notify.server');
    await requireAdminCode(data.code);
    const db = await admin();
    const rows: DashboardStock[] = [];
    for (let from = 0; ; from += 1000) {
      const result = await db.from('stock_items')
        .select('id,platform,status,parent_stock_id,expires_on,delivered_on,cost,sale_price')
        .is('business_id', null).order('id').range(from, from + 999);
      if (result.error) throw new Error('No se pudo cargar el resumen de stock');
      rows.push(...(result.data ?? []) as DashboardStock[]);
      if ((result.data?.length ?? 0) < 1000) break;
    }
    const orders = await db.from('cyberdocs_orders').select('id', { count: 'exact', head: true })
      .in('status', ['new', 'in_process']);
    if (orders.error) throw new Error('No se pudo cargar el resumen de pedidos');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    return { ...stockDashboardSummary(rows, today), pending: orders.count ?? 0, updatedAt: new Date().toISOString() };
  });
