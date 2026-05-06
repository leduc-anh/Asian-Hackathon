"use client";

import React from "react";

export const LoadingOverlay: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
      <div className="bg-black/80 border border-white/10 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in zoom-in duration-300">
        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <span className="text-sm font-bold text-white tracking-tight">
          Đang tải dữ liệu môi trường...
        </span>
      </div>
    </div>
  );
};
