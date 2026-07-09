import { CONFIG } from "@/config/webConfig";

const BANK_BIN = CONFIG.app.bankInfo?.bankBin || "970422";
const ACCOUNT = CONFIG.app.bankInfo?.accountNumber || "0394709137";
const ACCOUNT_NAME = CONFIG.app.bankInfo?.accountName || "BUI DUC HUY";

export default function VietQRImage({ description, amount }) {
  if (!description || !amount) return null;

  const src = `https://img.vietqr.io/image/${BANK_BIN}-${ACCOUNT}-compact2.png?accountName=${encodeURIComponent(
    ACCOUNT_NAME
  )}&addInfo=${encodeURIComponent(description)}&amount=${amount}`;

  return (
    <div className="flex flex-col items-center space-y-2">
      <img
        className="max-w-[80%] object-contain cursor-pointer rounded-lg"
        src={src}
        alt="QR chuyển khoản MBBank"
        loading="lazy"
        decoding="async"
      />
      <p className="text-sm text-gray-500">Quét mã để thanh toán</p>
      <p className="text-xs text-base-content/70">
        {ACCOUNT} · {ACCOUNT_NAME} · MBBank
      </p>
    </div>
  );
}
