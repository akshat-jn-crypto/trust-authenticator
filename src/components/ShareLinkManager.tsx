'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  CATEGORIES,
  type DocumentRow,
  type ShareLink,
  type ShareLinkConfig,
} from '@/lib/types';

const EMPTY_CONFIG: ShareLinkConfig = { documents: {} };

// Owner-side manager for scoped share links. Each link decides which
// documents/fields are visible and whether each file may be viewed.
export default function ShareLinkManager({
  documents,
}: {
  documents: DocumentRow[];
}) {
  const supabase = createClient();
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Only documents that have something to share.
  const shareable = documents;

  async function load() {
    const { data } = await supabase
      .from('share_links')
      .select('*')
      .order('created_at', { ascending: false })
      .returns<ShareLink[]>();
    setLinks(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createLink() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const slug = crypto.randomUUID().replace(/-/g, '');
    const { data } = await supabase
      .from('share_links')
      .insert({
        owner_id: auth.user.id,
        slug,
        name: 'Untitled link',
        config: EMPTY_CONFIG,
      })
      .select('*')
      .single<ShareLink>();
    await load();
    if (data) setEditingId(data.id);
  }

  async function patch(link: ShareLink, changes: Partial<ShareLink>) {
    setLinks((ls) => ls.map((l) => (l.id === link.id ? { ...l, ...changes } : l)));
    await supabase.from('share_links').update(changes).eq('id', link.id);
  }

  async function remove(id: string) {
    if (!confirm('Delete this share link? Anyone holding it will lose access.')) return;
    await supabase.from('share_links').delete().eq('id', id);
    await load();
  }

  function copy(slug: string, id: string) {
    navigator.clipboard.writeText(`${window.location.origin}/s/${slug}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // --- config helpers (operate on a link's config immutably) ---
  function docCfg(link: ShareLink, docId: string) {
    return link.config?.documents?.[docId];
  }

  function toggleDoc(link: ShareLink, doc: DocumentRow) {
    const docs = { ...(link.config?.documents ?? {}) };
    if (docs[doc.id]) {
      delete docs[doc.id];
    } else {
      // Include with all current fields visible by default.
      docs[doc.id] = {
        show_document: false,
        fields: Object.keys(doc.details ?? {}),
      };
    }
    patch(link, { config: { documents: docs } });
  }

  function toggleField(link: ShareLink, doc: DocumentRow, field: string) {
    const docs = { ...(link.config?.documents ?? {}) };
    const cfg = docs[doc.id];
    if (!cfg) return;
    const fields = cfg.fields.includes(field)
      ? cfg.fields.filter((f) => f !== field)
      : [...cfg.fields, field];
    docs[doc.id] = { ...cfg, fields };
    patch(link, { config: { documents: docs } });
  }

  function toggleShowDocument(link: ShareLink, doc: DocumentRow) {
    const docs = { ...(link.config?.documents ?? {}) };
    const cfg = docs[doc.id];
    if (!cfg) return;
    docs[doc.id] = { ...cfg, show_document: !cfg.show_document };
    patch(link, { config: { documents: docs } });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">Share links</h2>
          <p className="text-sm text-slate-500">
            Create separate links for different people — each shows only what you choose.
          </p>
        </div>
        <button
          onClick={createLink}
          className="shrink-0 rounded-md bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-600"
        >
          New link
        </button>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-400">Loading…</p>
      ) : links.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">
          No share links yet. Create one to share a curated view.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {links.map((link) => {
            const isEditing = editingId === link.id;
            const includedCount = Object.keys(link.config?.documents ?? {}).length;
            return (
              <li key={link.id} className="rounded-lg border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <input
                      value={link.name}
                      onChange={(e) =>
                        setLinks((ls) =>
                          ls.map((l) =>
                            l.id === link.id ? { ...l, name: e.target.value } : l
                          )
                        )
                      }
                      onBlur={(e) => patch(link, { name: e.target.value.trim() || 'Untitled link' })}
                      className="w-full max-w-xs rounded border border-transparent px-1 py-0.5 text-sm font-medium text-slate-900 hover:border-slate-200 focus:border-brand-600 focus:outline-none"
                    />
                    <p className="truncate px-1 text-xs text-slate-400">
                      /s/{link.slug.slice(0, 12)}… · {includedCount} document
                      {includedCount !== 1 && 's'} shared
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-sm font-medium">
                    <button onClick={() => copy(link.slug, link.id)} className="text-brand-700 hover:underline">
                      {copiedId === link.id ? '✓ Copied' : 'Copy link'}
                    </button>
                    <button
                      onClick={() => setEditingId(isEditing ? null : link.id)}
                      className="text-slate-600 hover:underline"
                    >
                      {isEditing ? 'Done' : 'Configure'}
                    </button>
                    <button onClick={() => remove(link.id)} className="text-red-600 hover:underline">
                      Delete
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <div className="space-y-3 border-t border-slate-100 p-3">
                    {shareable.length === 0 && (
                      <p className="text-sm text-slate-400">
                        Upload documents (and add details) first — then choose what to share here.
                      </p>
                    )}
                    {shareable.map((doc) => {
                      const cfg = docCfg(link, doc.id);
                      const fields = Object.keys(doc.details ?? {});
                      return (
                        <div key={doc.id} className="rounded-md border border-slate-200 p-3">
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                            <input
                              type="checkbox"
                              checked={!!cfg}
                              onChange={() => toggleDoc(link, doc)}
                            />
                            {doc.doc_type}
                            <span className="text-xs font-normal text-slate-400">
                              ({CATEGORIES[doc.category].label})
                            </span>
                          </label>

                          {cfg && (
                            <div className="mt-2 space-y-2 pl-6">
                              {fields.length > 0 ? (
                                <div className="flex flex-wrap gap-x-4 gap-y-1">
                                  {fields.map((field) => (
                                    <label
                                      key={field}
                                      className="flex items-center gap-1.5 text-xs text-slate-600"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={cfg.fields.includes(field)}
                                        onChange={() => toggleField(link, doc, field)}
                                      />
                                      {field}: <span className="font-medium">{doc.details?.[field]}</span>
                                    </label>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400">No details added to this document.</p>
                              )}
                              <label className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                                <input
                                  type="checkbox"
                                  checked={cfg.show_document}
                                  onChange={() => toggleShowDocument(link, doc)}
                                />
                                Let viewers open the actual document file
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
