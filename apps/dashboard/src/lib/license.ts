export function formatLicenseKey(key: string): string {
  if (!key) return '';
  return key.toUpperCase().match(/.{1,4}/g)?.join('-') || key;
}
