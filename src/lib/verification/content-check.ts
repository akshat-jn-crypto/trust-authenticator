// "Auto-check" = does the typed claim match the document's contents?
// Uses Google Gemini (free tier) vision to read the document and
// compare. This proves consistency, NOT authenticity (that's
// DigiLocker's job). Called via the REST API — no SDK dependency.

export interface FieldResult {
  matches: boolean;
  found: string | null;
}

export interface ContentCheckResult {
  overall: 'match' | 'mismatch' | 'partial' | 'unreadable';
  fields: Record<string, FieldResult>;
  note: string;
  model: string;
  checked_at: string;
}

// Env var is intentionally spelled GEMENI_API_KEY to match the
// Vercel configuration. Model is overridable.
const API_KEY_ENV = 'GEMENI_API_KEY';
// gemini-2.0-flash was retired 2026-03-03; 2.5 Flash is the current
// free-tier multimodal model. Overridable via GEMINI_MODEL.
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

function mimeFromName(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

export function isContentCheckConfigured(): boolean {
  return Boolean(process.env[API_KEY_ENV]);
}

export async function checkDetailsAgainstDocument(
  fileBytes: ArrayBuffer,
  fileName: string,
  claimedDetails: Record<string, string>
): Promise<ContentCheckResult> {
  const key = process.env[API_KEY_ENV];
  if (!key) throw new Error('GEMENI_API_KEY is not configured');

  const mime = mimeFromName(fileName);
  const base64 = Buffer.from(fileBytes).toString('base64');

  const instruction = `You are verifying whether a person's claimed details match an official document.

Claimed details (JSON):
${JSON.stringify(claimedDetails, null, 2)}

Examine the attached document. For EACH claimed field decide whether the document supports that value. Allow reasonable differences: abbreviations ("IIT Delhi" = "Indian Institute of Technology Delhi"), formatting, date styles, extra honorifics, minor spelling. A field "matches" only if the document genuinely contains/supports that value.

Respond with ONLY a JSON object of this exact shape:
{
  "overall": "match" | "mismatch" | "partial" | "unreadable",
  "fields": { "<each claimed field name>": { "matches": true|false, "found": "<value seen in the document, or null>" } },
  "note": "<one short sentence summary>"
}
"overall" = "match" if every field matches, "mismatch" if none do, "partial" if some do, "unreadable" if the document cannot be read.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: instruction },
            { inline_data: { mime_type: mime, data: base64 } },
          ],
        },
      ],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

  let parsed: Partial<ContentCheckResult>;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {
      overall: 'unreadable',
      fields: {},
      note: 'Could not parse check result.',
    };
  }

  return {
    overall: parsed.overall ?? 'unreadable',
    fields: parsed.fields ?? {},
    note: parsed.note ?? '',
    model: MODEL,
    checked_at: new Date().toISOString(),
  };
}
