import { t } from "@/i18n";

/** Reads a file as base64 without the data-URL prefix (Jellyfin's image upload format). */
export function toBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error ?? new Error(t("Could not read the file")));
    reader.readAsDataURL(file);
  });
}
