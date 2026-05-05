"use client";

import React from "react";
import { Home, FolderKanban, User, Bell } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 h-14 z-50 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white/20 to-white/5 border border-white/20 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-white rounded-sm" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight">AeroTwin</h1>
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Urban Intelligence</p>
        </div>
      </div>

      <nav className="hidden md:flex items-center gap-1">
        <button className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium text-white bg-white/10 border border-white/10 transition-all">
          <Home className="w-3.5 h-3.5" strokeWidth={2} />
          Trang chủ
        </button>
        <button className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all">
          <FolderKanban className="w-3.5 h-3.5" strokeWidth={2} />
          Dự án
        </button>
      </nav>

      <div className="flex items-center gap-3">
        <button className="p-2 text-white/60 hover:text-white transition-colors relative">
          <Bell className="w-5 h-5" strokeWidth={1.5} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-white rounded-full border-2 border-black" />
        </button>
        <div className="h-8 w-[1px] bg-white/10 mx-1" />
        <div className="flex items-center gap-3 pl-1">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-white">Tonny</p>
            <p className="text-[10px] text-white/40">tonny@aerotwin</p>
          </div>
          <div className="w-8 h-8 rounded-full border border-white/20 bg-gradient-to-tr from-zinc-800 to-zinc-950 flex items-center justify-center overflow-hidden">
             <User className="w-5 h-5 text-white/40" />
          </div>
        </div>
      </div>
    </header>
  );
};
