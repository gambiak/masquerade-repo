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
  solvedCount,
  totalCount,
}: {
  session: Session;
  puzzle: Puzzle;
  shownHints: string[];
  solvedCount: number;
  totalCount: number;
}) {
  const [answer, setAnswer] = useState("");
  const [coach, setCoach] = useState("");
  const [coachIsSuccess, setCoachIsSuccess] = useState(false);
  const [hints, setHints] = useState(shownHints);
  const [busy, setBusy] = useState(false);
  const [showQuitDialog, setShowQuitDialog] = useState(false);

  useEffect(() => {
    setAnswer("");
    setCoach("");
    setCoachIsSuccess(false);

    fetch("/api/hints", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: session.id }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.hints) {
          setHints(d.hints);
        }
      });
  }, [session.id, puzzle.id]);

  async function submit() {
    if (!answer.trim() || busy) return;

    setBusy(true);

    try {
      const r = await fetch("/api/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          answer,
        }),
      });

      const data = await r.json();

      if (data.correct) {
        setCoach(data.message);
        setCoachIsSuccess(true);

        setTimeout(() => {
          if (data.completed) {
            window.location.href =
              `/results/latest?difficulty=${session.difficulty_band}`;
          } else {
            window.location.reload();
          }
        }, 900);
      } else {
        setCoach(data.message || "Not quite. Try another angle.");
        setCoachIsSuccess(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function hint() {
    if (hints.length >= 3 || busy) return;

    setBusy(true);

    try {
      const r = await fetch("/api/hint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });

      const data = await r.json();

      if (data.hint) {
        setHints((current) => [...current, data.hint]);
      }
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    if (busy) return;

    setBusy(true);

    try {
      const r = await fetch("/api/session/skip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });

      const data = await r.json();

      if (r.ok) {
        window.location.reload();
        return;
      }

      setCoach(
        data.error === "last-unsolved-clue"
          ? "This is the last unsolved clue. The mask wants an answer."
          : data.error || "Could not skip this clue."
      );
      setCoachIsSuccess(false);
    } finally {
      setBusy(false);
    }
  }

  async function confirmQuit() {
    setBusy(true);

    try {
      await fetch("/api/session/quit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });

      window.location.href = "/";
    } finally {
      setBusy(false);
    }
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
          <span className="eyebrow">
            Clue {puzzle.position} · {solvedCount}/{totalCount} solved
          </span>
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
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              submit();
            }
          }}
          placeholder="One-word answer…"
          autoComplete="off"
          autoCapitalize="none"
        />

        {coach && (
          <div className={coachIsSuccess ? "success" : "coach"}>
            {coach}
          </div>
        )}

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
            className="btn primary"
            onClick={submit}
            disabled={busy || !answer.trim()}
          >
            {busy ? "THINKING…" : "SUBMIT"}
          </button>

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
            className="btn"
            onClick={skip}
            disabled={busy || totalCount - solvedCount <= 1}
          >
            SKIP FOR NOW
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
              Your unfinished run will be discarded. Today&apos;s mask will
              still be waiting if you decide to begin again.
            </p>

            <div className="modal-actions">
              <button
                className="btn primary"
                onClick={() => setShowQuitDialog(false)}
                disabled={busy}
              >
                KEEP PLAYING
              </button>

              <button
                className="btn danger"
                onClick={confirmQuit}
                disabled={busy}
              >
                {busy ? "QUITTING…" : "YES, QUIT GAME"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
