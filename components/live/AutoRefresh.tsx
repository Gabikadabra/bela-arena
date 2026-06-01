"use client";

import { useEffect, useState } from "react";

type AutoRefreshProps = {
  intervalMs?: number;
  label?: string;
  skipWhileTyping?: boolean;
};

function userIsTyping() {
  const active = document.activeElement;
  if (!active) return false;

  const tag = active.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    active.getAttribute("contenteditable") === "true"
  );
}

export default function AutoRefresh({
  intervalMs = 60_000,
  label = "Auto refresh: 1 min",
  skipWhileTyping = true
}: AutoRefreshProps) {
  const [secondsLeft, setSecondsLeft] = useState(Math.round(intervalMs / 1000));

  useEffect(() => {
    const tick = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          if (!skipWhileTyping || !userIsTyping()) {
            window.location.reload();
          }

          return Math.round(intervalMs / 1000);
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(tick);
  }, [intervalMs, skipWhileTyping]);

  return (
    <div className="fixed bottom-4 right-4 z-40 hidden rounded-full border border-[#d4b06a]/25 bg-[#071810]/85 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#f3dfad] shadow-2xl backdrop-blur-md sm:flex">
      <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-green-400" />
      {label} · {secondsLeft}s
    </div>
  );
}
