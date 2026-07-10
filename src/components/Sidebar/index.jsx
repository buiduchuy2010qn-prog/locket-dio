import React, { useContext, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import {
  X,
  Home,
  Upload,
  Smartphone,
  Rocket,
  Info,
  ShieldCheck,
  Wrench,
  BookText,
  UserCircle,
  Clock,
  Bug,
  Settings,
  Palette,
  UserRound,
  LifeBuoy,
  Package,
  SquareArrowOutUpRight,
  Heart,
  Newspaper,
  HardDrive,
} from "lucide-react";
import * as ultils from "@/utils";
import { useApp } from "@/context/AppContext";
import { AuthContext } from "@/context/AuthLocket";
import api from "@/lib/axios";
import { MenuItem } from "./MenuItem";
import { AuthButton } from "./AuthButton";
import ThemeToggle from "./ThemeToggle";
import PlanBadge from "../ui/PlanBadge/PlanBadge";
import { SonnerError, SonnerSuccess } from "../ui/SonnerToast";
import { clearAllData } from "@/utils/SyncData/clearAllData";
import { isAdminUser } from "@/utils/googleDrive";
import { getMyLocalId } from "@/utils/auth/getMyLocalId";

const Sidebar = () => {
  const { user, authTokens, resetAuthContext } = useContext(AuthContext);
  const navigate = useNavigate();
  const { navigation } = useApp();
  const { isSidebarOpen, setIsSidebarOpen } = navigation;

  const myId = getMyLocalId(user, authTokens);
  const email =
    user?.email ||
    localStorage.getItem("email") ||
    sessionStorage.getItem("email") ||
    "";
  const isAdmin = isAdminUser(myId, { ...user, email, localId: myId });

  useEffect(() => {
    document.body.classList.toggle("overflow-hidden", isSidebarOpen);
    return () => document.body.classList.remove("overflow-hidden");
  }, [isSidebarOpen]);

  const handleLogout = async () => {
    try {
      api.get(`${ultils.API_URL.LOGOUT_URL}`);
      resetAuthContext();
      await clearAllData();
      SonnerSuccess(
        "Đăng xuất thành công!",
        `Tạm biệt ${user?.displayName || "người dùng"}!`
      );
      navigate("/login");
    } catch (error) {
      SonnerError("error", "Đăng xuất thất bại!");
      console.error("❌ Lỗi khi đăng xuất:", error);
    }
  };

  // Menu chia theo nhóm
  const userMenuSections = useMemo(() => {
    const sections = [];

    // Google Drive — đầu menu, dễ tìm
    if (user) {
      sections.push({
        title: "⚡ Google Drive",
        items: [
          {
            to: "/admin/google-drive",
            icon: HardDrive,
            text: isAdmin ? "Quản lý Drive (Admin)" : "Google Drive",
            badge: isAdmin ? "Admin" : null,
          },
          {
            to: "/settings",
            icon: Settings,
            text: "Cài đặt web",
          },
        ],
      });
    }

    sections.push(
      {
        title: "Huy Locket",
        items: [
          { to: "/home", icon: Home, text: "Trang chủ" },
          { to: "/about", icon: Info, text: "Huy Locket" },
          { to: "/newsfeed", icon: Newspaper, text: "Bảng tin", badge: "New" },
          {
            to: "/download",
            icon: SquareArrowOutUpRight,
            text: "Cài đặt WebApp",
          },
          { to: "/sponsors", icon: Heart, text: "Ủng hộ dự án" },
        ],
      },
      {
        title: "Tính năng",
        badge: <PlanBadge />,
        items: [
          { to: "/postmoments", icon: Upload, text: "Đăng ảnh, video" },
          {
            to: "/locket-beta",
            icon: Smartphone,
            text: "Locket Camera",
            badge: "Beta",
          },
          { to: "/manage", icon: Palette, text: "Quản lý Caption" },
          { to: "/tools", icon: Wrench, text: "Công cụ Locket" },
          {
            to: "/pricing",
            icon: Rocket,
            text: "Gói thành viên",
            badge: "Hot",
          },
          { to: "/profile", icon: UserRound, text: "Hồ sơ của bạn" },
        ],
      },
      {
        title: "Hệ thống & Hỗ trợ",
        items: [
          { to: "/incidents", icon: Bug, text: "Trung tâm sự cố" },
          { to: "/contact", icon: LifeBuoy, text: "Liên hệ & Hỗ trợ" },
          { to: "/privacy", icon: ShieldCheck, text: "Chính sách bảo mật" },
        ],
      }
    );

    return sections;
  }, [user, isAdmin]);

  const guestMenuSections = [
    {
      title: "Huy Locket",
      items: [
        { to: "/", icon: Home, text: "Trang chủ" },
        { to: "/about", icon: Info, text: "Huy Locket" },
        { to: "/about-dio", icon: UserCircle, text: "Về Dio" },
        { to: "/newsfeed", icon: Newspaper, text: "Bảng tin", badge: "New" },
        { to: "/download", icon: SquareArrowOutUpRight, text: "Cài đặt WebApp"},
      ],
    },
    {
      title: "Tài nguyên",
      items: [
        { to: "/pricing", icon: Rocket, text: "Gói thành viên", badge: "New" },
        { to: "/collection", icon: Package, text: "Thư viện phiên bản" },
        { to: "/sponsors", icon: Heart, text: "Ủng hộ dự án" },
        { to: "/timeline", icon: Clock, text: "Lịch sử Website" },
        { to: "/docs", icon: BookText, text: "Tài liệu" },
      ],
    },
    {
      title: "Hệ thống & Hỗ trợ",
      items: [
        // { to: "/devpage", icon: Code2, text: "Trang lập trình", badge: "New" },
        { to: "/incidents", icon: Bug, text: "Trung tâm sự cố" },
        { to: "/contact", icon: LifeBuoy, text: "Liên hệ & Hỗ trợ" },
        { to: "/privacy", icon: ShieldCheck, text: "Chính sách bảo mật" },
        { to: "/settings", icon: Settings, text: "Cài đặt" },
      ],
    },
  ];

  const menuSections = user ? userMenuSections : guestMenuSections;

  // Portal ra body — tránh bị .locket-shell / tuyết đè z-index
  const panel = (
    <>
      {/* Overlay — trên tuyết (z-20), dưới vẫn bấm được menu */}
      <div
        className={`fixed inset-0 h-screen bg-base-100/20 backdrop-blur-[2px] transition-opacity duration-300 ${
          isSidebarOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        style={{ zIndex: 100 }}
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden={!isSidebarOpen}
      />

      {/* Sidebar panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`fixed top-0 right-0 h-full w-64 max-w-[85vw] shadow-xl transition-transform duration-300 bg-base-100 flex flex-col ${
          isSidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ zIndex: 110 }}
      >
        {/* Header */}
        <div className="flex justify-between items-center py-3 px-2 border-b border-base-300 flex-shrink-0">
          <Link
            to="/"
            className="flex items-center gap-1"
            onClick={() => setIsSidebarOpen(false)}
          >
            <span className="text-lg pl-2 font-semibold gradient-text select-none">
              Menu
            </span>
          </Link>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 rounded-md transition cursor-pointer btn"
            aria-label="Đóng menu"
          >
            <X size={24} />
          </button>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto">
          <ul className="menu text-base-content w-full py-2 text-md font-semibold">
            {menuSections.map((section) => (
              <li key={section.title}>
                <h2 className="menu-title flex items-center justify-between">
                  <span>{section.title}</span>
                  {section.badge && <div>{section.badge}</div>}
                </h2>
                <ul>
                  {section.items.map((item) => (
                    <MenuItem
                      key={item.to}
                      to={item.to}
                      icon={item.icon}
                      badge={item.badge}
                      onClick={() => setIsSidebarOpen(false)}
                    >
                      {item.text}
                    </MenuItem>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>

        {/* Auth Button */}
        <AuthButton
          user={user}
          onLogout={handleLogout}
          onClose={() => setIsSidebarOpen(false)}
        />

        <div>
          <p className="text-center text-xs pb-2 text-base-content/70">
            © {new Date().getFullYear()}{" "}
            <span className="font-semibold font-lovehouse">Bùi Đức Huy</span>. All
            rights reserved.
          </p>
        </div>
      </div>
    </>
  );

  if (typeof document === "undefined") return null;
  return createPortal(panel, document.body);
};

export default Sidebar;
