"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageCircle,
  Send,
  X,
  Sparkles,
  Building2,
  Wind,
  MapPin,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  Thermometer,
  ShieldAlert,
  Leaf,
  Zap,
  RotateCcw,
  Minus,
  Trash2,
  ChevronRight,
} from "lucide-react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  actions?: ChatAction[];
}

export interface ChatAction {
  type: "add_building" | "navigate" | "set_wind" | "analyze";
  label: string;
  payload: Record<string, unknown>;
}

export interface BuildingInfo {
  id: string;
  height: number;
  floors: number;
  roofType: string;
  coordinates?: [number, number];
}

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  envData: {
    wind?: { speed: number; deg: number };
    pollution?: { pm2_5: number };
    temp?: number;
    humidity?: number;
  } | null;
  buildingCount: number;
  mapCenter: { lat: number; lng: number } | null;
  /** Detailed building info from the workspace */
  buildings?: BuildingInfo[];
  onAction?: (action: ChatAction) => void;
  autoPrompt?: string;
  onAutoPromptHandled?: () => void;
}

const QUICK_PROMPTS = [
  { icon: Wind, text: "Phân tích trường gió & đề xuất thông gió tự nhiên", color: "text-cyan-400" },
  { icon: AlertTriangle, text: "Đánh giá chất lượng không khí & cảnh báo sức khỏe", color: "text-amber-400" },
  { icon: Building2, text: "Tòa nhà xây ở đây có nguy hiểm gì?", color: "text-violet-400" },
  { icon: Leaf, text: "Đề xuất vị trí tối ưu mảng xanh chống bụi", color: "text-emerald-400" },
  { icon: Thermometer, text: "Gợi ý thay đổi vật liệu giảm nhiệt độ", color: "text-orange-400" },
  { icon: ShieldAlert, text: "Mô phỏng sơ tán khẩn cấp khi cháy", color: "text-rose-400" },
];

const parseActionsFromContent = (content: string): ChatAction[] => {
  const actions: ChatAction[] = [];
  const lc = content.toLowerCase();

  if (lc.includes("mô phỏng gió") || lc.includes("bật wind") || lc.includes("thông gió") || lc.includes("luồng khí")) {
    if (!actions.find(a => a.type === "set_wind")) {
      actions.push({ type: "set_wind", label: "💨 Bật mô phỏng gió 3D", payload: { action: "enable_wind" } });
    }
  }
  if (lc.includes("cảnh báo") || lc.includes("nguy hiểm") || lc.includes("khẩn cấp") || lc.includes("cháy") || lc.includes("khói")) {
    if (!actions.find(a => a.label.includes("Cảnh báo"))) {
      actions.push({ type: "analyze", label: "⚠️ Cảnh báo & Khẩn cấp", payload: { action: "warnings" } });
    }
  }
  if (lc.includes("máy lọc") || lc.includes("lọc không khí") || lc.includes("bụi mịn")) {
    if (!actions.find(a => a.label.includes("Lọc khí"))) {
      actions.push({ type: "analyze", label: "🏭 Tối ưu Lọc khí", payload: { action: "air_filter" } });
    }
  }
  if (lc.includes("sơ tán") || lc.includes("thoát hiểm") || lc.includes("rủi ro")) {
    if (!actions.find(a => a.label.includes("Sơ tán"))) {
      actions.push({ type: "analyze", label: "🚨 Mô phỏng Sơ tán (Beta)", payload: { action: "evacuation" } });
    }
  }
  if (lc.includes("vật liệu") || lc.includes("low-e") || lc.includes("rèm cửa")) {
    if (!actions.find(a => a.label.includes("Vật liệu"))) {
      actions.push({ type: "analyze", label: "🧱 Cải tạo Vật liệu & Năng lượng", payload: { action: "materials" } });
    }
  }
  if (lc.includes("mảng xanh") || lc.includes("cây xanh") || lc.includes("lọc tự nhiên")) {
    if (!actions.find(a => a.label.includes("Mảng xanh"))) {
      actions.push({ type: "analyze", label: "🌿 Tối ưu Mảng xanh", payload: { action: "greenery" } });
    }
  }

  return actions;
};

