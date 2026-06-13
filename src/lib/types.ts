export type DocCategory = 'professional' | 'identity' | 'education' | 'property';
export type DocStatus = 'pending' | 'verified' | 'rejected';
export type VerificationMethod = 'simulated' | 'digilocker' | 'kyc_api';

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  bio: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
  // Set after supabase/digilocker.sql + DigiLocker linking.
  digilocker_verified?: boolean;
  digilocker_name?: string | null;
}

export interface DocumentRow {
  id: string;
  owner_id: string;
  category: DocCategory;
  doc_type: string;
  file_path: string;
  file_name: string;
  status: DocStatus;
  reviewer_note: string | null;
  created_at: string;
  // Present after supabase/digilocker.sql; defaults to 'simulated'.
  verification_method?: VerificationMethod;
  // Owner-entered shareable claims; present after supabase/claims.sql.
  details?: Record<string, string>;
  // AI auto-check result; present after supabase/content-check.sql.
  details_check?: DetailsCheck | null;
}

// Shareable, non-sensitive claim fields suggested per document type.
// Deliberately excludes sensitive identifiers (Aadhaar/PAN numbers).
export const CLAIM_FIELDS: Record<string, string[]> = {
  '10th Marksheet': ['Board', 'Year', 'Percentage'],
  '12th Marksheet': ['Board', 'Year', 'Percentage'],
  'College Degree': ['Institution', 'Qualification', 'Year'],
  'Joining Letter': ['Employer', 'Designation', 'Joining Date'],
  'Salary Slip': ['Employer', 'Designation', 'Month'],
  ITR: ['Assessment Year'],
  'Birth Certificate': ['Name', 'Year'],
  'Aadhaar Card': ['Name'],
  'PAN Card': ['Name'],
  Passport: ['Name', 'Expiry Year'],
  'Driving Licence': ['Name', 'Valid Till'],
  'Rent Agreement': ['City', 'Valid Till'],
  'Property Deed': ['City', 'Type'],
};

export function claimFieldsFor(docType: string): string[] {
  return CLAIM_FIELDS[docType] ?? ['Detail'];
}

// Unique, sorted set of every suggested field name across all
// document types — offered as autocomplete so the same fact is named
// consistently from one document to the next.
export const SUGGESTED_FIELDS: string[] = Array.from(
  new Set(Object.values(CLAIM_FIELDS).flat())
).sort();

// A light value hint based on the field name, so similar fields get
// the same kind of input.
export function valueHintFor(field: string): { placeholder: string; numeric: boolean } {
  const k = field.toLowerCase();
  if (k.includes('year')) return { placeholder: 'e.g. 2024', numeric: true };
  if (k.includes('percent') || k.includes('marks') || k.includes('cgpa') || k.includes('score'))
    return { placeholder: 'e.g. 88%', numeric: false };
  if (k.includes('date') || k.includes('till') || k.includes('valid') || k.includes('month'))
    return { placeholder: 'e.g. Aug 2024', numeric: false };
  return { placeholder: 'Value', numeric: false };
}

export interface DetailsCheck {
  overall: 'match' | 'mismatch' | 'partial' | 'unreadable';
  fields: Record<string, { matches: boolean; found: string | null }>;
  note: string;
  model: string;
  checked_at: string;
}

export interface ShareLinkDocConfig {
  show_document: boolean;
  fields: string[];
}

export interface ShareLinkConfig {
  documents: Record<string, ShareLinkDocConfig>;
}

export interface ShareLink {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  config: ShareLinkConfig;
  created_at: string;
}

export interface PublicClaim {
  category: DocCategory;
  doc_type: string;
  details: Record<string, string>;
  verification_method: VerificationMethod;
  issuer: string | null;
  details_check: DetailsCheck | null;
}

export interface TrustStatusRow {
  category: DocCategory;
  total: number;
  verified: number;
  // Verified docs that arrived issuer-signed via DigiLocker.
  // Absent until supabase/digilocker.sql has been run.
  issuer_verified?: number;
}

// Single source of truth for the four vault sections.
// `digilocker` lists what can arrive issuer-signed once the
// DigiLocker integration is live (docs/VERIFICATION-ROADMAP.md);
// its presence renders the "Fetch from DigiLocker" panel.
export const CATEGORIES: Record<
  DocCategory,
  { label: string; description: string; docTypes: string[]; digilocker?: string }
> = {
  professional: {
    label: 'Professional',
    description: 'Joining letters, salary slips, ITR',
    docTypes: ['Joining Letter', 'Salary Slip', 'ITR'],
    digilocker: 'ITR acknowledgements',
  },
  identity: {
    label: 'Identity',
    description: 'Birth certificate, government IDs',
    docTypes: ['Birth Certificate', 'Aadhaar Card', 'PAN Card', 'Passport'],
    digilocker: 'Aadhaar, PAN, driving licence',
  },
  education: {
    label: 'Education',
    description: '10th/12th marksheets, college degrees',
    docTypes: ['10th Marksheet', '12th Marksheet', 'College Degree'],
    digilocker: 'CBSE/state-board marksheets, many university degrees',
  },
  property: {
    label: 'Property',
    description: 'Rent agreements, property deeds',
    docTypes: ['Rent Agreement', 'Property Deed'],
  },
};

export const CATEGORY_ORDER: DocCategory[] = [
  'professional',
  'identity',
  'education',
  'property',
];
