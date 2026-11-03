import { billingQueue, recentInvoices } from '@/lib/queries';
import { QueueClient } from './QueueClient';

export const metadata = { title: 'Billing' };

export default function BillingQueuePage() {
  return <QueueClient groups={billingQueue()} invoices={recentInvoices()} />;
}
