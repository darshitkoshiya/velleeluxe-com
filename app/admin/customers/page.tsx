/**
 * /admin/customers — everyone who has placed at least one order (read-only).
 * Built from the orders collection on every request.
 */
import CustomersTable from '@/components/admin/CustomersTable';
import { getCustomers } from '@/lib/customers';

export const dynamic = 'force-dynamic';

export default async function AdminCustomersPage() {
  const customers = await getCustomers();

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 4px' }}>Customers</h1>
      <p style={{ fontSize: '14px', color: '#6F6A62', margin: '0 0 24px' }}>
        {customers.length} {customers.length === 1 ? 'customer' : 'customers'} with at least one order
      </p>
      <CustomersTable customers={customers} />
    </div>
  );
}
