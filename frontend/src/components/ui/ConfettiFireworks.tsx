import { useEffect } from "react";
import confetti from "canvas-confetti";

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export default function ConfettiFireworks({
  active,
}: {
  active: boolean;
}) {
  useEffect(() => {
    if (!active) return;

    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = {
      startVelocity: 30,
      spread: 360,
      ticks: 60,
      zIndex: 1000,
    };

    const interval = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        window.clearInterval(interval);
        return;
      }

      const particleCount = Math.max(12, Math.floor(50 * (timeLeft / duration)));

      void confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });

      void confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);

    return () => window.clearInterval(interval);
  }, [active]);

  return null;
}
