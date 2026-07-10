import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const NotFoundPage = () => {
  const { t } = useTranslation("public");

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center z-50 bg-base-100 text-base-content">
      <div className="text-center px-8 rounded-lg max-w-md w-full">
        <h1 className="text-6xl font-extrabold text-primary">404</h1>

        <p className="mt-4 text-xl font-medium">{t("not_found.title")}</p>

        <p className="mt-2">{t("not_found.description")}</p>

        <div className="mt-6">
          <Link to="/" className="px-6 py-3 btn btn-info text-lg font-semibold">
            {t("not_found.go_home")}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
