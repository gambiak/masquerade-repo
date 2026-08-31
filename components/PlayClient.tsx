"use client";

import { useEffect, useState } from "react";

type Puzzle = {
  id: string;
  clue_type: string;
  clue_text: string;
  position: number;
  is_final_mask: boolean;
};

type Session = {
  id: string;
  current_position: number;
  difficulty_band: string;
};

export default function PlayClient({
  session,
  puzzle,
  shownHints,
}: {
  session: Session;
  puzzle: Puzzle;
  shownHints: string[];
}) {
  const [answer, setAnswer] = useState("");
  const [coach, setCoach] = useState("");
  const [hints, setHints] = useState(shownHints);
  const [busy, setBusy] = useState(false);
  const [showQuitDialog, setShowQuitDialog] = useState(false);

  useEffect(() => {
    fetch("/api/hints", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: session.id }),
    })
      .then((r) => r.json())
      .then((d) => d.hints && setHints(d.hints));
  }, [session.id, puzzle.id]);

  async function submit() {
    if (!answer.trim() || busy) return;

    setBusy(true);

    const r = await fetch("/api/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: session.id,
        answer,
      }),
    });

    const data = await r.json();
    setBusy(false);

    if (data.correct) {
      setCoach(data.message);

      setTimeout(() => {
        if (puzzle.is_final_mask) {
          window.location.href = "/results/latest";
        } else {
          window.location.reload();
        }
      }, 900);
    } else {
      setCoach(data.message);
    }
  }

  async function hint() {
    if (hints.length >= 3) return;

    const r = await fetch("/api/hint", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: session.id }),
    });

    const data = await r.json();

    if (data.hint) {
      setHints((current) => [...current, data.hint]);
    }
  }

  async function confirmQuit() {
    setBusy(true);

    await fetch("/api/session/quit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: session.id }),
    });

    window.location.href = "/";
  }

  return (
    <>
      <section className="card play-card">
        {puzzle.is_final_mask && (
          <div className="eyebrow" style={{ textAlign: "center" }}>
            🎭 THE FINAL MASK
          </div>
        )}

        <div className="row">
          <span className="eyebrow">Clue {puzzle.position}</span>
          <span className="pill">{puzzle.clue_type}</span>
        </div>

        <div
          className={`clue ${
            ["logic"].includes(puzzle.clue_type)
              ? "logic"
              : ["pattern", "math"].includes(puzzle.clue_type)
                ? "pattern"
                : "word"
          } ${puzzle.is_final_mask ? "mask" : ""}`}
        >
          {puzzle.clue_text}
        </div>

        <input
          className="answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="One-word answer…"
          autoComplete="off"
          autoCapitalize="none"
        />

        {coach && (
          <div className={coach.includes("Correct") ? "success" : "coach"}>
            {coach}
          </div>
        )}

        {/* Hints now appear ABOVE the Submit button */}
        {hints.length > 0 && (
          <div className="hints-list">
            {hints.map((h, i) => (
              <div key={i} className="hint">
                <b>Hint {i + 1}</b>
                <br />
                {h}
              </div>
            ))}
          </div>
        )}

        <div className="stack">
          <button
            className="btn"
            onClick={hint}
            disabled={busy || hints.length >= 3}
          >
            💡{" "}
            {hints.length >= 3
              ? "ALL HINTS REVEALED"
              : `HINT ${hints.length + 1} OF 3`}
          </button>

          <button
            className="btn primary"
            onClick={submit}
            disabled={busy || !answer.trim()}
          >
            {busy ? "THINKING…" : "SUBMIT"}
          </button>

          <button
            className="btn danger"
            onClick={() => setShowQuitDialog(true)}
            disabled={busy}
          >
            QUIT GAME
          </button>
        </div>
      </section>

      {showQuitDialog && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setShowQuitDialog(false)}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quit-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-mask">🎭</div>

            <div className="eyebrow">Leave the masquerade?</div>

            <h2 id="quit-title">Quit this game?</h2>

            <p>
              Your unfinished run will be discarded. Today's mask will still
              be waiting if you decide to begin again.
            </p>

            <div className="modal-actions">
              <button
                className="btn primary"
                onClick={() => setShowQuitDialog(false)}
              >
                KEEP PLAYING
              </button>

              <button
                className="btn danger"
                onClick={confirmQuit}
              >
                YES, QUIT GAME
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}