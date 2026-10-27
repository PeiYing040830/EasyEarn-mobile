const TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
const LIMIT = 3 * 1024 * 1024;

export function evidenceBytes(evidence) {
  if (!evidence || !TYPES.has(evidence.type) || typeof evidence.name !== 'string' || !evidence.name || evidence.name.length > 255 || typeof evidence.base64 !== 'string' || !evidence.base64.length || evidence.base64.length > 4194304 || !/^[A-Za-z0-9+/]+={0,2}$/.test(evidence.base64)) throw new Error('Invalid evidence attachment.');
  const bytes = Uint8Array.from(atob(evidence.base64), char => char.charCodeAt(0));
  if (!bytes.length || bytes.length > LIMIT) throw new Error('Evidence must be 3MB or smaller.');
  return bytes;
}

export async function readReportEvidence(file) {
  if (!file) return null;
  if (!TYPES.has(file.type)) throw new Error('Evidence must be a PDF, PNG, JPG, or WebP file.');
  if (!file.size || file.size > LIMIT) throw new Error('Evidence must be non-empty and 3MB or smaller.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
  return { name: file.name.slice(0, 255), type: file.type, base64: btoa(binary) };
}

export function downloadReportEvidence(evidence) {
  const bytes = evidenceBytes(evidence);
  if (window.EasyEarnFiles?.postMessage) {
    window.EasyEarnFiles.postMessage(JSON.stringify(evidence));
    return;
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: evidence.type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = evidence.name.replace(/[\\/]/g, '_');
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
