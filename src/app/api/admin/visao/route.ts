import {getDatabase} from '@/lib/server/db';
import {adminError, adminResponse, requireAdmin} from '@/lib/server/admin-access';
export async function GET() {
  try {
    await requireAdmin();
    const db = getDatabase();
    const [orders, customers, totals, revenue, receipts] = await Promise.all([
      db.query(`SELECT o.id,o.status,o.total_cents,o.created_at,o.items,jsonb_build_object('phone',o.shipping_address->>'phone','notes',o.shipping_address->>'notes','delivery',o.shipping_address->>'delivery') AS contact,u.name AS customer_name,u.email AS customer_email,
        COALESCE((SELECT SUM(r.amount_cents) FROM zangraf_receipts r WHERE r.order_id=o.id),0)::text AS received_cents
        FROM zangraf_orders o JOIN "user" u ON u.id=o.user_id ORDER BY o.created_at DESC LIMIT 100`),
      db.query('SELECT id,name,email FROM "user" ORDER BY "createdAt" DESC LIMIT 100'),
      db.query(`SELECT
        (SELECT COUNT(*) FROM zangraf_products)::int AS products,
        (SELECT COUNT(*) FROM zangraf_products WHERE active)::int AS active_products,
        (SELECT COUNT(*) FROM "user")::int AS customers,
        (SELECT COUNT(*) FROM zangraf_orders)::int AS orders,
        (SELECT COUNT(*) FROM zangraf_orders WHERE status='paid')::int AS awaiting_approval,
        (SELECT COALESCE(SUM(amount_cents),0) FROM zangraf_receipts)::text AS received_cents`),
      db.query(`SELECT to_char(m.month,'YYYY-MM') AS month, COALESCE(SUM(r.amount_cents),0)::text AS amount_cents
        FROM generate_series(date_trunc('month',now())-interval '5 months',date_trunc('month',now()),interval '1 month') AS m(month)
        LEFT JOIN zangraf_receipts r ON r.paid_at>=m.month AND r.paid_at<m.month+interval '1 month'
        GROUP BY m.month ORDER BY m.month`),
      db.query('SELECT id,order_id,amount_cents,method,reference,paid_at FROM zangraf_receipts ORDER BY paid_at DESC LIMIT 50'),
    ]);
    return adminResponse({orders: orders.rows, customers: customers.rows, totals: totals.rows[0], revenue: revenue.rows, receipts: receipts.rows});
  } catch (error) { return adminError(error); }
}
