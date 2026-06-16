const LICENSE_KEY_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const LICENSE_KEY_SEGMENTS = 4;
const LICENSE_KEY_SEGMENT_LENGTH = 5;

export function generateLicenseKey(): string {
  const bytes = new Uint8Array(
    LICENSE_KEY_SEGMENTS * LICENSE_KEY_SEGMENT_LENGTH,
  );
  crypto.getRandomValues(bytes);
  const segments: string[] = [];
  for (let s = 0; s < LICENSE_KEY_SEGMENTS; s++) {
    let segment = "";
    for (let i = 0; i < LICENSE_KEY_SEGMENT_LENGTH; i++) {
      segment +=
        LICENSE_KEY_CHARS[
          bytes[s * LICENSE_KEY_SEGMENT_LENGTH + i]! % LICENSE_KEY_CHARS.length
        ];
    }
    segments.push(segment);
  }
  return segments.join("-");
}
