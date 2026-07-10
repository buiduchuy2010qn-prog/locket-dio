import { CONFIG } from "@/config";
import { useTheme } from "@/hooks/useTheme";

const ThemeSelector = () => {
  const { theme, changeTheme } = useTheme();
  const labels = CONFIG.ui.themeLabels || {};

  return (
    <div className="w-full flex justify-center">
      <div className="w-full">
        <h1 className="font-lovehouse text-base-content text-center text-3xl font-semibold">
          Setting Theme
        </h1>
        <p className="text-center text-sm text-base-content/70 mb-2 px-2">
          Chọn <strong>Hồng tuyết ❄</strong> để bật nền hồng + tuyết rơi
        </p>

        <fieldset className="border rounded-2xl shadow-md w-full py-3">
          <legend className="font-semibold text-base-content text-lg text-left ml-5">
            🎨 Chọn Giao Diện:
          </legend>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto px-4 py-3">
            {CONFIG.ui.themes.map((t) => {
              const label = labels[t] || t;
              const isPinkSnow = t === "pinksnow";
              return (
              <label
                key={t}
                className={`flex flex-col items-center gap-2 p-2 rounded-lg shadow-sm transition-all duration-300
                  bg-base-100 hover:bg-base-300 
                  ${
                    theme === t
                      ? "outline-3 scale-80 outline-dotted outline-primary opacity-70 cursor-not-allowed"
                      : "cursor-pointer"
                  }
                  ${isPinkSnow ? "ring-2 ring-pink-300/80" : ""}
                `}
                data-theme={t}
              >
                <div
                  className={`grid grid-cols-5 grid-rows-3 w-30 h-12 rounded-lg overflow-hidden border border-gray-300 ${
                    isPinkSnow
                      ? "bg-gradient-to-b from-[#ff9ecf] via-[#ffcce6] to-[#ffe6f2]"
                      : ""
                  }`}
                >
                  <div className="bg-base-200 col-start-1 row-span-2 row-start-1"></div>
                  <div className="bg-base-300 col-start-1 row-start-3"></div>
                  <div className="bg-base-100/90 col-span-4 col-start-2 row-span-3 row-start-1 flex flex-col gap-1 p-1">
                    <div className="font-bold text-xs truncate w-full" title={label}>
                      {label}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <div className="bg-primary flex aspect-square w-3 items-center justify-center rounded">
                        <div className="text-primary-content text-xs font-bold">
                          A
                        </div>
                      </div>
                      <div className="bg-secondary flex aspect-square w-3 items-center justify-center rounded">
                        <div className="text-secondary-content text-xs font-bold">
                          A
                        </div>
                      </div>
                      <div className="bg-accent flex aspect-square w-3 items-center justify-center rounded">
                        <div className="text-accent-content text-xs font-bold">
                          A
                        </div>
                      </div>
                      <div className="bg-neutral flex aspect-square w-3 items-center justify-center rounded">
                        <div className="text-neutral-content text-xs font-bold">
                          A
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <input
                  type="radio"
                  name="theme-radios"
                  className="radio radio-sm hidden"
                  value={t}
                  checked={theme === t}
                  onChange={() => changeTheme(t)}
                />
              </label>
              );
            })}
          </div>
        </fieldset>
      </div>
    </div>
  );
};

export default ThemeSelector;
