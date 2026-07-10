import "./header.css";
import { Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";

const Header = () => {
  const { navigation } = useApp();

  const { setIsSidebarOpen } = navigation;

  return (
    <>
      <header
        className="sticky top-0 shadow-md bg-base-100 navbar flex items-center justify-between px-6 py-3 text-base-content border-base-300"
        style={{ zIndex: 50 }}
      >
        <Link to="/" className="flex items-center gap-2" aria-label="Trang chủ">
          <span className="font-semibold gradient-text select-none">
            Huy Locket
          </span>
          <img
            src="/images/locket-dio.png"
            alt="Huy Locket icon"
            className="w-7 h-7 object-contain -ml-1 select-none pointer-events-none"
            draggable="false"
          />
        </Link>

        <div className="flex items-center gap-2 relative" style={{ zIndex: 51 }}>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 rounded-md transition cursor-pointer btn relative"
            style={{ zIndex: 51, pointerEvents: "auto" }}
            aria-label="Mở menu"
          >
            <Menu size={28} strokeWidth={2} />
          </button>
        </div>
      </header>
    </>
  );
};

export default Header;
