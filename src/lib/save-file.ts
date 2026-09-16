export function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 4000);
}

type PickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<FileSystemFileHandle>;
};

export async function requestSaveHandle(
  filename: string,
  mime: string,
  ext: string,
): Promise<FileSystemFileHandle | null> {
  const picker = (window as PickerWindow).showSaveFilePicker;
  if (typeof picker !== "function") return null;
  try {
    return await picker({
      suggestedName: filename,
      types: [{ description: filename, accept: { [mime]: [ext] } }],
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    return null;
  }
}

export async function writeSave(
  handle: FileSystemFileHandle | null,
  blob: Blob,
  filename: string,
): Promise<void> {
  if (handle) {
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }
  triggerDownload(blob, filename);
}
