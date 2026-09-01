"use client";

export default function DifficultyPicker({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const levels = [
    ["clever", "Clever"],
    ["devious", "Devious"],
    ["fiendish", "Fiendish"],
  ];

  return (
    <div className="grid grid3">
      {levels.map(([id, label]) => (
        <button
          key={id}
          disabled={disabled}
          onClick={() => onChange(id)}
          className={`btn level ${value === id ? "active" : ""}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
