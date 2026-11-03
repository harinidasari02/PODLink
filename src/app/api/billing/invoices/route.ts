import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { InvoiceSchema } from '@/lib/validate';
import { BillingError, createInvoice } from '@/lib/billing';
import { audit } from '@/lib/db';

export async function POST(req: Request) {
  const user = await requireUser('billing');
  if (!user) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const body = InvoiceSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  try {
    const inv = createInvoice(body.data.clientId, body.data.tripIds, user.id);
    audit(user.login, 'invoice_created', null, inv);
    return NextResponse.json({ ok: true, invoice: inv });
  } catch (e) {
    if (e instanceof BillingError) return NextResponse.json({ error: e.message }, { status: 409 });
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
