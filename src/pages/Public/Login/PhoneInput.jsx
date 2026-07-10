import { COUNTRY_BY_CALLING_CODE } from "@/constants/phoneCodeMap";
import clsx from "clsx";
import { useEffect, useState } from "react";

const formatPhone = (value) => {
  if (!value.startsWith("+")) return value;

  const digits = value.slice(1);
  let countryCode = "";

  for (let len = 4; len >= 1; len--) {
    const code = digits.slice(0, len);
    if (COUNTRY_BY_CALLING_CODE[code]) {
      countryCode = code;
      break;
    }
  }

  if (!countryCode) return value;

  const rest = digits.slice(countryCode.length);
  const grouped = rest.match(/.{1,3}/g)?.join(" ") ?? "";

  return `+${countryCode}${grouped ? " " + grouped : ""}`;
};

export const PhoneInput = ({ value = "", onChange }) => {
  const [inner, setInner] = useState(value);
  const [flag, setFlag] = useState("🇻🇳");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    setInner(value);
  }, [value]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 300);
  };

  const handleChange = (input) => {
    let raw = input.replace(/[^0-9+]/g, "");

    if (!raw) {
      setInner("");
      setFlag("🇻🇳");
      onChange?.("");
      return;
    }

    if (!raw.startsWith("+")) {
      raw = raw.startsWith("0") ? "+84" + raw.slice(1) : "+" + raw;
    }

    const digits = raw.slice(1);
    let detectedCountry = null;

    for (let len = 4; len >= 1; len--) {
      const code = digits.slice(0, len);
      if (COUNTRY_BY_CALLING_CODE[code]) {
        detectedCountry = { code, ...COUNTRY_BY_CALLING_CODE[code] };
        setFlag(COUNTRY_BY_CALLING_CODE[code].flag);
        break;
      }
    }

    if (detectedCountry) {
      const localDigits = digits.slice(detectedCountry.code.length);

      if (
        detectedCountry.maxLength &&
        localDigits.length > detectedCountry.maxLength
      ) {
        triggerShake();
        return; // ❌ chặn nhập thêm
      }
    }

    setInner(formatPhone(raw));
    onChange?.(raw);
  };

  return (
    <div className={clsx("relative", { "animate-shake": shake })}>
      <span className="absolute left-3 top-1/2 z-10 -translate-y-1/2">
        {flag}
      </span>

      <input
        type="tel"
        value={inner}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="+84 912 345 678"
        className={clsx(
          "w-full pl-10 input input-ghost rounded-xl py-5.5 bg-base-300 text-base font-semibold placeholder:font-normal placeholder:italic placeholder:opacity-70 shadow-md",
          {
            "input-error text-error": shake,
          },
        )}
      />
    </div>
  );
};
