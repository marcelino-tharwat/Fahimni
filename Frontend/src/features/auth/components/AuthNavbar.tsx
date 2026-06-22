import { useTranslation } from "react-i18next";
import { GraduationCap, Languages } from "lucide-react";

export function AuthNavbar() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar");
  };

  const label = i18n.language === "ar" ? "English" : "العربية";

  return (
    <nav
      dir="ltr"
      className="flex w-full items-center justify-between border-b border-gray-100 bg-white px-8 py-4 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <GraduationCap className="h-6 w-6 text-cyan-500" />
        <span className="font-cairo text-xl font-bold text-navy-900">
          Fahimni
        </span>
      </div>

      <button
        type="button"
        onClick={toggleLanguage}
        className="flex items-center gap-2 rounded-btn border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
      >
        <Languages className="h-4 w-4 text-cyan-500" />
        <span>{label}</span>
      </button>
    </nav>
  );
}
