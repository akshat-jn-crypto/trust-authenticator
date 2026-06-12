export type DocCategory = 'professional' | 'identity' | 'education' | 'property';
export type DocStatus = 'pending' | 'verified' | 'rejected';

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
