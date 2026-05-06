"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Box,
  Search,
  Plus,
  MapPin,
  Wind,
  Calendar,
  ArrowRight,
  Zap,
  Globe,
  BarChart3,
  Layers,
  User,
  Bell,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string;
  location: string;
  coordinates: { lat: number; lng: number };
  lastModified: string;
  status: "active" | "draft" | "completed";
  stats: { buildings: number; area: string };
}

const PROJECTS: Project[] = [
  {
    id: "hcm-digital-twin",
    name: "TP.HCM Digital Twin",
    description:
      "Mô phỏng vi khí hậu khu vực trung tâm Quận 1 — phân tích trường gió và tiện nghi nhiệt cho quy hoạch đô thị bền vững.",
    location: "Quận 1, TP. Hồ Chí Minh",
    coordinates: { lat: 10.77653, lng: 106.70098 },
    lastModified: "2 giờ trước",
    status: "active",
    stats: { buildings: 12, area: "2.4 km²" },
  },
  {
    id: "thu-duc-smart-city",
    name: "Thủ Đức Smart City",
    description:
      "Đánh giá tác động khí động học của khu đô thị mới — tối ưu hóa khoảng cách giữa các khối nhà dựa trên vùng quẩn gió.",
    location: "TP. Thủ Đức, TP. HCM",
    coordinates: { lat: 10.8512, lng: 106.7719 },
    lastModified: "1 ngày trước",
    status: "active",
    stats: { buildings: 28, area: "5.1 km²" },
  },
  {
    id: "da-nang-coastal",
    name: "Đà Nẵng Coastal Zone",
    description:
      "Phân tích ảnh hưởng gió biển đến chất lượng không khí khu vực ven biển — AQI có trọng số theo phương pháp AQUIS.",
    location: "Quận Sơn Trà, Đà Nẵng",
    coordinates: { lat: 16.0678, lng: 108.2208 },
    lastModified: "3 ngày trước",
    status: "draft",
    stats: { buildings: 8, area: "1.8 km²" },
  },
  {
    id: "hanoi-west-lake",
    name: "Hà Nội — Khu vực Hồ Tây",
    description:
      "Nghiên cứu hiệu ứng đảo nhiệt đô thị khu vực Tây Hồ — mô phỏng thông gió tự nhiên cho các khu dân cư mới.",
    location: "Quận Tây Hồ, Hà Nội",
    coordinates: { lat: 21.0545, lng: 105.8194 },
    lastModified: "1 tuần trước",
    status: "completed",
    stats: { buildings: 35, area: "8.2 km²" },
  },
];

const statusConfig = {
  active: { label: "Đang hoạt động", color: "bg-emerald-500", textColor: "text-emerald-400" },
  draft: { label: "Bản nháp", color: "bg-amber-500", textColor: "text-amber-400" },
  completed: { label: "Hoàn thành", color: "bg-blue-500", textColor: "text-blue-400" },
};

export default function LandingPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProjects = PROJECTS.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-[#050506]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#050506]/80 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-white/10 to-white/[0.03] border border-white/[0.08] flex items-center justify-center">
              <Box className="w-4.5 h-4.5 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-white tracking-tight leading-none">
                AeroTwin Studio
              </h1>
              <p className="text-[10px] text-white/35 uppercase tracking-[0.2em] font-medium mt-0.5">
                Digital City Workspace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-2.5 text-white/40 hover:text-white transition-colors relative">
              <Bell className="w-[18px] h-[18px]" strokeWidth={1.5} />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-white/60 rounded-full" />
            </button>
            <div className="h-5 w-px bg-white/[0.06]" />
            <div className="w-8 h-8 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center cursor-pointer hover:border-white/20 transition-colors">
              <User className="w-4 h-4 text-white/40" strokeWidth={1.5} />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-radial from-cyan-500/[0.04] via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 pt-16 pb-12">
          <div className="animate-fade-in-up">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-px w-8 bg-gradient-to-r from-white/40 to-transparent" />
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/30">
                Mô phỏng Vi khí hậu Đô thị
              </span>
            </div>

            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-[1.1] mb-4 max-w-2xl">
              Thiết kế đô thị
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white/90 via-white/60 to-white/30">
                thông minh hơn.
              </span>
            </h2>

            <p className="text-[15px] text-white/35 max-w-xl leading-relaxed font-medium mb-10">
              Tích hợp mô phỏng khí động học CFD, phân tích AQI có trọng số và
              trường gió 3D ngay từ giai đoạn thiết kế sơ bộ.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-12 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
            {[
              { icon: Globe, value: "4", label: "Dự án" },
              { icon: Layers, value: "83", label: "Công trình" },
              { icon: Wind, value: "3D", label: "Mô phỏng gió" },
              { icon: BarChart3, value: "AQI", label: "Chỉ số" },
            ].map(({ icon: Icon, value, label }) => (
              <div
                key={label}
                className="group p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1] hover:bg-white/[0.04] transition-all duration-500 cursor-default"
              >
                <Icon className="w-4 h-4 text-white/20 mb-3 group-hover:text-white/40 transition-colors" strokeWidth={1.5} />
                <p className="text-2xl font-bold text-white tracking-tight mb-0.5">{value}</p>
                <p className="text-[11px] text-white/25 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Search & Projects */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Tìm dự án, địa danh, tọa độ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/15 focus:bg-white/[0.05] transition-all duration-300"
            />
          </div>

          <Link
            href="/project/new"
            className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-zinc-200 active:scale-[0.97] transition-all shadow-lg shadow-white/5"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            Tạo dự án mới
          </Link>
        </div>

        {/* Project Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
          {filteredProjects.map((project) => {
            const status = statusConfig[project.status];
            return (
              <Link
                key={project.id}
                href={`/project/${project.id}`}
                className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-500 cursor-pointer"
              >
                {/* Status badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${status.color}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${status.textColor}`}>
                      {status.label}
                    </span>
                  </div>
                  <span className="text-[11px] text-white/20 font-medium">
                    {project.lastModified}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-lg font-bold text-white tracking-tight mb-2 group-hover:text-white transition-colors">
                  {project.name}
                </h3>

                {/* Description */}
                <p className="text-[13px] text-white/30 leading-relaxed mb-5 line-clamp-2">
                  {project.description}
                </p>

                {/* Meta */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-white/15" strokeWidth={1.5} />
                    <span className="text-[11px] text-white/25 font-medium">{project.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-white/15" strokeWidth={1.5} />
                    <span className="text-[11px] text-white/25 font-medium">{project.stats.buildings} công trình</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-white/[0.04]">
                  <code className="text-[10px] text-white/15 font-mono">
                    {project.coordinates.lat.toFixed(4)}, {project.coordinates.lng.toFixed(4)}
                  </code>
                  <div className="flex items-center gap-1.5 text-white/20 group-hover:text-white/50 transition-colors">
                    <span className="text-[11px] font-semibold">Mở dự án</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={2} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Empty state */}
        {filteredProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="w-10 h-10 text-white/10 mb-4" strokeWidth={1} />
            <p className="text-sm text-white/25 font-medium mb-1">
              Không tìm thấy dự án nào
            </p>
            <p className="text-xs text-white/15">
              Thử tìm kiếm với từ khóa khác hoặc tạo dự án mới
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
