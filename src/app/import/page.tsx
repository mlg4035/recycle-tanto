import { BulkImport } from "@/components/BulkImport";

export default function ImportPage() {
  return (
    <BulkImport
      googleClientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()}
      googleAppId={process.env.NEXT_PUBLIC_GOOGLE_APP_ID?.trim()}
      googleApiKey={process.env.NEXT_PUBLIC_GOOGLE_API_KEY?.trim()}
    />
  );
}
