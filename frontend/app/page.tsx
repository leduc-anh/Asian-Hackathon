"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Box,
  Search,
  Plus,
  MapPin,
  Wind,
  ArrowRight,
  Zap,
  Globe,
  BarChart3,
  Layers,
  User,
  Bell,
  Building2,
  Thermometer,
  Clock,
  Filter,
  Sparkles,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string;
  location: string;
  coordinates: { lat: number; lng: number };
  lastModified: string;
  status: "active" | "draft" | "completed";
  stats: { buildings: number; area: string; windSpeed?: string; aqi?: number };
  tags: string[];
  thumbnail?: string;
}

const PROJECTS: Project[] = [
  {
    id: "hcm-digital-twin",
    name: "TP.HCM Digital Twin",
    description:
      "Mô phỏng vi khí hậu khu vực trung tâm Quận 1 — phân tích trường gió, vùng quẩn gió và tiện nghi nhiệt cho quy hoạch đô thị bền vững theo chuẩn RNG k-ε.",
    location: "Quận 1, TP. Hồ Chí Minh",
    coordinates: { lat: 10.77653, lng: 106.70098 },
    lastModified: "2 giờ trước",
    status: "active",
    stats: { buildings: 12, area: "2.4 km²", windSpeed: "3.2 m/s", aqi: 68 },
    tags: ["CFD", "Wind", "AQI"],
  },
  {
    id: "thu-duc-smart-city",
    name: "Thủ Đức Smart City",
    description:
      "Đánh giá tác động khí động học của khu đô thị mới — tối ưu hóa khoảng cách giữa các khối nhà dựa trên mô phỏng vùng quẩn gió 43 kịch bản CFD.",
    location: "TP. Thủ Đức, TP. HCM",
    coordinates: { lat: 10.8512, lng: 106.7719 },
    lastModified: "1 ngày trước",
    status: "active",
    stats: { buildings: 28, area: "5.1 km²", windSpeed: "2.8 m/s", aqi: 52 },
    tags: ["Wake Zone", "ABL"],
  },
  {
    id: "da-nang-coastal",
    name: "Đà Nẵng Coastal Zone",
    description:
      "Phân tích ảnh hưởng gió biển đến chất lượng không khí khu vực ven biển — AQI có trọng số theo phương pháp AQUIS Việt Nam.",
    location: "Quận Sơn Trà, Đà Nẵng",
    coordinates: { lat: 16.0678, lng: 108.2208 },
    lastModified: "3 ngày trước",
    status: "draft",
    stats: { buildings: 8, area: "1.8 km²", windSpeed: "5.1 m/s", aqi: 34 },
    tags: ["Coastal", "AQUIS"],
  },
  {
    id: "hanoi-west-lake",
    name: "Hà Nội — Khu vực Hồ Tây",
    description:
      "Nghiên cứu hiệu ứng đảo nhiệt đô thị khu vực Tây Hồ — mô phỏng thông gió tự nhiên cho các khu dân cư mới với ABL Profile V_H = V_ref × (H/δ)^a.",
    location: "Quận Tây Hồ, Hà Nội",
    coordinates: { lat: 21.0545, lng: 105.8194 },
    lastModified: "1 tuần trước",
    status: "completed",
    stats: { buildings: 35, area: "8.2 km²", windSpeed: "2.1 m/s", aqi: 78 },
    tags: ["UHI", "Ventilation"],
  },
  {
    id: "phu-quoc-resort",
    name: "Phú Quốc Eco Resort",
    description:
      "Thiết kế resort sinh thái ven biển — tận dụng gió mùa Tây Nam để tối ưu hóa thông gió tự nhiên, giảm 40% năng lượng làm mát.",
    location: "Dương Đông, Phú Quốc",
    coordinates: { lat: 10.2171, lng: 103.9583 },
    lastModified: "2 tuần trước",
    status: "completed",
    stats: { buildings: 16, area: "3.6 km²", windSpeed: "4.5 m/s", aqi: 22 },
    tags: ["Eco", "Natural Vent"],
  },
  {
    id: "binh-duong-industrial",
    name: "Bình Dương Industrial Park",
    description:
      "Mô phỏng phân tán ô nhiễm khu công nghiệp — sử dụng mô hình RANS và hệ số nhám địa hình để dự báo chất lượng không khí hạ lưu.",
    location: "TX. Dĩ An, Bình Dương",
    coordinates: { lat: 10.9087, lng: 106.7656 },
    lastModified: "3 tuần trước",
    status: "draft",
    stats: { buildings: 42, area: "12.4 km²", windSpeed: "1.9 m/s", aqi: 112 },
    tags: ["Industrial", "Pollution"],
  },
];

