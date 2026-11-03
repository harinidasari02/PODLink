import { ImportClient } from './ImportClient';
export const metadata = { title: 'Import trips' };
export default function ImportPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Daily trip import</h1>
      <p className="mt-1 text-sm text-ink-soft">Upload the day&apos;s trip file. Every trip needs its LR number and 12-digit e-way bill number. Re-uploading the same file is safe.</p>
      <ImportClient />
    </div>
  );
}
