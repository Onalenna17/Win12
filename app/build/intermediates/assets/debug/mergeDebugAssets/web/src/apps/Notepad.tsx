import { useState } from "react";
import type { WindowRecord } from "../types";
import { useDesktop } from "../context/DesktopContext";

export function NotepadApp({ win }: { win: WindowRecord }) {
  const { showToast, updateWindow } = useDesktop();
  const fileName = (win.appProps?.fileName as string) || "Untitled";
  const [text, setText] = useState(
    fileName === "Untitled"
      ? ""
      : `This is a preview of ${fileName}.\n\nWin12 Notepad stores notes locally in this session.\nUse File → Save to keep a copy in Downloads.`,
  );
  const [wrap, setWrap] = useState(true);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-[var(--panel-border)] px-2 py-1 text-xs">
        {["File", "Edit", "View"].map((m) => (
          <button
            key={m}
            className="rounded px-2 py-1 hover:bg-[var(--surface-hover)]"
            onClick={() => {
              if (m === "File") {
                showToast("Notepad", `${fileName} saved to Documents (preview)`);
                updateWindow(win.id, { title: fileName + " - Notepad" });
              }
              if (m === "View") setWrap((w) => !w);
            }}
          >
            {m}
          </button>
        ))}
        <span className="ml-auto pr-2 text-[var(--text-muted)]">
          {text.length} chars · {words} words · wrap {wrap ? "on" : "off"}
        </span>
      </div>
      <textarea
        className="selectable h-full w-full resize-none bg-transparent p-4 text-[13px] leading-relaxed outline-none"
        style={{ whiteSpace: wrap ? "pre-wrap" : "pre", fontFamily: wrap ? "inherit" : "var(--font-mono)" }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        placeholder="Start typing…"
      />
    </div>
  );
}
