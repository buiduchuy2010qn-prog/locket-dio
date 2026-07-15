import { useState, useEffect } from "react";
import LoadingRing from "@/components/uikit/Loading/ring";
import { Link } from "react-router-dom";
import { SonnerError, SonnerPromise } from "@/components/uikit/SonnerToast";
import { CONFIG } from "@/config";
import RotatingCircleText from "./RotatingCircleText";
import { ensureDBOwner } from "@/cache/configDB";
import { useAuthStore } from "@/stores";
import TurnstileCaptcha from "./TurnstileCaptcha";
import { Mail, Phone } from "lucide-react";
import { loginWithEmail, loginWithPhone } from "@/services";
import { PhoneInput } from "./PhoneInput";
import StatusServer from "./StatusServer";
import { saveToken } from "@/utils";
import { useTranslation } from "react-i18next";
import clsx from "clsx";

const Login = () => {
  const initAuth = useAuthStore((s) => s.initAuth);
  const hydrateAuth = useAuthStore((s) => s.hydrateAuth);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [loginMethod, setLoginMethod] = useState("email"); // "email" hoặc "phone"
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    const stored = localStorage.getItem("rememberMe");
    return stored === null ? true : stored === "true";
  });

  const { t } = useTranslation("auth");

  const [isStatusServer, setIsStatusServer] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  useEffect(() => {
    if (rememberMe) {
      localStorage.setItem("rememberMe", "true");
    } else {
      localStorage.removeItem("rememberMe");
    }
  }, [rememberMe]);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (CONFIG.keys.turnstileKey && !captchaToken) {
      SonnerError(t("login.captcha.required"));
      return;
    }

    if (loginMethod === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(identifier)) {
        SonnerError(t("login.validation.invalid_email"));
        return;
      }
    } else {
      const phoneRegex = /^\+[1-9]\d{6,14}$/;
      if (!phoneRegex.test(identifier)) {
        SonnerError(t("login.validation.invalid_phone"));
        return;
      }
    }

    setIsLoginLoading(true);

    try {
      const loginPromise = (async () => {
        const res =
          loginMethod === "email"
            ? await loginWithEmail({
                email: identifier,
                password,
                captchaToken,
              })
            : await loginWithPhone({
                phone: identifier,
                password,
                captchaToken,
              });

        if (!res?.data) throw new Error(t("login.toast.no_response"));

        const { idToken, localId, refreshToken } = res.data;

        saveToken({ idToken, localId, refreshToken }, rememberMe);

        await ensureDBOwner(localId);

        initAuth();
        hydrateAuth();

        return res.data;
      })();

      SonnerPromise(loginPromise, {
        loading: t("login.toast.loading"),
        success: (data) =>
          t("login.toast.welcome", {
            name: data?.displayName || t("login.toast.welcome_default"),
          }),
        error: (error) => {
          const status = error?.status || error?.response?.status;

          switch (status) {
            case 400:
              return t("login.toast.invalid_credentials");
            case 401:
              return t("login.toast.session_expired");
            case 429:
              return t("login.toast.too_many_requests");
            case 403:
              window.location.href = "/login";
              return t("login.toast.forbidden");
            case 500:
              return t("login.toast.server_error");
            default:
              return error?.message || t("login.toast.network_error");
          }
        },
      });

      await loginPromise;
    } finally {
      setIsLoginLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleLoginMethod = () => {
    setLoginMethod(loginMethod === "email" ? "phone" : "email");
    setIdentifier("");
    setPassword("");
  };

  const isActiveLogin =
    isStatusServer !== true ||
    isLoginLoading ||
    (CONFIG.keys.turnstileKey && !captchaToken);

  return (
    <>
      <div className="flex items-center justify-center h-[84vh] px-6">
        <div className="relative w-full max-w-md p-6 shadow-lg overflow-hidden rounded-3xl backdrop-blur-3xl bg-base-100 border-base-300 text-base-content">
          <RotatingCircleText />
          <h1 className="text-3xl font-bold text-center mb-6">
            {t("login.title")}
          </h1>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Input Email hoặc SĐT */}
            <div className="space-y-1">
              <label className="label flex gap-1 items-center">
                {loginMethod === "email"
                  ? t("login.identifier.email")
                  : t("login.identifier.phone")}
                <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                {loginMethod === "email" ? (
                  <input
                    type={"email"}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={"example@email.com"}
                    required
                    className="w-full input input-ghost rounded-xl py-5.5 bg-base-300 transition text-base font-semibold placeholder:font-normal placeholder:italic placeholder:opacity-70 shadow-md"
                  />
                ) : (
                  <PhoneInput phone={identifier} onChange={setIdentifier} />
                )}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={toggleLoginMethod}
                  className="text-xs text-base-content opacity-80 hover:opacity-100 underline inline-flex items-center gap-1"
                >
                  {loginMethod === "email" ? (
                    <>
                      <Phone className="w-4 h-4" />
                      {t("login.switch.phone")}
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      {t("login.switch.email")}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Input Mật khẩu */}
            <div className="space-y-1">
              <label className="label flex gap-1 items-center">
                {t("login.password.label")}
                <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full input input-ghost rounded-xl py-5.5 font-semibold text-base bg-base-300 placeholder:font-normal placeholder:italic placeholder:opacity-70 shadow-md"
                  placeholder={t("login.password.placeholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute top-1/2 z-10 right-3 transform -translate-y-1/2 text-base-content opacity-70 hover:opacity-100 transition-opacity"
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 11-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.639 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.639 0-8.573-3.007-9.963-7.178z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  )}
                </button>
              </div>
              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className="text-xs tracking-wide opacity-80 hover:opacity-100 underline"
                >
                  {t("login.password.forgot")}
                </Link>
              </div>
            </div>

            {/* Remember me & Forgot password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  id="rememberMe"
                  type="checkbox"
                  disabled
                  className="checkbox checkbox-primary checkbox-sm"
                  checked={rememberMe}
                  onChange={() => setRememberMe(!rememberMe)}
                />
                <label
                  htmlFor="rememberMe"
                  className="cursor-pointer select-none text-sm"
                >
                  {t("login.remember_me")}
                </label>
              </div>
            </div>

            {/* Button đăng nhập */}
            <button
              type="submit"
              className={clsx(
                "w-full btn btn-primary py-6 text-lg font-semibold rounded-3xl transition flex items-center justify-center gap-2",
                {
                  "cursor-not-allowed": isActiveLogin,
                },
              )}
              disabled={isActiveLogin}
            >
              {isLoginLoading ? (
                <>
                  <LoadingRing size={20} stroke={3} speed={2} color="white" />
                  {t("login.loading.login")}
                </>
              ) : (
                <>{t("login.button.submit")}</>
              )}
            </button>

            <TurnstileCaptcha onVerify={setCaptchaToken} />

            <span className="text-xs">{t("login.server.starting")}</span>
            <StatusServer
              isStatusServer={isStatusServer}
              setIsStatusServer={setIsStatusServer}
            />
          </form>
        </div>
      </div>
    </>
  );
};

export default Login;
