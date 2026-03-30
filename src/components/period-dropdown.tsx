"use client";

import { useEffect, useRef, useState } from "react";

export interface PeriodOption {
  key: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: PeriodOption[];
  className?: string;
}

export function PeriodDropdown({ value, onChange, options, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const current = options.find((o) => o.key === value);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-3 pr-2.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-sm font-medium text-white transition-all select-none"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
        <span className="whitespace-nowrap">{current?.label ?? value}</span>
        <svg
          className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 right-0 z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-1.5 min-w-[160px] overflow-hidden">
          {options.map((o) => (
            <button
              key={o.key}
              onClick={() => { onChange(o.key); setOpen(false); }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                value === o.key
                  ? "text-white bg-zinc-800 font-medium"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
