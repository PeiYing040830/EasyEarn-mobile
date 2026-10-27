export function prepareChatAttachment(source) {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(source || ''));
  if (!match || match[2].length > 4194304) throw new Error('Unsupported image attachment.');
  const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
  if (!bytes.length || bytes.length > 3 * 1024 * 1024) throw new Error('Image must be 3MB or smaller.');
  const type = match[1];
  return { name: 'EasyEarn-image.' + (type === 'image/jpeg' ? 'jpg' : type.split('/')[1]), type, base64: match[2], bytes };
}

export function downloadChatAttachment(source) {
  const { bytes, ...file } = prepareChatAttachment(source);
  if (window.EasyEarnFiles?.postMessage) {
    window.EasyEarnFiles.postMessage(JSON.stringify(file));
    return;
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: file.type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
