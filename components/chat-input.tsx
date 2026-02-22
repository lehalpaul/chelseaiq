"use client";

import { useState, useRef, useEffect } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Only autofocus on devices with a fine pointer (mouse/trackpad)
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      inputRef.current?.focus();
    }
  }, []);

  const resizeInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const submitInput = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput("");
    requestAnimationFrame(() => resizeInput());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitInput();
  };

  return (
    <form onSubmit={handleSubmit} className="ai-panel flex gap-2 rounded-2xl p-2 sm:rounded-3xl sm:p-2.5">
      <textarea
        ref={inputRef}
        aria-label="Ask Chelseaiq Ai"
        value={input}
        rows={1}
        onChange={(e) => {
          setInput(e.target.value);
          resizeInput();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submitInput();
          }
        }}
        placeholder="Ask about sales, labor, items, or trends..."
        disabled={isLoading}
        className="ai-ring max-h-40 min-h-[48px] flex-1 resize-none rounded-xl border border-border/70 bg-background/65 px-3 py-3 text-sm placeholder:text-muted-foreground/90 focus:border-accent/50 focus:outline-none disabled:opacity-50 sm:rounded-2xl sm:px-4"
      />
      <button
        type="submit"
        aria-label="Send message"
        disabled={isLoading || !input.trim()}
        className="ai-ring inline-flex min-w-[88px] items-center justify-center rounded-xl bg-accent px-3 py-3 text-sm font-semibold text-accent-foreground transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[104px] sm:rounded-2xl sm:px-4"
      >
        {isLoading ? "Thinking" : "Send"}
      </button>
    </form>
  );
}
