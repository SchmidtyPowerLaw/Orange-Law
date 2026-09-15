import { useState } from "react";

const ZIP_PATH = "/orange-law-source.zip";

export function SourceZipButton() {
  const [note, setNote] = useState<string | null>(null);

  const save = async () => {
    const url = new URL(ZIP_PATH, window.location.href).href;
    setNote("Preparing zip…");
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch");
      const blob = await res.blob();
      const file = new File([blob], "orange-law-source.zip", { type: "application/zip" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Orange Law source" });
        setNote(null);
        return;
      }
      const obj = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = obj;
      a.download = "orange-law-source.zip";
      a.rel = "noopener";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(obj), 60_000);
      try {
        await navigator.clipboard.writeText(url);
        setNote(
          "If no file appeared, this chat preview blocked the download. The zip URL is copied — paste it into a new browser tab (not this chat).",
        );
      } catch {
        setNote(
          "If no file appeared, copy this URL into a new browser tab: " + url,
        );
      }
    } catch {
      window.location.assign(ZIP_PATH);
      setNote("Opening the zip in this window. If it still fails, open the published site in a normal tab and add /orange-law-source.zip to the address.");
    }
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => void save()}
        className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Save source zip
      </button>
      {note ? (
        <p className="mt-3 max-w-prose text-xs leading-relaxed text-amber-200">{note}</p>
      ) : (
        <p className="mt-2 max-w-prose text-xs text-muted-foreground">
          Chat previews often block file downloads. If the button does nothing,
          publish the app, open that live URL in Safari or Chrome, then visit
          <span className="font-mono"> /orange-law-source.zip</span>.
        </p>
      )}
    </div>
  );
}
