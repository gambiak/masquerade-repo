"use client";

import { useState } from "react";
import DifficultyPicker from "@/components/DifficultyPicker";

export default function Start() {
  const [difficulty, setDifficulty] = useState("devious");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/session/start", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          difficulty,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to start today's Masquerade.");
        setBusy(false);
        return;
      }

      if (data.completed) {
        window.location.href = `/results/latest?difficulty=${difficulty}`;
        return;
      }

      window.location.href = "/play";
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main>
      <section className="hero">
        <div className="eyebrow">Choose your mask</div>

        <h1>Smart starts here.</h1>

        <p>
          All three levels target strong solvers. Difficulty changes the depth
          of inference, not the obscurity of trivia.
        </p>
      </section>

      <DifficultyPicker
        value={difficulty}
        disabled={busy}
        onChange={setDifficulty}
      />

      {error && (
        <div className="coach" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      <button
        className="btn primary"
        onClick={start}
        disabled={busy}
        style={{ marginTop: 16 }}
      >
        {busy ? "OPENING…" : "BEGIN"}
      </button>
    </main>
  );
}