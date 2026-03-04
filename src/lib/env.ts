const requiredInRealMode = [
  "HANDWRITINGOCR_API_KEY",
  "HANDWRITINGOCR_WEBHOOK_SECRET",
  "HANDWRITINGOCR_BASE_URL",
  "APP_PUBLIC_BASE_URL",
] as const;

export function isMockOcrEnabled() {
  return process.env.MOCK_OCR === "1";
}

export function getEnv() {
  const action = (process.env.HANDWRITINGOCR_ACTION ?? "transcribe").trim();
  const env = {
    HANDWRITINGOCR_API_KEY: process.env.HANDWRITINGOCR_API_KEY ?? "",
    HANDWRITINGOCR_WEBHOOK_SECRET:
      process.env.HANDWRITINGOCR_WEBHOOK_SECRET ?? "",
    HANDWRITINGOCR_BASE_URL: process.env.HANDWRITINGOCR_BASE_URL ?? "",
    APP_PUBLIC_BASE_URL: process.env.APP_PUBLIC_BASE_URL ?? "",
    HANDWRITINGOCR_ACTION: action || "transcribe",
    MOCK_OCR: isMockOcrEnabled(),
    NODE_ENV: process.env.NODE_ENV ?? "development",
  };

  if (!env.MOCK_OCR) {
    for (const key of requiredInRealMode) {
      if (!env[key]) {
        throw new Error(`${key} is required when MOCK_OCR is disabled`);
      }
    }
  }

  return env;
}

export function isProd() {
  return process.env.NODE_ENV === "production";
}
