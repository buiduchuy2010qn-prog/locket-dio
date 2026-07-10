import React from "react";
import { listWeeksOfYear } from "@/utils";
import { useTranslation } from "react-i18next";

function WeekNavigator({ year, week, onChange }) {
  const { t } = useTranslation("main");
  const weeks = listWeeksOfYear(year);

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm opacity-70">{t("left.week")}</label>

      <select
        value={week}
        onChange={(e) => onChange(Number(e.target.value), year)}
        className="select select-bordered"
      >
        {weeks.map((w) => (
          <option key={w.week} value={w.week}>
            {t("left.week_option", { week: w.week, label: w.label })}
          </option>
        ))}
      </select>
    </div>
  );
}

export default WeekNavigator;
