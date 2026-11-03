export type Role = 'driver' | 'billing';
export type PodStatus = 'none' | 'retake_requested' | 'needs_review' | 'verified' | 'billed';
export type Lang = 'hi' | 'mr' | 'en';
export type BillingCycle = 'weekly' | 'fortnightly' | 'monthly';

export interface Extraction {
  lr_number: string | null;
  consignee_stamp: boolean;
  quantity: number | null;
  remarks: string | null;
  shortage_or_damage: boolean;
  delivery_date: string | null; // ISO yyyy-mm-dd
  signature: boolean;
  image_quality: 'ok' | 'blurry' | 'dark' | 'cropped';
  confidence: number; // 0..1, overall
}

export interface TripFacts {
  lr_no: string;
  qty: number;
}

export type Decision = 'verified' | 'retake' | 'needs_review';

export interface DecisionResult {
  decision: Decision;
  reasons: string[]; // stable codes, see REASON_TEXT
}
