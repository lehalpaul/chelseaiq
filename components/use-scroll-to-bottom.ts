"use client";

import { useEffect, useRef } from "react";

export function useScrollToBottom<T extends HTMLElement>() {
  const containerRef = useRef<T>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateAutoScroll = () => {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      shouldAutoScrollRef.current = distanceFromBottom < 120;
    };

    let animationFrameId: number | null = null;
    const scheduleScroll = () => {
      if (!shouldAutoScrollRef.current) return;
      if (animationFrameId !== null) return;

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      });
    };

    updateAutoScroll();
    scheduleScroll();
    container.addEventListener("scroll", updateAutoScroll, { passive: true });

    const observer = new MutationObserver(() => {
      scheduleScroll();
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", updateAutoScroll);
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return { containerRef, endRef };
}
