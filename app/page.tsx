"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Source {
  content: string;
  metadata: {
    source?: string;
    [key: string]: any;
  };
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("API Error:", errorData);
        throw new Error(errorData.error || "Failed to fetch response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      let assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("0:")) {
              const match = line.match(/0:"(.*)"/);
              if (match) {
                const text = match[1];
                assistantMessage.content += text;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = { ...assistantMessage };
                  return newMessages;
                });
              }
            } else if (line.startsWith("d:")) {
              try {
                const dataStr = line.slice(2);
                const data = JSON.parse(dataStr);
                if (data.sources) {
                  setSources(data.sources);
                }
              } catch (e) {
                console.error("Error parsing sources:", e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Kechirasiz, xatolik yuz berdi: ${
          error instanceof Error ? error.message : "Noma'lum xatolik"
        }`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`flex h-screen ${
        isDarkMode ? "bg-[#0f1a2e]" : "bg-gray-50"
      }`}
    >
      {/* Asosiy Chat */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div
          className={`border-b px-6 py-4 flex items-center justify-between ${
            isDarkMode
              ? "bg-[#1a2942] border-[#2a3f5f]"
              : "bg-white border-gray-200"
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xl">MB</span>
            </div>
            <div>
              <h1
                className={`text-xl font-bold ${
                  isDarkMode ? "text-white" : "text-gray-800"
                }`}
              >
                Markaziy Bank
              </h1>
              <p
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Ichki Tizim
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded-lg ${
              isDarkMode
                ? "bg-[#2a3f5f] text-yellow-400 hover:bg-[#3a4f6f]"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {isDarkMode ? (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Xabarlar */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center mt-20">
              <p
                className={`text-lg ${
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                👋 Salom! Hujjatlaringiz haqida savol bering.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-2xl rounded-lg px-4 py-3 ${
                  message.role === "user"
                    ? isDarkMode
                      ? "bg-[#3d5a80] text-white"
                      : "bg-blue-600 text-white"
                    : isDarkMode
                    ? "bg-[#1a2942] border border-[#2a3f5f] text-gray-200"
                    : "bg-white border border-gray-200 text-gray-800"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div
                className={`rounded-lg px-4 py-3 ${
                  isDarkMode
                    ? "bg-[#1a2942] border border-[#2a3f5f]"
                    : "bg-white border border-gray-200"
                }`}
              >
                <div className="flex space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full animate-bounce ${
                      isDarkMode ? "bg-gray-500" : "bg-gray-400"
                    }`}
                  ></div>
                  <div
                    className={`w-2 h-2 rounded-full animate-bounce delay-100 ${
                      isDarkMode ? "bg-gray-500" : "bg-gray-400"
                    }`}
                  ></div>
                  <div
                    className={`w-2 h-2 rounded-full animate-bounce delay-200 ${
                      isDarkMode ? "bg-gray-500" : "bg-gray-400"
                    }`}
                  ></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Kiritish */}
        <div
          className={`border-t px-6 py-4 ${
            isDarkMode
              ? "bg-[#1a2942] border-[#2a3f5f]"
              : "bg-white border-gray-200"
          }`}
        >
          <form onSubmit={handleSubmit} className="flex space-x-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Savolingizni yozing..."
              className={`flex-1 border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 ${
                isDarkMode
                  ? "bg-[#0f1a2e] border-[#2a3f5f] text-white placeholder-gray-500 focus:ring-blue-500"
                  : "bg-white border-gray-300 text-gray-800 placeholder-gray-400 focus:ring-blue-500"
              }`}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className={`px-6 py-3 rounded-lg font-medium transition ${
                isDarkMode
                  ? "bg-[#3d5a80] text-white hover:bg-[#4d6a90] disabled:bg-[#2a3f5f]"
                  : "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
              } disabled:cursor-not-allowed`}
            >
              {isLoading ? "Yuborilmoqda..." : "Yuborish"}
            </button>
          </form>
        </div>
      </div>

      {/* O'ng tomon - Manbalar */}
      <div
        className={`w-96 border-l overflow-y-auto ${
          isDarkMode
            ? "bg-[#0f1a2e] border-[#2a3f5f]"
            : "bg-white border-gray-200"
        }`}
      >
        <div className="p-6">
          <h2
            className={`text-xl font-bold mb-4 ${
              isDarkMode ? "text-white" : "text-gray-800"
            }`}
          >
            📚 Manbalar
          </h2>

          {sources.length === 0 ? (
            <p
              className={`text-sm ${
                isDarkMode ? "text-gray-400" : "text-gray-500"
              }`}
            >
              Savol berganingizda manbalar bu yerda ko'rinadi
            </p>
          ) : (
            <div className="space-y-4">
              {sources.map((source, index) => {
                const fileName =
                  source.metadata.source?.split("/").pop() ||
                  source.metadata.source ||
                  "Noma'lum Hujjat";

                return (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 transition ${
                      isDarkMode
                        ? "border-[#2a3f5f] hover:bg-[#1a2942]"
                        : "border-gray-200 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <svg
                          className={`w-6 h-6 ${
                            isDarkMode ? "text-blue-400" : "text-blue-600"
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3
                          className={`font-semibold text-sm mb-2 ${
                            isDarkMode ? "text-gray-200" : "text-gray-800"
                          }`}
                        >
                          📄 {fileName}
                        </h3>
                        <p
                          className={`text-xs line-clamp-4 ${
                            isDarkMode ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          {source.content.substring(0, 200)}
                          {source.content.length > 200 ? "..." : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}