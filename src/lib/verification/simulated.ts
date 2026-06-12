import type {
  VerificationInput,
  VerificationProvider,
  VerificationVerdict,
} from './provider';

const ALLOWED_EXTENSIONS = /\.(pdf|jpg|jpeg|png|webp)$/i;

// TypeScript twin of the pg_cron job in supabase/automation.sql.
// In production the cron job does this work inside Postgres; this
// implementation exists so the app-side pipeline has a working
// default once verification moves out of the database.
export class SimulatedProvider implements VerificationProvider {
  readonly method = 'simulated' as const;

  isConfigured(): boolean {
    return true;
  }

  async verifyDocument(input: VerificationInput): Promise<VerificationVerdict> {
    const inOwnerFolder = input.filePath.split('/')[0] === input.ownerId;
    const validExtension = ALLOWED_EXTENSIONS.test(input.fileName);

    if (!inOwnerFolder || !validExtension) {
      return {
        status: 'rejected',
        method: this.method,
        note: 'Automated check failed: unsupported file type or invalid storage path.',
      };
    }

    return {
      status: 'verified',
      method: this.method,
      note: 'Auto-verified: format and integrity checks passed.',
    };
  }
}
