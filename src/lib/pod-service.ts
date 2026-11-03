import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { db, UPLOAD_DIR, audit } from './db';
import { extractPod, type AiTrip } from './ai';
import { aiUnavailableResult, decidePod, MAX_RETAKES, REASON_TEXT } from './pod-rules';
import { assessQuality, SERVER_MAX_BYTES, sniffImageType, type QualityReport } from './image-checks';
import { unitFor } from './seed-data';
import type { Decision, Extraction } from './types';

export interface UploadInput {
  tripId: string;
  image: Buffer;
  capturedAt: string;
  lat: number | null; lng: number | null; accuracy: number | null;
  offline: boolean;
  clientRef: string | null;
  source: 'app' | 'sms_link';
}

export interface UploadResult {
  ok: true;
  decision: Decision;
  reasons: string[];
  reasonText: string[];
  retakesLeft: number;
  aiMode: 'vision' | 'mock' | 'none';
  submissionId: number;
  duplicate?: boolean;
}
export class UploadError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

interface TripRow {
  id: string; lr_no: string; qty: number; client_id: number; delivered_on: string | null; pod_status: string;
  retake_count: number; demo_scenario: string; consignee_name: string;
}

export async function processPodUpload(inp: UploadInput): Promise<UploadResult> {
  const d = db();

  // Idempotent: a device that retries after a dropped connection gets the original answer.
  if (inp.clientRef) {
    const prev = d.prepare('SELECT s.id, s.decision, s.reasons_json, s.ai_mode, t.retake_count FROM pod_submissions s JOIN trips t ON t.id = s.trip_id WHERE s.client_ref = ?').get(inp.clientRef) as
      { id: number; decision: Decision; reasons_json: string; ai_mode: 'vision' | 'mock' | 'none'; retake_count: number } | undefined;
    if (prev) {
      const reasons = JSON.parse(prev.reasons_json) as string[];
      return { ok: true, decision: prev.decision, reasons, reasonText: reasons.map((r) => REASON_TEXT[r] ?? r), retakesLeft: Math.max(0, MAX_RETAKES - prev.retake_count), aiMode: prev.ai_mode, submissionId: prev.id, duplicate: true };
    }
  }

  const trip = d.prepare('SELECT id, lr_no, qty, client_id, delivered_on, pod_status, retake_count, demo_scenario, consignee_name FROM trips WHERE id = ?').get(inp.tripId) as TripRow | undefined;
  if (!trip) throw new UploadError(404, 'Trip not found');
  if (trip.pod_status === 'verified' || trip.pod_status === 'billed') throw new UploadError(409, 'This trip already has an accepted POD');

  if (inp.image.length > SERVER_MAX_BYTES) throw new UploadError(413, 'Image is larger than 300 KB. Please retake.');
  const type = sniffImageType(inp.image);
  if (!type) throw new UploadError(415, 'File is not a valid image');

  const captured = Date.parse(inp.capturedAt);
  if (Number.isNaN(captured) || captured > Date.now() + 10 * 60_000) throw new UploadError(400, 'Invalid capture time');

  let quality: QualityReport;
  try { quality = await assessQuality(inp.image); } catch { throw new UploadError(415, 'Could not read image'); }

  const aiTrip: AiTrip = {
    lr_no: trip.lr_no, qty: trip.qty, delivered_on: trip.delivered_on,
    demo_scenario: trip.demo_scenario, consignee_name: trip.consignee_name, unit: unitFor(trip.client_id),
  };

  let extraction: Extraction | null = null;
  let aiMode: 'vision' | 'mock' | 'none' = 'none';
  let result;
  try {
    const r = await extractPod(inp.image, aiTrip, quality);
    extraction = r.extraction; aiMode = r.mode;
    result = decidePod(extraction, { lr_no: trip.lr_no, qty: trip.qty }, trip.retake_count);
  } catch (e) {
    // The AI failed (timeout, bad JSON, no network). Never block the driver, never auto-approve.
    console.error('AI check failed:', e instanceof Error ? e.message : e);
    result = aiUnavailableResult();
    if (quality.quality !== 'ok') result = decidePod({ lr_number: null, consignee_stamp: false, quantity: null, remarks: null, shortage_or_damage: false, delivery_date: null, signature: false, image_quality: quality.quality, confidence: 0 }, { lr_no: trip.lr_no, qty: trip.qty }, trip.retake_count);
  }

  const fileName = `${trip.id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.jpg`;
  fs.writeFileSync(path.join(UPLOAD_DIR, fileName), inp.image);

  const now = new Date().toISOString();
  const tx = d.transaction(() => {
    const r = d.prepare(`INSERT INTO pod_submissions
      (trip_id,image_file,size_bytes,captured_at,received_at,lat,lng,accuracy_m,captured_offline,source,ai_mode,extraction_json,decision,reasons_json,client_ref)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      trip.id, fileName, inp.image.length, inp.capturedAt, now, inp.lat, inp.lng, inp.accuracy, inp.offline ? 1 : 0, inp.source,
      aiMode, extraction ? JSON.stringify(extraction) : null, result.decision, JSON.stringify(result.reasons), inp.clientRef);

    const status = result.decision === 'verified' ? 'verified' : result.decision === 'retake' ? 'retake_requested' : 'needs_review';
    const remark = result.reasons.map((x) => REASON_TEXT[x] ?? x).join('; ') || null;
    d.prepare(`UPDATE trips SET pod_status = ?, retake_count = retake_count + ?, remarks = ?,
        pod_received_at = COALESCE(pod_received_at, ?), delivered_on = COALESCE(delivered_on, ?) WHERE id = ?`)
      .run(status, result.decision === 'retake' ? 1 : 0, remark, now, inp.capturedAt.slice(0, 10), trip.id);
    return Number(r.lastInsertRowid);
  });
  const submissionId = tx();
  audit(inp.source === 'sms_link' ? 'sms-link' : 'driver-app', `pod_${result.decision}`, trip.id, { reasons: result.reasons, aiMode, offline: inp.offline });

  const used = trip.retake_count + (result.decision === 'retake' ? 1 : 0);
  return {
    ok: true, decision: result.decision, reasons: result.reasons,
    reasonText: result.reasons.map((r) => REASON_TEXT[r] ?? r),
    retakesLeft: Math.max(0, MAX_RETAKES - used), aiMode, submissionId,
  };
}
