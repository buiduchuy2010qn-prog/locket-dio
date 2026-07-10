import { useEffect, useState } from "react";
import { Check, Loader2, Circle } from "lucide-react";
import { useTranslation } from "react-i18next";

const stepKeys = [
  "crop_image.loading_steps.read_image",
  "crop_image.loading_steps.uploading",
  "crop_image.loading_steps.converting",
];

const CropLoading = () => {
  const { t } = useTranslation("features");
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setCurrentStep(1), 1200);
    const t2 = setTimeout(() => setCurrentStep(2), 2500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-base-100 shadow-xl p-8">
        <div className="flex flex-col items-center text-center">
          {/* <span className="loading loading-spinner loading-xl mb-5" /> */}

          <h2 className="text-xl font-semibold">{t("crop_image.preparing_image")}</h2>

          <p
            className="text-sm text-base-content/70 mt-2"
            dangerouslySetInnerHTML={{ __html: t("crop_image.preparing_desc") }}
          />
        </div>

        <div className="mt-8 space-y-5">
          {stepKeys.map((stepKey, index) => {
            const done = index < currentStep;
            const active = index === currentStep;

            return (
              <div key={stepKey} className="flex items-center gap-3">
                {done ? (
                  <Check size={18} className="text-success shrink-0" />
                ) : active ? (
                  <Loader2
                    size={18}
                    className="animate-spin text-primary shrink-0"
                  />
                ) : (
                  <Circle size={18} className="text-base-content/30 shrink-0" />
                )}

                <span
                  className={
                    done
                      ? "text-success"
                      : active
                        ? "font-medium text-base-content"
                        : "text-base-content/50"
                  }
                >
                  {t(stepKey)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="divider my-2" />

        <p className="text-xs text-center text-base-content/60">
          {t("crop_image.do_not_close")}
        </p>
      </div>
    </div>
  );
};

export default CropLoading;
