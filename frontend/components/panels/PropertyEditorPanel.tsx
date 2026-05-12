"use client";

import React from "react";
import { X } from "lucide-react";
import type { RoofProfile } from "@/types/building";

interface PropertyEditorPanelProps {
  selectedFeatureId: string;
  heightInput: string;
  floorsInput: string;
  roofTypeInput: RoofProfile;
  payloadPreview: string;
  onHeightChange: (value: string) => void;
  onFloorsChange: (value: string) => void;
  onRoofTypeChange: (type: RoofProfile) => void;
  onApply: () => void;
  onStartShapeEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export const PropertyEditorPanel: React.FC<PropertyEditorPanelProps> = ({
  selectedFeatureId,
  heightInput,
  floorsInput,
  roofTypeInput,
  payloadPreview,
  onHeightChange,
  onFloorsChange,
  onRoofTypeChange,
  onApply,
  onStartShapeEdit,
  onDelete,
  onClose,
}) => {
  return (
    <div className="fixed right-6 top-20 bottom-6 w-[340px] z-30 flex flex-col gap-4 overflow-y-auto rounded-2xl border border-white/10 bg-black/80 backdrop-blur-2xl p-5 shadow-2xl animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold text-white tracking-tight">
          Thuộc tính khối
        </h3>
        <button
          onClick={onClose}
          className="p-2 text-white/40 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                Cao (m)
              </label>
              <input
                type="number"
                min={1}
                value={heightInput}
                onChange={(e) => onHeightChange(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white outline-none focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                Số tầng
              </label>
              <input
                type="number"
                min={1}
                value={floorsInput}
                onChange={(e) => onFloorsChange(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white outline-none focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">
              Kiểu mái
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["flat", "pyramid", "tiered"] as RoofProfile[]).map((type) => (
                <button
                  key={type}
                  onClick={() => onRoofTypeChange(type)}
                  className={`py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all border ${
                    roofTypeInput === type
                      ? "bg-white text-black border-white shadow-lg"
                      : "bg-white/5 text-white/40 border-white/10 hover:border-white/20"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <button
            onClick={onApply}
            className="w-full py-3 rounded-xl bg-white text-black text-sm font-bold shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Cập nhật thay đổi
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onStartShapeEdit}
              className="py-2.5 rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-white/70 hover:bg-white/10 transition-all"
            >
              Chỉnh điểm
            </button>
            <button
              onClick={onDelete}
              className="py-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition-all"
            >
              Xóa khối
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-white/5">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">
            GeoJSON Data
          </h4>
          <div className="p-4 rounded-xl bg-black border border-white/5 text-[10px] font-mono text-cyan-400/80 overflow-auto max-h-[200px] scrollbar-hide">
            <pre>{payloadPreview}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};
