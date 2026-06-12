import type { DocCategory } from '@/lib/types';

export type VerificationMethod = 'simulated' | 'digilocker' | 'kyc_api';

export interface VerificationInput {
  docId: string;
  ownerId: string;
  category: DocCategory;
  docType: string;
  filePath: string;
  fileName: string;
}

export interface VerificationVerdict {
  status: 'verified' | 'rejected' | 'pending';
  method: VerificationMethod;
  note: string;
  /** Issuer transaction id / DigiLocker document URI, when available. */
  providerRef?: string;
}

export interface VerificationProvider {
  readonly method: VerificationMethod;
  /** True when all required credentials/env vars are present. */
  isConfigured(): boolean;
  verifyDocument(input: VerificationInput): Promise<VerificationVerdict>;
}

// Selected via the VERIFICATION_PROVIDER env var. Defaults to the
// simulation; switching to 'digilocker' is a config change, not a
// code change (see docs/VERIFICATION-ROADMAP.md).
export async function getActiveProvider(): Promise<VerificationProvider> {
  switch (process.env.VERIFICATION_PROVIDER) {
    case 'digilocker': {
      const { DigiLockerProvider } = await import('./digilocker');
      return new DigiLockerProvider();
    }
    default: {
      const { SimulatedProvider } = await import('./simulated');
      return new SimulatedProvider();
    }
  }
}
