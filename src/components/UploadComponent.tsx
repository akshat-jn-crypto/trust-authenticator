'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CATEGORIES, type DocCategory } from '@/lib/types';

const MAX_SIZE_MB = 10;
const ACCEPTED = 'application/pdf,image/jpeg,image/png,image/webp';

// Uploads a file to the private 'documents' bucket under the
// user's own folder (required by the storage RLS policy), then
// records its metadata in the documents table.
export default function UploadComponent({
  category,
}: {
  category: DocCategory;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    setError(null);

    if (!docType.trim()) {
      setError('Type a document name first.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File is too large (max ${MAX_SIZE_MB} MB).`);
      return;
    }

    setUploading(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError('Your session expired — please sign in again.');
      setUploading(false);
      return;
    }

    // Path MUST start with the user's id: storage RLS checks
    // (storage.foldername(name))[1] = auth.uid().
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;

    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (storageError) {
      setError(`Upload failed: ${storageError.message}`);
      setUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from('documents').insert({
      owner_id: user.id,
      category,
      doc_type: docType.trim(),
      file_path: filePath,
      file_name: file.name,
    });

    if (dbError) {
      // Don't leave an orphaned file if the metadata insert failed.
      await supabase.storage.from('documents').remove([filePath]);
      setError(`Could not save document: ${dbError.message}`);
      setUploading(false);
      return;
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    router.refresh(); // re-render the server component with the new doc
  }

  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          disabled={uploading}
          list={`doctypes-${category}`}
          placeholder="Document name (e.g. Salary Slip)"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-600 focus:outline-none"
        />
        <datalist id={`doctypes-${category}`}>
          {CATEGORIES[category].docTypes.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED}
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
          className="hidden"
          id={`file-${category}`}
        />
        <label
          htmlFor={`file-${category}`}
          className={`cursor-pointer rounded-md px-4 py-2 text-center text-sm font-semibold text-white ${
            uploading
              ? 'cursor-wait bg-slate-400'
              : 'bg-brand-700 hover:bg-brand-600'
          }`}
        >
          {uploading ? 'Uploading…' : 'Upload document'}
        </label>

        <span className="text-xs text-slate-400">
          PDF, JPG, PNG · max {MAX_SIZE_MB} MB · auto-checked in ~1 minute
          (format only — not issuer-verified)
        </span>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