const statusConfig = {
  active: { label: "Đang hoạt động", dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/10" },
  draft: { label: "Bản nháp", dot: "bg-amber-400", text: "text-amber-400", bg: "bg-amber-500/10" },
  completed: { label: "Hoàn thành", dot: "bg-blue-400", text: "text-blue-400", bg: "bg-blue-500/10" },
};

type FilterType = "all" | "active" | "draft" | "completed";

export default function LandingPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const filteredProjects = useMemo(() => {
    return PROJECTS.filter((p) => {
      const matchSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
        `${p.coordinates.lat},${p.coordinates.lng}`.includes(searchQuery);
      const matchFilter = activeFilter === "all" || p.status === activeFilter;
      return matchSearch && matchFilter;
    });
  }, [searchQuery, activeFilter]);

  const totalBuildings = PROJECTS.reduce((s, p) => s + p.stats.buildings, 0);

  return (
    <div className="min-h-screen bg-[#050506]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#050506]/80 backdrop-blur-2xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/15 to-violet-500/10 border border-white/[0.08] flex items-center justify-center">
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
            <button className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[11px] text-white/30 font-medium hover:bg-white/[0.06] transition-all">
              <Sparkles className="w-3 h-3 text-cyan-400/60" strokeWidth={1.5} />
              AI Assistant
            </button>
            <button className="p-2.5 text-white/40 hover:text-white transition-colors relative">
              <Bell className="w-[18px] h-[18px]" strokeWidth={1.5} />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
            </button>
            <div className="h-5 w-px bg-white/[0.06]" />
            <div className="flex items-center gap-2.5 pl-1">
              <div className="hidden sm:block text-right">
                <p className="text-[12px] font-semibold text-white leading-none mb-0.5">Tonny</p>
                <p className="text-[9px] text-white/25 font-medium">Admin</p>
              </div>
              <div className="w-8 h-8 rounded-full border border-white/10 bg-gradient-to-br from-cyan-500/10 to-violet-500/10 flex items-center justify-center cursor-pointer hover:border-white/20 transition-colors">
                <User className="w-4 h-4 text-white/50" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section with Dynamic Background */}
      <section className="relative overflow-hidden pt-20 pb-16">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-radial from-cyan-500/[0.05] via-transparent to-transparent rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-radial from-violet-500/[0.04] via-transparent to-transparent rounded-full blur-[100px]" />
          
          {/* Grid Pattern Overlay */}
          <div className="absolute inset-0 opacity-[0.03]" 
               style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-8">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">
                AeroTwin Platform v1.2
              </span>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12 mb-12">
              <div className="flex-1">
                <h2 className="text-5xl md:text-[4.2rem] font-bold text-white tracking-tight leading-[1.05] mb-6">
                  Kiến tạo tương lai
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white/80 to-white/40">
                    đô thị bền vững.
                  </span>
                </h2>

                <p className="text-[17px] text-white/40 max-w-2xl leading-[1.7] font-medium">
                  Hệ thống Digital Twin đầu tiên tích hợp mô phỏng khí động học CFD 3D thời gian thực, 
                  ABL Profile chuẩn kỹ thuật và chỉ số chất lượng không khí AQUIS dành riêng cho các đô thị Việt Nam.
                </p>
              </div>

              <div className="lg:w-[480px] shrink-0">
                <div className="relative group">
                  <div className="absolute -inset-1.5 bg-gradient-to-r from-cyan-500 to-violet-600 rounded-[2rem] blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                  <div className="relative aspect-video rounded-[1.8rem] overflow-hidden border border-white/10 bg-black/40 backdrop-blur-sm shadow-2xl shadow-cyan-500/5">
                    <video 
                      src="/video.mp4" 
                      autoPlay 
                      loop 
                      muted 
                      playsInline 
                      className="w-full h-full object-cover opacity-80"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050506]/40 to-transparent pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mb-16">
              <Link href="/project/new" className="px-8 py-4 rounded-2xl bg-white text-black font-bold text-sm hover:bg-cyan-50 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-white/10 flex items-center gap-2">
                Bắt đầu dự án mới
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm hover:bg-white/10 transition-all">
                Xem tài liệu kỹ thuật
              </button>
            </div>
          </div>

          {/* Stats */}
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in-up"
            style={{ animationDelay: "0.15s" }}
          >
            {[
              { icon: Globe, value: String(PROJECTS.length), label: "Dự án số", accent: "from-cyan-500/20 to-cyan-500/5", glow: "group-hover:shadow-[0_0_40px_rgba(34,211,238,0.1)]" },
              { icon: Building2, value: String(totalBuildings), label: "Công trình 3D", accent: "from-violet-500/20 to-violet-500/5", glow: "group-hover:shadow-[0_0_40px_rgba(167,139,250,0.1)]" },
              { icon: Wind, value: "3D Physics", label: "Mô phỏng Gió", accent: "from-emerald-500/20 to-emerald-500/5", glow: "group-hover:shadow-[0_0_40px_rgba(52,211,153,0.1)]" },
              { icon: BarChart3, value: "AQUIS Engine", label: "AQI Phân tích", accent: "from-amber-500/20 to-amber-500/5", glow: "group-hover:shadow-[0_0_40px_rgba(251,191,36,0.1)]" },
            ].map(({ icon: Icon, value, label, accent, glow }) => (
              <div
                key={label}
                className={`group relative p-6 rounded-[2rem] bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1] transition-all duration-500 cursor-default overflow-hidden ${glow}`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
                <div className="relative z-10">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500">
                    <Icon className="w-5 h-5 text-white/40 group-hover:text-white transition-colors" strokeWidth={1.5} />
                  </div>
                  <p className="text-3xl font-bold text-white tracking-tight mb-1">{value}</p>
                  <p className="text-[11px] text-white/25 font-bold uppercase tracking-widest">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Projects */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        {/* Toolbar */}
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 animate-fade-in-up"
          style={{ animationDelay: "0.2s" }}
        >
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Tìm dự án, địa danh, tag, tọa độ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.05] text-sm text-white placeholder:text-white/15 outline-none focus:border-white/15 focus:bg-white/[0.05] transition-all duration-300"
              />
            </div>

            {/* Filters */}
            <div className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              {(["all", "active", "draft", "completed"] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                    activeFilter === f
                      ? "bg-white/10 text-white"
                      : "text-white/25 hover:text-white/50"
                  }`}
                >
                  {f === "all" ? "Tất cả" : statusConfig[f].label}
                </button>
              ))}
            </div>
          </div>

          <Link
            href="/project/new"
            className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-zinc-200 active:scale-[0.97] transition-all shadow-lg shadow-white/5"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            Tạo dự án mới
          </Link>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {filteredProjects.map((project) => {
            const status = statusConfig[project.status];
            return (
              <Link
                key={project.id}
                href={`/project/${project.id}`}
                className="group relative flex flex-col p-6 rounded-[2.5rem] bg-black/20 border border-white/[0.05] hover:border-white/[0.12] hover:bg-white/[0.01] transition-all duration-700 cursor-pointer overflow-hidden"
              >
                {/* Hover Glow Effect */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                {/* Header */}
                <div className="flex items-center justify-between mb-5 relative z-10">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/5 ${status.bg} backdrop-blur-md`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${status.dot} shadow-[0_0_8px_currentColor]`} />
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${status.text}`}>
                      {status.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/20">
                    <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{project.lastModified}</span>
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-white tracking-tight mb-2 group-hover:text-cyan-400 transition-colors leading-tight relative z-10">
                  {project.name}
                </h3>

                {/* Description */}
                <p className="text-[13px] text-white/30 leading-relaxed mb-6 line-clamp-2 flex-1 relative z-10 font-medium">
                  {project.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-6 relative z-10">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/[0.05] text-[9px] font-bold text-white/40 uppercase tracking-widest group-hover:text-white/60 transition-colors"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2 mb-6 relative z-10">
                  <div className="flex items-center gap-2 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.03]">
                    <Building2 className="w-3.5 h-3.5 text-white/10" strokeWidth={1.5} />
                    <span className="text-[11px] text-white/40 font-bold uppercase tracking-wider">
                      {project.stats.buildings} Units
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.03]">
                    <MapPin className="w-3.5 h-3.5 text-white/10" strokeWidth={1.5} />
                    <span className="text-[11px] text-white/40 font-bold uppercase tracking-wider">
                      {project.stats.area}
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-5 border-t border-white/[0.05] relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-500/20 border border-cyan-500/40 animate-pulse" />
                    <code className="text-[10px] text-white/15 font-mono tracking-wider font-medium">
                      {project.coordinates.lat.toFixed(4)}, {project.coordinates.lng.toFixed(4)}
                    </code>
                  </div>
                  <div className="flex items-center gap-2 text-white/20 group-hover:text-cyan-400 transition-all duration-300">
                    <span className="text-[11px] font-bold uppercase tracking-widest">Workspace</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" strokeWidth={2} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Empty */}
        {filteredProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mb-5">
              <Search className="w-7 h-7 text-white/10" strokeWidth={1} />
            </div>
            <p className="text-sm text-white/25 font-medium mb-1.5">
              Không tìm thấy dự án nào
            </p>
            <p className="text-xs text-white/12 max-w-sm">
              Thử tìm kiếm với từ khóa khác, thay đổi bộ lọc, hoặc tạo dự án mới
            </p>
          </div>
        )}
      </section>
      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-white/[0.04]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3 opacity-30 hover:opacity-100 transition-opacity">
            <Box className="w-4 h-4 text-white" strokeWidth={1.5} />
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">
              AeroTwin Studio © 2024
            </p>
          </div>
          
          <div className="flex items-center gap-8">
            <a href="#" className="text-[10px] font-bold text-white/20 hover:text-white/60 transition-colors uppercase tracking-widest">Documentation</a>
            <a href="#" className="text-[10px] font-bold text-white/20 hover:text-white/60 transition-colors uppercase tracking-widest">API Reference</a>
            <a href="#" className="text-[10px] font-bold text-white/20 hover:text-white/60 transition-colors uppercase tracking-widest">Support</a>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.05]">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
            <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">System Online</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
