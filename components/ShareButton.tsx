"use client";

import { useState } from "react";

export default function ShareButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function shareResult() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Masquerade",
          text,
        });
      } catch {
        // Closing the native share sheet is not an error the player needs to see.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Very old browsers may not expose either API.
    }
  }

  return (
    <div className="share-actions">
      <button className="btn share-main" onClick={shareResult}>
        {copied ? "COPIED!" : "SHARE YOUR RESULT"}
      </button>
    </div>
  );
}
