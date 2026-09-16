import { useState } from "react";
import { cn } from "../utils/cn";

export function CalculatorApp() {
  const [expr, setExpr] = useState("");
  const [display, setDisplay] = useState("0");

  const press = (k: string) => {
    if (k === "C") {
      setExpr("");
      setDisplay("0");
      return;
    }
    if (k === "⌫") {
      const next = display.length > 1 ? display.slice(0, -1) : "0";
      setDisplay(next);
      setExpr((e) => e.slice(0, -1));
      return;
    }
    if (k === "=") {
      try {
        const safe = (expr || display).replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
        if (!/^[\d.+\-*/() ]+$/.test(safe)) return;
        const val = Function(`"use strict"; return (${safe})`)();
        const out = String(val);
        setDisplay(out);
        setExpr(out);
      } catch {
        setDisplay("Error");
      }
      return;
    }
    const map: Record<string, string> = { "×": "*", "÷": "/", "−": "-" };
    const next = display === "0" && /[0-9.]/.test(k) ? k : display + k;
    setDisplay(next);
    setExpr((e) => e + (map[k] || k));
  };

  const keys = [
    ["C", "⌫", "÷", "×"],
    ["7", "8", "9", "−"],
    ["4", "5", "6", "+"],
    ["1", "2", "3", "="],
    ["±", "0", ".", "%"],
  ];

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="rounded-xl bg-black/25 px-4 py-6 text-right">
        <div className="min-h-[28px] text-xs text-[var(--text-muted)]">{expr || " "}</div>
        <div className="text-4xl font-light tracking-tight">{display}</div>
      </div>
      <div className="grid flex-1 grid-cols-4 gap-2">
        {keys.flat().map((k) => (
          <button
            key={k}
            className={cn(
              "calc-key",
              k === "=" && "accent row-span-1",
              ["÷", "×", "−", "+"].includes(k) && "op",
            )}
            onClick={() => {
              if (k === "±") {
                if (display.startsWith("-")) {
                  setDisplay(display.slice(1));
                  setExpr((e) => e.replace(/-?(\d+\.?\d*)$/, "$1"));
                } else {
                  setDisplay("-" + display);
                }
                return;
              }
              if (k === "%") {
                const n = parseFloat(display) / 100;
                setDisplay(String(n));
                setExpr(String(n));
                return;
              }
              press(k);
            }}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}
