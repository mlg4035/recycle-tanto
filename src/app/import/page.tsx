import { BulkImport } from "@/components/BulkImport";
import { getGoogleDriveImportEnv } from "@/lib/env";

/** Must not be statically generated at image build time (env is only set on the VPS at runtime). */
export const dynamic = "force-dynamic";

export default function ImportPage() {
  const drive = getGoogleDriveImportEnv();
  return (
    <BulkImport
      googleClientId={drive.clientId}
      googleAppId={drive.appId}
      googleApiKey={drive.apiKey}
    />
  );
}
