import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { db } from '@/lib/db';
import { driverTrips } from '@/lib/queries';
import { CaptureFlow } from '@/components/CaptureFlow';
import type { Lang } from '@/lib/types';

export const metadata = { title: 'Photograph POD' };
export const dynamic = 'force-dynamic';

export default async function TripCapture({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = (await requireUser('driver'))!;
  void db();
  const trip = driverTrips(u.id).find((t) => t.id === id); // only this driver's own trips
  if (!trip) notFound();
  if (trip.pod_status === 'verified') {
    return <CaptureFlowDone />;
  }
  return <CaptureFlow trip={{ id: trip.id, lr_no: trip.lr_no, destination: trip.destination, client: trip.client, qty: trip.qty, unit: trip.unit, retakes_left: trip.retakes_left, retake_reasons: trip.retake_reasons }} defaultLang={u.lang as Lang} backHref="/driver" />;
}

function CaptureFlowDone() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-5 text-center">
      <div><p className="text-2xl font-semibold">POD received ✓</p><a href="/driver" className="btn-quiet mt-6">Back</a></div>
    </main>
  );
}
