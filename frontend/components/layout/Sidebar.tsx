"use client";

import React, { useState } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Box, 
  Upload, 
  Hexagon, 
  Wind, 
  Thermometer, 
  CloudSun, 
  CloudRain, 
  Cloud, 
  Droplets, 
  Zap,
  LayoutGrid
} from "lucide-react";

interface SidebarProps {
  onItemClick?: (item: string) => void;
  activeItem?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ onItemClick, activeItem }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { id: "project", icon: LayoutGrid, text: "Dự án hiện tại" },
    { id: "import", icon: Upload, text: "Import dữ liệu" },
    { id: "polygon", icon: Hexagon, text: "Vẽ polygon" },
    { id: "wind", icon: Wind, text: "Gió" },
    { id: "temp", icon: Thermometer, text: "Nhiệt độ" },
    { id: "weather", icon: CloudSun, text: "Thời tiết" },
    { id: "rain", icon: CloudRain, text: "Mưa" },
    { id: "clouds", icon: Cloud, text: "Mây" },
    { id: "air", icon: Droplets, text: "Chất lượng không khí" },
    { id: "wind3d", icon: Zap, text: "Gió 3D" },
  ];

  return (
    <aside 
      className={`fixed left-0 top-14 bottom-0 z-40 flex flex-col bg-black border-r border-white/10 transition-all duration-300 ease-in-out ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex-1 overflow-y-auto py-4 scrollbar-hide">
        <nav className="px-2 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onItemClick?.(item.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? "bg-white/10 text-white" 
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
                title={isCollapsed ? item.text : ""}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-white" : "text-white/60 group-hover:text-white"}`} strokeWidth={1.5} />
                {!isCollapsed && (
                  <span className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                    {item.text}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="p-4 border-t border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
      >
        {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
      </button>
    </aside>
  );
};
