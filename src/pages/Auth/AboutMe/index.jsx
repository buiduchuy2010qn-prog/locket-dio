import React from "react";
import { Code2, Mail, Globe } from "lucide-react";
import ImageMarquee from "@/components/ui/Marquee/LanguageMarquee";
import {
  FaReact,
  FaGithub,
  FaNodeJs,
} from "react-icons/fa";
import { RiTailwindCssFill, RiVercelFill } from "react-icons/ri";

const AboutMe = () => {
  return (
    <>
      {" "}
      <div className="min-h-screen flex flex-col items-center py-4">
        {/* Avatar + Name */}
        <div className="flex flex-col items-center mb-10 px-4">
          <img
            src="https://cdn.locket-dio.com/v1/images/avt/avtdio.webp"
            alt="Bùi Đức Huy"
            className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white shadow-lg mb-4"
            loading="lazy"
          />
          <h1 className="text-3xl md:text-4xl font-semibold text-center">
            Bùi Đức Huy
          </h1>
          <p className="text-lg md:text-xl mt-2">
            Quản trị web | Huy Locket
          </p>
        </div>

        {/* About */}
        <div className="max-w-3xl text-left mb-12 px-4">
          <p className="text-lg leading-relaxed">
            Mình là Bùi Đức Huy — vận hành và hỗ trợ bản web Huy Locket.
            Liên hệ hỗ trợ qua email bên dưới.
          </p>
        </div>

        {/* Skills */}
        <div className="w-full mb-5">
          <h2 className="text-2xl md:text-3xl font-semibold text-center mb-8 flex justify-center items-center gap-2">
            <Code2 className="w-6 h-6 md:w-8 md:h-8" /> Công nghệ sử dụng
          </h2>
          <div className="flex flex-wrap justify-center gap-6 text-sm md:text-lg">
            <div className="flex items-center gap-2">
              <FaReact className="w-6 h-6 text-cyan-500" /> React.js
            </div>
            <div className="flex items-center gap-2">
              <img src="/svg/vite.svg" className="w-6.5 h-6.5" /> Vite
            </div>
            <div className="flex items-center gap-2">
              <FaNodeJs className="w-6 h-6 text-green-500" /> Node.js
            </div>
            <div className="flex items-center gap-2">
              <img src="/svg/firebase.svg" className="w-6 h-6" /> Firebase
            </div>
            <div className="flex items-center gap-2">
              <FaGithub className="w-6 h-6 text-black" /> Github
            </div>
            <div className="flex items-center gap-2">
              <RiTailwindCssFill className="w-6 h-6 text-cyan-500" />{" "}
              TailwindCSS
            </div>
            <div className="flex items-center gap-2">
              <RiVercelFill className="w-6 h-6 text-black" /> Vercel
            </div>
            <div className="flex items-center gap-2">
              <img src="/svg/lucide.svg" /> Lucide Icons
            </div>
            <div className="flex items-center">
              <img src="/svg/daisyui.svg" className="w-8 h-8" /> DaisyUi
            </div>
          </div>
        </div>

        <ImageMarquee />

        {/* Contact */}
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-semibold mb-5 flex justify-center items-center gap-2">
            <Globe /> Liên hệ
          </h2>
          <div className="flex flex-col items-center gap-3">
            <a
              href="mailto:buiduchuy2010qn@gmail.com"
              className="flex items-center gap-2 text-lg transition hover:text-primary"
            >
              <Mail className="w-6 h-6" />
              buiduchuy2010qn@gmail.com
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default AboutMe;
