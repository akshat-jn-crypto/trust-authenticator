import OpenAI from 'openai';

// "Auto-check" = does the typed claim match the document's contents?
// Uses OpenAI vision (gpt-4o-mini) to read the document and compare.
// This proves consistency, NOT authenticity (that's DigiLocker's job).

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

const MODEL = 'gpt-4o-mini';

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
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function checkDetailsAgainstDocument(
  fileBytes: ArrayBuffer,
  fileName: string,
  claimedDetails: Record<string, string>
): Promise<ContentCheckResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const mime = mimeFromName(fileName);
  const base64 = Buffer.from(fileBytes).toString('base64');
  const dataUrl = `data:${mime};base64,${base64}`;

  // PDFs go in as a file part; images as an image_url part.
  const documentPart =
    mime === 'application/pdf'
      ? { type: 'file' as const, file: { filename: fileName, file_data: dataUrl } }
      : { type: 'image_url' as const, image_url: { url: dataUrl } };

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
"overall" = "match" if every field matches, "mismatch" if none do, "partial" if some do, "unreadable" if the document can't be read.`;

  const completion = await openai.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content: [{ type: 'text', text: instruction }, documentPart] as any,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  let parsed: Partial<ContentCheckResult>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { overall: 'unreadable', fields: {}, note: 'Could not parse check result.' };
  }

  return {
    overall: parsed.overall ?? 'unreadable',
    fields: parsed.fields ?? {},
    note: parsed.note ?? '',
    model: MODEL,
    checked_at: new Date().toISOString(),
  };
}
