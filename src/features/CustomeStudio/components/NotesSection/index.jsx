import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const notes = [
  {
    labelKey: "custom_studio.notes.follow_updates",
    text: "Telegram",
    href: "https://t.me/nthuylocket",
    external: true,
  },
  {
    labelKey: "custom_studio.notes.join_community",
    text: "Discord",
    href: "https://discord.gg/47buy9nMGc",
    external: true,
  },
  {
    labelKey: "custom_studio.notes.join_community",
    text: "Messenger",
    href: "https://m.me/cm/AbYPtgRiGe2fInEf",
    external: true,
  },
  {
    labelKey: "custom_studio.notes.support_project",
    textKey: "custom_studio.notes.sponsor_page",
    href: "/sponsors",
    external: false,
  },
  {
    labelKey: "custom_studio.notes.source_code",
    text: "GitHub",
    href: "https://github.com/buiduchuy2010qn-prog/Client-Locket-Dio",
    external: true,
  },
];

const NotesSection = () => {
  const { t } = useTranslation("features");

  return (
    <div className="px-4">
      <h2 className="text-md font-semibold text-primary mb-3">
        {t("custom_studio.notes.title")}
      </h2>

      <div className="flex flex-wrap gap-4 text-base-content">
        {notes.map((item) => (
          <p key={item.href}>
            {t(item.labelKey)}{" "}
            {item.external ? (
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-semibold underline hover:text-primary-focus"
              >
                {item.textKey ? t(item.textKey) : item.text}
              </a>
            ) : (
              <Link
                to={item.href}
                className="text-primary font-semibold underline hover:text-primary-focus"
              >
                {item.textKey ? t(item.textKey) : item.text}
              </Link>
            )}
          </p>
        ))}
      </div>
    </div>
  );
};

export default NotesSection;
