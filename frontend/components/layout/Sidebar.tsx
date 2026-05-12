"use client";

import React from "react";
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
  MoreVertical,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";
import type { EnvTab, OperationMode, WindyDisplayMode } from "@/types/building";

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  statusMessage: string;
  operationMode: OperationMode;
  onSetOperationMode: (mode: OperationMode) => void;
  activeEnvTab: EnvTab | null;
  onSwitchEnvTab: (tab: EnvTab | null) => void;
  showWindSim: boolean;
  onToggleWindSim: () => void;
  windyUrl: string | null;
  windyDisplayMode: WindyDisplayMode;
  onCloseWindyFullToPanel: () => void;
  onOpenWindyFull: () => void;
  onStartPolygonDraw: () => void;
  onImportData: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  statusMessage,
  operationMode,
  onSetOperationMode,
  activeEnvTab,
  onSwitchEnvTab,
  showWindSim,
  onToggleWindSim,
  windyUrl,
  windyDisplayMode,
  onCloseWindyFullToPanel,
  onOpenWindyFull,
  onStartPolygonDraw,
  onImportData,
}) => {
  const btnClass = (isActive: boolean) =>
    `w-full flex items-center p-3 rounded-xl transition-all duration-200 group border ${
      isActive
        ? "bg-white/10 text-white border-white/20"
        : "text-white/60 border-transparent hover:bg-white/5 hover:text-white"
    } ${isCollapsed ? "justify-center" : "gap-3 px-3"}`;

  const Label: React.FC<{ text: string }> = ({ text }) =>
    !isCollapsed ? <span className="text-sm font-semibold">{text}</span> : null;

  return (
    <aside
      className={`fixed left-0 top-16 bottom-0 z-40 flex flex-col bg-black/95 border-r border-white/10 shadow-[18px_0_36px_rgba(0,0,0,0.45)] ${
        isCollapsed ? "w-16" : "w-[300px]"
      }`}
    >
      {/* Nút đóng/mở nhanh ở trên cùng */}
      <div className="p-2 border-b border-white/5 flex justify-end">
        <button
          onClick={onToggleCollapse}
          className={`p-2 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all ${
            isCollapsed ? "w-full flex justify-center" : ""
          }`}
          title={isCollapsed ? "Mở Menu" : "Đóng Menu"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" strokeWidth={1.6} />
          ) : (
            <ChevronLeft className="w-5 h-5" strokeWidth={1.6} />
          )}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-6 scrollbar-hide">
        <div className="px-3 space-y-6">
          {/* Project Info */}
          {!isCollapsed && (
            <div className="px-2 mb-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">
                Dự án hiện tại
              </p>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 group hover:border-white/25 transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-white">
                    TP.HCM Digital Twin
                  </h3>
                  <MoreVertical className="w-4 h-4 text-white/30" strokeWidth={1.6} />
                </div>
                <p className="text-[11px] text-white/40 font-medium leading-relaxed">
                  {statusMessage}
                </p>
              </div>
            </div>
          )}

          {/* Core Controls */}
          <div className="space-y-1">
            {!isCollapsed && (
              <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">
                Thao tác
              </p>
            )}

            <button
              type="button"
              onClick={onImportData}
              className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group ${
                isCollapsed ? "justify-center" : "gap-3 px-3 hover:bg-white/5"
              }`}
              title={isCollapsed ? "Import dữ liệu" : ""}
            >
              <Upload className="w-5 h-5 text-white/70 group-hover:text-white transition-all" strokeWidth={1.6} />
              {!isCollapsed && (
                <span className="text-sm font-semibold text-white/70 group-hover:text-white">
                  Import dữ liệu
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onStartPolygonDraw}
              className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group ${
                isCollapsed ? "justify-center" : "gap-3 px-3 hover:bg-white/5"
              }`}
              title={isCollapsed ? "Vẽ polygon" : ""}
            >
              <Hexagon className="w-5 h-5 text-white/70 group-hover:text-white transition-all" strokeWidth={1.6} />
              {!isCollapsed && (
                <span className="text-sm font-semibold text-white/70 group-hover:text-white">
                  Vẽ polygon
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onSetOperationMode("import")}
              className={btnClass(operationMode === "import")}
              title={isCollapsed ? "Import mô hình" : ""}
            >
              <Box
                className={`w-5 h-5 ${
                  operationMode === "import"
                    ? "text-white"
                    : "text-white/70 group-hover:text-white transition-all"
                }`}
                strokeWidth={1.6}
              />
              <Label text="Import mô hình 3D" />
            </button>
          </div>

          {/* Environmental Data */}
          <div className="space-y-1">
            {!isCollapsed && (
              <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">
                Môi trường
              </p>
            )}

            {([
              { tab: "wind" as EnvTab, icon: Wind, label: "Dữ liệu Gió" },
              { tab: "temp" as EnvTab, icon: Thermometer, label: "Nhiệt độ" },
              { tab: "clouds" as EnvTab, icon: CloudSun, label: "Thời tiết" },
              { tab: "rain" as EnvTab, icon: CloudRain, label: "Lượng mưa" },
              { tab: "clouds" as EnvTab, icon: Cloud, label: "Độ che phủ mây" },
              { tab: "aqi" as EnvTab, icon: Droplets, label: "Chất lượng không khí" },
            ]).map(({ tab, icon: Icon, label }, idx) => (
              <button
                key={`${tab}-${idx}`}
                type="button"
                onClick={() => onSwitchEnvTab(activeEnvTab === tab ? null : tab)}
                className={btnClass(activeEnvTab === tab)}
                title={isCollapsed ? label : ""}
              >
                <Icon className="w-5 h-5 text-white/70 group-hover:text-white" strokeWidth={1.6} />
                <Label text={label} />
              </button>
            ))}

            <button
              type="button"
              onClick={onToggleWindSim}
              className={btnClass(showWindSim)}
              title={isCollapsed ? "Gió 3D" : ""}
            >
              <Zap className="w-5 h-5 text-white/70 group-hover:text-white" strokeWidth={1.6} />
              <Label text="Mô phỏng Gió 3D" />
            </button>
          </div>

          {/* Windy Controls */}
          {windyUrl && (
            <div className="space-y-1">
              {!isCollapsed && (
                <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">
                  Windy Overlay
                </p>
              )}

              <button
                type="button"
                onClick={windyDisplayMode === "full" ? onCloseWindyFullToPanel : onOpenWindyFull}
                className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group text-white/60 hover:bg-white/5 hover:text-white ${
                  isCollapsed ? "justify-center" : "gap-3 px-3"
                }`}
              >
                {windyDisplayMode === "full" ? (
                  <Minimize2 className="w-5 h-5 text-white/70" strokeWidth={1.6} />
                ) : (
                  <Maximize2 className="w-5 h-5 text-white/70" strokeWidth={1.6} />
                )}
                <Label text={windyDisplayMode === "full" ? "Thu nhỏ Windy" : "Mở rộng Windy"} />
              </button>

              <button
                type="button"
                onClick={() => onSwitchEnvTab(null)}
                className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group text-white/60 hover:bg-white/5 hover:text-white ${
                  isCollapsed ? "justify-center" : "gap-3 px-3"
                }`}
              >
                <X className="w-5 h-5 text-white/70" strokeWidth={1.6} />
                <Label text="Tắt lớp phủ" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/5 flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-2 px-2">
            <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
              System Live
            </span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className={`p-2 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all ${
            isCollapsed ? "w-full flex justify-center" : ""
          }`}
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" strokeWidth={1.6} />
          ) : (
            <ChevronLeft className="w-5 h-5" strokeWidth={1.6} />
          )}
        </button>
      </div>
    </aside>
  );
};
