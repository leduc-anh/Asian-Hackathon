"use client";

import React from "react";
import { Wind, X, Maximize2, Minimize2 } from "lucide-react";
import type { EnvTab, WindyDisplayMode } from "@/types/building";

interface WindyOverlayProps {
  windyUrl: string;
  windyDisplayMode: WindyDisplayMode;
  onCloseWindyFullToPanel: () => void;
  onOpenWindyFull: () => void;
  onSwitchEnvTab: (tab: EnvTab | null) => void;
}

export const WindyOverlay: React.FC<WindyOverlayProps> = ({
  windyUrl,
  windyDisplayMode,
  onCloseWindyFullToPanel,
  onOpenWindyFull,
  onSwitchEnvTab,
}) => {
  if (windyDisplayMode === "panel") {
    return (
      <div className="fixed right-6 bottom-6 w-[400px] h-[300px] z-30 rounded-2xl border border-white/10 bg-black/80 backdrop-blur-2xl p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Wind className="w-4 h-4 text-cyan-400" />
            <span className="text-[11px] font-bold text-white uppercase tracking-widest">
              Windy Live
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenWindyFull}
              className="p-1.5 text-white/40 hover:text-white transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSwitchEnvTab(null)}
              className="p-1.5 text-white/40 hover:text-rose-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <iframe
          src={windyUrl}
          className="w-full h-[calc(100%-40px)] rounded-xl border border-white/5 shadow-inner"
        />
      </div>
    );
  }

  // Full screen mode
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-500">
      <div className="w-full h-full max-w-6xl max-h-[800px] rounded-3xl border border-white/10 bg-black shadow-2xl overflow-hidden relative">
        <div className="absolute top-6 right-6 z-10 flex gap-2">
          <button
            onClick={onCloseWindyFullToPanel}
            className="p-3 rounded-2xl bg-black/80 backdrop-blur-md border border-white/10 text-white/60 hover:text-white transition-all shadow-xl hover:scale-110 active:scale-95"
          >
            <Minimize2 className="w-6 h-6" />
          </button>
          <button
            onClick={() => onSwitchEnvTab(null)}
            className="p-3 rounded-2xl bg-black/80 backdrop-blur-md border border-white/10 text-white/60 hover:text-rose-400 transition-all shadow-xl hover:scale-110 active:scale-95"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <iframe src={windyUrl} className="w-full h-full" />
      </div>
    </div>
  );
};