export const AIChatPanel: React.FC<AIChatPanelProps> = ({
  isOpen,
  onClose,
  envData,
  buildingCount,
  mapCenter,
  buildings,
  onAction,
  autoPrompt,
  onAutoPromptHandled,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Xin chào! Tôi là **AeroTwin AI** — trợ lý Digital Twin đô thị.\n\nTôi đọc được toàn bộ dữ liệu workspace: **gió, nhiệt độ, bụi mịn, tọa độ tòa nhà**. Hãy hỏi tôi bất cứ điều gì về:\n\n• 🌬️ Phân tích gió & thông gió tự nhiên\n• 🏭 Cảnh báo ô nhiễm & lọc khí\n• 🏗️ Gợi ý cải tạo vật liệu & mảng xanh\n• ⚡ Tối ưu năng lượng & rèm cửa thông minh\n• 🚨 Mô phỏng khẩn cấp & sơ tán",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isAtBottomRef = useRef(true);

  const handleScroll = () => {
    const container = messagesEndRef.current?.parentElement;
    if (container) {
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
      isAtBottomRef.current = isAtBottom;
    }
  };

  const scrollToBottom = useCallback(() => {
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const processingPromptRef = useRef(false);
  useEffect(() => {
    if (autoPrompt && isOpen && !isLoading && !processingPromptRef.current) {
      processingPromptRef.current = true;
      const prompt = autoPrompt;
      onAutoPromptHandled?.();
      sendMessage(prompt).finally(() => {
        processingPromptRef.current = false;
      });
    }
  }, [autoPrompt, isOpen, isLoading, onAutoPromptHandled]);

  const getWindDirection = (deg: number): string => {
    const dirs = ["Bắc", "Đông Bắc", "Đông", "Đông Nam", "Nam", "Tây Nam", "Tây", "Tây Bắc"];
    return dirs[Math.round(deg / 45) % 8];
  };

  const buildContextString = (): string => {
    const parts: string[] = [];

    // Location
    if (mapCenter) {
      parts.push(`📍 Tọa độ trung tâm: ${mapCenter.lat.toFixed(5)}°N, ${mapCenter.lng.toFixed(5)}°E`);
    }

    // Buildings
    parts.push(`🏢 Tổng số tòa nhà trên bản đồ: ${buildingCount}`);
    if (buildings && buildings.length > 0) {
      parts.push(`\n── Chi tiết tòa nhà ──`);
      buildings.slice(0, 5).forEach((b, i) => {
        parts.push(
          `  Tòa ${i + 1}: cao ${b.height}m, ${b.floors} tầng, mái ${b.roofType}${
            b.coordinates ? `, tọa độ [${b.coordinates[0].toFixed(5)}, ${b.coordinates[1].toFixed(5)}]` : ""
          }`
        );
      });
      if (buildings.length > 5) {
        parts.push(`  ... và ${buildings.length - 5} tòa nhà khác.`);
      }
    }

    // Wind
    if (envData?.wind) {
      const dir = getWindDirection(envData.wind.deg);
      parts.push(`\n💨 Gió: ${envData.wind.speed} m/s, hướng ${dir} (${envData.wind.deg}°)`);

      // ABL analysis
      const v10 = envData.wind.speed;
      const v50 = v10 * Math.pow(50 / 370, 0.22) / Math.pow(10 / 370, 0.22);
      parts.push(`   ABL tại 50m: ~${v50.toFixed(1)} m/s (công thức V_H = V_ref × (H/370)^0.22)`);
    }

    // Air quality
    if (envData?.pollution) {
      const pm = envData.pollution.pm2_5;
      const level = pm <= 12 ? "Tốt 🟢" : pm <= 35 ? "Trung bình 🟡" : pm <= 55 ? "Kém 🟠" : pm <= 150 ? "Xấu 🔴" : "Nguy hại 🟤";
      parts.push(`\n🌫️ PM2.5: ${pm} µg/m³ — ${level}`);
    }

    // Temperature
    if (envData?.temp !== undefined) {
      parts.push(`🌡️ Nhiệt độ: ${envData.temp}°C`);
    }
    if (envData?.humidity !== undefined) {
      parts.push(`💧 Độ ẩm: ${envData.humidity}%`);
    }

    return parts.join("\n");
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);

    // Placeholder cho tin nhắn của assistant
    const assistantMsgId = `assistant-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const contextStr = buildContextString();
      const apiMessages = [
        ...messages
          .filter((m) => m.id !== "welcome")
          .slice(-4) // Lấy lịch sử dài hơn một chút
          .map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: text.trim() },
      ];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: [
            { role: "system", content: `[Dữ liệu workspace - Realtime]\n${contextStr}` },
            ...apiMessages
          ] 
        }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;

        // Cập nhật tin nhắn assistant theo từng phần dữ liệu đổ về
        const parsedActions = parseActionsFromContent(fullContent);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: fullContent, actions: parsedActions.length > 0 ? parsedActions : undefined } : m
          )
        );
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId 
            ? { ...m, content: "⚠️ Không thể kết nối AI (Ollama). Hãy đảm bảo bạn đã chạy `docker-compose up -d`." } 
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Đã xóa lịch sử. Hãy bắt đầu cuộc trò chuyện mới!",
        timestamp: new Date(),
      },
    ]);
  };

  const renderMarkdown = (text: string) => {
    return text
      .replace(/^### (.*?)$/gm, '<h4 class="text-white font-semibold text-[13px] mt-3 mb-1">$1</h4>')
      .replace(/^## (.*?)$/gm, '<h3 class="text-white font-bold text-[14px] mt-3 mb-1.5">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-white/50">$1</em>')
      .replace(/```([\s\S]*?)```/g, '<pre class="mt-2 mb-2 p-3 rounded-lg bg-black/40 border border-white/5 text-[11px] font-mono text-cyan-400/80 overflow-x-auto whitespace-pre-wrap">$1</pre>')
      .replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 rounded bg-white/10 text-cyan-400 text-[11px] font-mono">$1</code>')
      .replace(/^[•·] (.*?)$/gm, '<div class="flex gap-2 ml-1"><span class="text-white/20">•</span><span>$1</span></div>')
      .replace(/^- (.*?)$/gm, '<div class="flex gap-2 ml-1"><span class="text-white/20">–</span><span>$1</span></div>')
      .replace(/\n/g, "<br/>");
  };

  // Remove: if (!isOpen) return null; 
  // Parent now handles visibility with CSS transform for persistence.

  return (
    <div className="h-full w-full flex flex-col border-l border-white/[0.08] bg-[#08080a]/95 backdrop-blur-2xl shadow-2xl shadow-black/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center relative">
            <Sparkles className="w-4.5 h-4.5 text-cyan-400" strokeWidth={1.5} />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#08080a]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white leading-none mb-0.5">
              AeroTwin AI
            </h3>
            <p className="text-[9px] text-white/25 font-medium uppercase tracking-wider">
              Llama 3 • Local Engine
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearChat}
            className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all"
            title="Xóa lịch sử chat"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-white/20 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            title="Thu nhỏ"
          >
            <Minus className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Live context bar */}
      <div className="px-4 py-2 border-b border-white/[0.03] bg-white/[0.01]">
        <div className="flex items-center gap-3 text-[9px] text-white/20 font-medium overflow-x-auto scrollbar-hide">
          {envData?.wind && (
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Wind className="w-2.5 h-2.5" strokeWidth={1.5} />
              {envData.wind.speed}m/s {getWindDirection(envData.wind.deg)}
            </span>
          )}
          {envData?.pollution && (
            <span className="flex items-center gap-1 whitespace-nowrap">
              <span className={`w-1.5 h-1.5 rounded-full ${
                envData.pollution.pm2_5 <= 35 ? "bg-emerald-400" : envData.pollution.pm2_5 <= 55 ? "bg-amber-400" : "bg-rose-400"
              }`} />
              PM2.5 {envData.pollution.pm2_5}
            </span>
          )}
          <span className="flex items-center gap-1 whitespace-nowrap">
            <Building2 className="w-2.5 h-2.5" strokeWidth={1.5} />
            {buildingCount} tòa nhà
          </span>
          {mapCenter && (
            <span className="flex items-center gap-1 whitespace-nowrap">
              <MapPin className="w-2.5 h-2.5" strokeWidth={1.5} />
              {mapCenter.lat.toFixed(2)}°N
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 scrollbar-hide"
        onScroll={handleScroll}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`relative group max-w-[88%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-white/10 text-white rounded-br-sm"
                  : "bg-white/[0.02] text-white/65 border border-white/[0.05] rounded-bl-sm"
              }`}
            >
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
              {msg.role === "assistant" && msg.id !== "welcome" && (
                <button
                  onClick={() => copyMessage(msg.id, msg.content)}
                  className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-black/80 border border-white/10 text-white/30 hover:text-white transition-all"
                >
                  {copiedId === msg.id ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              )}
              {msg.actions && msg.actions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-white/[0.05]">
                  {msg.actions.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => onAction?.(action)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/15 text-[10px] font-bold text-cyan-400 hover:bg-cyan-500/20 transition-all"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && !messages[messages.length - 1]?.content && (
          <div className="flex justify-start">
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-[11px] text-white/20 font-medium">
                  Đang phân tích dữ liệu...
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <p className="text-[9px] text-white/15 font-bold uppercase tracking-wider mb-2 px-1">
            Gợi ý nhanh
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_PROMPTS.map(({ icon: Icon, text, color }) => (
              <button
                key={text}
                onClick={() => sendMessage(text)}
                className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-[10px] text-white/30 font-medium hover:bg-white/[0.05] hover:text-white/50 hover:border-white/[0.08] transition-all text-left leading-snug"
              >
                <Icon className={`w-3 h-3 mt-0.5 shrink-0 ${color}`} strokeWidth={1.5} />
                <span>{text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2">
        <div className="flex items-end gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/[0.05] focus-within:border-white/12 transition-all">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Hỏi về gió, bụi mịn, tòa nhà, sơ tán..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/15 outline-none resize-none max-h-24 px-2 py-1.5"
          />
          <button
            onClick={() => sendMessage(inputValue)}
            disabled={!inputValue.trim() || isLoading}
            className="p-2.5 rounded-lg bg-gradient-to-br from-cyan-500/20 to-violet-500/20 text-white/60 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all"
          >
            <Send className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
        <p className="text-[8px] text-white/10 text-center mt-2 font-medium tracking-wide">
          AeroTwin AI • Powered by Llama 3 (Local)
        </p>
      </div>
    </div>
  );
};

/** Floating trigger button */
export const AIChatTrigger: React.FC<{
  onClick: () => void;
  hasUnread?: boolean;
}> = ({ onClick, hasUnread }) => (
  <button
    onClick={onClick}
    className="w-12 h-12 rounded-xl bg-[#0a0a0c]/80 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-xl hover:scale-105 hover:border-cyan-500/30 hover:bg-cyan-950/40 transition-all duration-300 group"
    title="Mở AI Assistant"
  >
    <div className="relative">
      <Sparkles
        className="w-5 h-5 text-cyan-400/80 group-hover:text-cyan-400 transition-colors"
        strokeWidth={2}
      />
      {hasUnread && (
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full border-2 border-[#0a0a0c] animate-pulse" />
      )}
    </div>
  </button>
);
