import { useState } from "react";
import LoadingRing from "@/components/uikit/Loading/ring";
import { Link } from "react-router-dom";
import {
  SonnerError,
  SonnerSuccess,
  SonnerWarning,
} from "@/components/uikit/SonnerToast";
import { forgotPassword, ValidateEmailAddress } from "@/services";
import { useTranslation } from "react-i18next";
import clsx from "clsx";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation("auth");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      SonnerWarning(t("forgot_password.toast.invalid_email"));
      return;
    }

    setLoading(true);
    try {
      const res = await ValidateEmailAddress(email);

      if (res?.result?.status === 601) {
        SonnerWarning(t("forgot_password.toast.account_not_found"));
        return;
      }

      await forgotPassword(email);

      SonnerSuccess(
        t("forgot_password.toast.success_title"),
        t("forgot_password.toast.success_desc"),
      );

      setEmail("");
    } catch (error) {
      console.log(error);
      SonnerError(t("forgot_password.toast.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-[84vh] px-6">
      <div className="w-full max-w-md p-6 shadow-lg rounded-3xl bg-opacity-50 backdrop-blur-3xl bg-base-100 border border-base-300 text-base-content">
        <h1 className="text-3xl font-bold text-center mb-2">
          {t("forgot_password.title")}
        </h1>
        <p className="text-center text-sm text-base-content/80 mb-6">
          {t("forgot_password.description")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              {t("forgot_password.email.label")}
            </label>
            <input
              type="email"
              className="w-full text-base px-4 rounded-xl py-5.5 bg-base-300 input input-ghost shadow-md placeholder:font-normal placeholder:italic placeholder:opacity-70"
              placeholder={t("forgot_password.email.placeholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={clsx(
              "w-full btn btn-primary py-6 text-lg font-semibold rounded-3xl transition flex items-center justify-center gap-2",
              {
                "opacity-70 cursor-not-allowed": loading,
              },
            )}
          >
            {loading ? (
              <>
                <LoadingRing size={20} stroke={3} speed={2} color="white" />
                {t("forgot_password.button.sending")}
              </>
            ) : (
              t("forgot_password.button.submit")
            )}
          </button>

          <div className="text-center mt-3 text-xs text-base-content/70">
            {t("forgot_password.hint")}
          </div>

          <div className="text-center mt-4">
            <Link
              to={"/login"}
              className="text-sm text-blue-500 hover:underline transition"
            >
              {t("forgot_password.back_to_login")}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
