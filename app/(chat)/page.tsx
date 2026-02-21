"use client";

import { useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { Message } from "@/components/message";
import { SuggestedQuestions } from "@/components/suggested-questions";
import { ChatInput } from "@/components/chat-input";
import { useScrollToBottom } from "@/components/use-scroll-to-bottom";
import { useResetChat } from "./layout";

export default function ChatPage() {
  const { messages, sendMessage, setMessages, status } = useChat();
  const { register } = useResetChat();

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    register(() => setMessages([]));
  }, [register, setMessages]);

  const { containerRef, endRef } = useScrollToBottom<HTMLDivElement>();

  const handleSend = (text: string) => {
    sendMessage({ role: "user", parts: [{ type: "text", text }] });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-24 pt-4 sm:px-6 sm:pb-28 sm:pt-6"
      >
        <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
          {messages.length === 0 && (
            <SuggestedQuestions onSelect={handleSend} />
          )}

          {messages.map((message, idx) => (
            <Message
              key={message.id}
              message={message}
              isStreaming={
                isLoading &&
                idx === messages.length - 1 &&
                message.role === "assistant"
              }
            />
          ))}

          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-border/70 bg-background/70 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm sm:px-6 sm:pt-4">
        <div className="mx-auto max-w-3xl">
          <ChatInput onSend={handleSend} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
