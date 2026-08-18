"use client";

import { useEffect, useState } from "react";

export function QuoteCountdown({ expiresAt }: { expiresAt: string }) {
  const [seconds, setSeconds] = useState(() =>
    Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)),
  );
  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds(
        Math.max(
          0,
          Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000),
        ),
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  const minutes = Math.floor(seconds / 60).toLocaleString("fa-IR", {
    minimumIntegerDigits: 2,
  });
  const rest = (seconds % 60).toLocaleString("fa-IR", {
    minimumIntegerDigits: 2,
  });
  return (
    <div
      className={`quote-timer ${seconds === 0 ? "expired" : ""}`}
      role="timer"
      aria-live="polite"
    >
      <span>
        {seconds === 0
          ? "این قیمت منقضی شده است"
          : "زمان باقی‌مانده برای پرداخت"}
      </span>
      {seconds > 0 && (
        <strong dir="ltr">
          {minutes}:{rest}
        </strong>
      )}
    </div>
  );
}
