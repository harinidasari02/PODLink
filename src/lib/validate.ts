import { z } from 'zod';

export const LoginSchema = z.object({
  mode: z.enum(['driver', 'billing']),
  login: z.string().trim().min(2).max(80),
  secret: z.string().min(4).max(100),
});

export const UploadFieldsSchema = z.object({
  tripId: z.string().regex(/^TRP-\d{4,8}$/),
  capturedAt: z.string().min(10).max(40),
  lat: z.coerce.number().min(-90).max(90).optional().nullable(),
  lng: z.coerce.number().min(-180).max(180).optional().nullable(),
  accuracy: z.coerce.number().min(0).max(100000).optional().nullable(),
  offline: z.enum(['1', '0']).optional(),
  clientRef: z.string().regex(/^[A-Za-z0-9-]{8,64}$/).optional(),
  token: z.string().regex(/^[a-f0-9]{32,64}$/).optional(),
});

export const ReviewSchema = z.object({
  action: z.enum(['approve', 'retake']),
  corrections: z.object({
    quantity: z.number().int().min(0).max(1_000_000).optional(),
    remarks: z.string().trim().max(300).optional(),
    note: z.string().trim().max(300).optional(),
  }).optional(),
});

export const InvoiceSchema = z.object({
  clientId: z.number().int().positive(),
  tripIds: z.array(z.string().regex(/^TRP-\d{4,8}$/)).min(1).max(200),
});

export const SmsLinkSchema = z.object({ tripId: z.string().regex(/^TRP-\d{4,8}$/) });

export const TripImportRowSchema = z.object({
  trip_id: z.string().regex(/^TRP-\d{4,8}$/),
  lr_no: z.string().trim().min(3).max(30),
  eway_bill_no: z.string().regex(/^\d{12}$/, 'e-way bill must be 12 digits'),
  client: z.string().trim().min(1).max(80),
  vehicle_no: z.string().trim().min(5).max(20),
  hired: z.enum(['yes', 'no']).default('no'),
  origin: z.string().trim().min(2).max(60),
  destination: z.string().trim().min(2).max(60),
  branch: z.string().trim().min(2).max(60),
  freight: z.coerce.number().int().min(1).max(5_000_000),
  qty: z.coerce.number().int().min(1).max(1_000_000),
  consignee_name: z.string().trim().min(2).max(100),
  consignee_phone: z.string().trim().max(20).optional().default(''),
  dispatch_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  delivered_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
});
