"use client";

import React from "react";
import { Box, Upload, X } from "lucide-react";

interface ModelImportPanelProps {
  modelFileName: string | null;
  modelScaleInput: string;
  modelRotationInput: string;
  onScaleChange: (value: string) => void;
  onRotationChange: (value: string) => void;
  onFileImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onApplyScale: () => void;
  onClearModel: () => void;
  onClose: () => void;
}

export const ModelImportPanel: React.FC<ModelImportPanelProps> = ({
  modelFileName,
  modelScaleInput,
  modelRotationInput,
  onScaleChange,
  onRotationChange,
  onFileImport,
  onApplyScale,
  onClearModel,
  onClose,
}) => {
  return (
    <div className="fixed right-6 top-20 w-[340px] z-30 flex flex-col gap-6 rounded-2xl border border-white/10 bg-black/80 backdrop-blur-2xl p-6 shadow-2xl animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white tracking-tight">
          Nhập mô hình 3D
        </h3>
        <button
          onClick={onClose}
          className="p-2 text-white/40 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-6">
        <label className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-white/5 p-8 transition-all hover:bg-white/10 hover:border-white/20 cursor-pointer">
          <Upload className="w-10 h-10 text-white/20 group-hover:text-white group-hover:scale-110 transition-all mb-4" />
          <span className="text-sm font-bold text-white/80 mb-1">
            Tải lên mô hình
          </span>
          <span className="text-[10px] text-white/30 font-medium uppercase tracking-widest">
            Định dạng .GLB / .GLTF
          </span>
          <input
            type="file"
            accept=".glb,.gltf"
            onChange={onFileImport}
            className="hidden"
          />
        </label>

        {modelFileName && (
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center gap-3">
            <Box className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-cyan-400 truncate">
              {modelFileName}
            </span>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                Tỉ lệ
              </label>
              <input
                type="number"
                min={0.01}
                step={0.1}
                value={modelScaleInput}
                onChange={(e) => onScaleChange(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white outline-none focus:border-white/40 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                Xoay (độ)
              </label>
              <input
                type="number"
                value={modelRotationInput}
                onChange={(e) => onRotationChange(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white outline-none focus:border-white/40 transition-all"
              />
            </div>
          </div>
          <button
            onClick={onApplyScale}
            className="w-full py-3 rounded-xl bg-white text-black text-sm font-bold shadow-xl hover:bg-zinc-200 transition-all"
          >
            Cập nhật mô hình
          </button>
          <button
            onClick={onClearModel}
            className="w-full py-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-sm font-bold text-rose-400 hover:bg-rose-500/20 transition-all"
          >
            Xóa mô hình
          </button>
        </div>
      </div>
    </div>
  );
};
