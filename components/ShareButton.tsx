"use client";

import { useState } from "react";

export default function ShareButton({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const encodedText = encodeURIComponent(text);
  const emailSubject = encodeURIComponent("My Masquerade result");

  function shareWhatsApp() {
    window.open(
      `https://wa.me/?text=${encodedText}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function shareText() {
    window.location.href = `sms:?&body=${encodedText}`;
  }

  function shareGmail() {
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&su=${emailSubject}&body=${encodedText}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function copyResult() {
    await navigator.clipboard.writeText(text);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1800);
  }

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Masquerade",
          text,
        });
      } catch {
        // User cancelled the share sheet.
      }
    } else {
      await copyResult();
    }
  }

  return (
    <div className="share-actions">
      <button
        className="btn share-main"
        onClick={() => setOpen((current) => !current)}
      >
        SHARE YOUR RESULT
      </button>

      {open && (
        <div className="share-menu">
          <button className="share-option" onClick={shareWhatsApp}>
            <span>💬</span>
            <strong>WhatsApp</strong>
          </button>

          <button className="share-option" onClick={shareText}>
            <span>📱</span>
            <strong>Text Message</strong>
          </button>

          <button className="share-option" onClick={shareGmail}>
            <span>✉️</span>
            <strong>Gmail</strong>
          </button>

          <button className="share-option" onClick={copyResult}>
            <span>{copied ? "✓" : "📋"}</span>
            <strong>{copied ? "Copied!" : "Copy Result"}</strong>
          </button>

          {typeof navigator !== "undefined" && "share" in navigator && (
            <button className="share-option" onClick={nativeShare}>
              <span>↗</span>
              <strong>More…</strong>
            </button>
          )}
        </div>
      )}
    </div>
  );
}