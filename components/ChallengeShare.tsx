"use client";

import { useState } from "react";

export default function ChallengeShare({
  challengeUrl,
}: {
  challengeUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  async function shareChallenge() {
    const shareData = {
      title: "Masquerade Challenge",
      text: "I challenged you to today’s Masquerade 🎭 Same five puzzles. No spoilers.",
      url: challengeUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(challengeUrl);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      try {
        await navigator.clipboard.writeText(challengeUrl);
        setCopied(true);

        setTimeout(() => {
          setCopied(false);
        }, 2000);
      } catch {
        // No further fallback needed.
      }
    }
  }

  return (
    <div>
      <button
        type="button"
        className="btn primary"
        onClick={shareChallenge}
      >
        SHARE CHALLENGE
      </button>

      <p style={{ marginTop: "0.75rem" }}>
        {copied
          ? "Challenge link copied!"
          : "WhatsApp · Messages · Mail · More"}
      </p>
    </div>
  );
}