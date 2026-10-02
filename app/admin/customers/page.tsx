/**
 * /admin/customers — everyone who has placed at least one order (read-only).
 * Built from the orders collection on every request.
 */
import CustomersTable from '@/components/admin/CustomersTable';
import PageHeader from '@/components/admin/ui/PageHeader';
import { DANGER, DANGER_BG, DANGER_BORDER, SANS } from '@/components/admin/ui/admin-styles';
import { getCustomers } from '@/lib/customers';

export const dynamic = 'force-dynamic';

export default async function AdminCustomersPage() {
  let customers: Awaited<ReturnType<typeof getCustomers>> = [];
  let error: string | null = null;
  try {
    customers = await getCustomers();
  } catch (err) {
    console.error('[admin/customers] Failed to load customers:', err);
    error = 'Could not load customers. Check the Firebase Admin settings in your environment variables.';
  }

  return (
    <div style={{ fontFamily: SANS }}>
      <PageHeader
        title="Customers"
        subtitle={
          error
            ? undefined
            : `${customers.length} ${customers.length === 1 ? 'customer' : 'customers'} with at least one order`
        }
      />
      {error ? (
        <div
          role="alert"
          style={{
            background: DANGER_BG,
            color: DANGER,
            border: `1px solid ${DANGER_BORDER}`,
            borderRadius: '6px',
            padding: '12px 16px',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      ) : (
        <CustomersTable customers={customers} />
      )}
    </div>
  );
}
