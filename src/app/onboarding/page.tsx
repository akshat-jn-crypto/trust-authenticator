'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Profile setup: username, name, bio, profile picture.
// Existing users are bounced straight to the dashboard.
export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id')
      .maybeSingle()
      .then(({ data }) => {
        if (data) router.replace('/dashboard');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/login');
      return;
    }

    let avatar_url: string | null = null;
    if (avatarFile) {
      const path = `${user.id}/avatar-${Date.now()}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true });
      if (uploadError) {
        setError(`Avatar upload failed: ${uploadError.message}`);
        setSaving(false);
        return;
      }
      avatar_url = supabase.storage.from('avatars').getPublicUrl(path).data
        .publicUrl;
    }

    const { error: insertError } = await supabase.from('profiles').insert({
      id: user.id,
      username: username.toLowerCase().trim(),
      full_name: fullName.trim(),
      bio: bio.trim() || null,
      avatar_url,
    });

    setSaving(false);
    if (insertError) {
      setError(
        insertError.code === '23505'
          ? 'That username is taken — try another.'
          : insertError.message
      );
      return;
    }
    router.replace('/dashboard');
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold text-slate-900">Set up your profile</h1>
      <p className="mt-1 text-sm text-slate-500">
        Your username becomes your public Trust Link: /u/username
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Username</label>
          <input
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            pattern="[a-z0-9_]{3,30}"
            title="3–30 characters: lowercase letters, numbers, underscores"
            placeholder="ananya_sharma"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Full name</label>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ananya Sharma"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="Software engineer in Delhi. Verified and ready to rent."
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">
            Profile picture (optional)
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Create my Trust Link'}
        </button>
      </form>
    </div>
  );
}
