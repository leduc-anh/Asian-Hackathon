"use client";

import React from "react";
import Link from "next/link";
import {
  Box,
  Home,
  FolderKanban,
  User,
  Bell,
  Search,
} from "lucide-react";

export const Header: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 z-50 bg-black/95 backdrop-blur-xl border-b border-white/10 px-6 flex items-center justify-between shadow-[0_12px_30px_rgba(0,0,0,0.45)]">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-4 group">
          <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center group-hover:border-white/30 transition-all duration-300">
            <Box className="w-4.5 h-4.5 text-white" strokeWidth={1.6} />
          </div>
        <div>
          <h1 className="text-sm font-semibold text-white tracking-tight leading-none mb-1">
            AeroTwin Studio
          </h1>
          <p className="text-[10px] text-white/45 uppercase tracking-[0.22em] font-semibold leading-none">
            Digital City Workspace
          </p>
        </div>
        </Link>
      </div>

      <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/10">
        <button className="flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-semibold text-white bg-white/10 border border-white/10 transition-all">
          <Home className="w-3.5 h-3.5 text-white" strokeWidth={1.6} />
          Trang chủ
        </button>
        <button className="flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-all">
          <FolderKanban className="w-3.5 h-3.5 text-white/70" strokeWidth={1.6} />
          Dự án
        </button>
      </nav>

      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center bg-white/5 border border-white/10 rounded-full px-3 py-1.5 gap-2 mr-2">
          <Search className="w-3.5 h-3.5 text-white/40" strokeWidth={1.6} />
          <span className="text-[11px] text-white/40 font-medium">
            Tìm kiếm dữ liệu...
          </span>
        </div>

        <button className="p-2 text-white/60 hover:text-white transition-colors relative group">
          <Bell className="w-5 h-5" strokeWidth={1.6} />
          <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-white/70 rounded-full border border-black group-hover:scale-125 transition-transform" />
        </button>

        <div className="h-6 w-[1px] bg-white/10 mx-1" />

        <div className="flex items-center gap-3 pl-1">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-white leading-none mb-0.5">
              Tonny
            </p>
            <p className="text-[10px] text-white/35 font-medium leading-none tracking-wide">
              Administrator
            </p>
          </div>
          <div className="w-9 h-9 rounded-full border border-white/20 bg-black/40 flex items-center justify-center overflow-hidden hover:border-white/40 transition-colors cursor-pointer">
            <User className="w-5 h-5 text-white/60" strokeWidth={1.6} />
          </div>
        </div>
      </div>
    </header>
  );
};
