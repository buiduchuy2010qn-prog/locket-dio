import React, { useState } from "react";
import LoadingRing from "@/components/uikit/Loading/ring";
import { getAllFriendDetails } from "@/cache/friendsDB";
import { SonnerWarning } from "@/components/uikit/SonnerToast";

export default function ExportDataTool() {
  const [exporting, setExporting] = useState(false);
  const [fetchProgress, setFetchProgress] = useState({
    current: 0,
    total: 0,
    isEstimating: true,
  });
  const [downloadUrl, setDownloadUrl] = useState(null);

  const [dataType, setDataType] = useState("");
  const [fileFormat, setFileFormat] = useState("csv");

  const handleExport = async () => {
    if (!dataType) {
      SonnerWarning("Vui lòng chọn loại dữ liệu trước khi trích xuất!");
      return;
    }

    setExporting(true);
    setDownloadUrl(null);

    // gọi API lấy danh sách bạn bè
    const friends = await getAllFriendDetails();

    // map dữ liệu chuẩn
    const formattedData = friends.map((f, idx) => ({
      stt: idx + 1,
      uid: f.uid,
      firstName: f.firstName,
      lastName: f.lastName,
      username: f.username,
      badge: f.badge,
      isCelebrity: f.isCelebrity,
      friendshipStatus: f.friendshipStatus,
      friendCount: f.celebrityData?.friend_count || null,
      profilePic: f.profilePic,
    }));

    // update tiến trình (fake)
    for (let i = 1; i <= 100; i++) {
      await new Promise((res) => setTimeout(res, 10));
      setFetchProgress({ current: i, total: 100, isEstimating: false });
    }

    let blob;
    if (fileFormat === "json") {
      blob = new Blob([JSON.stringify(formattedData, null, 2)], {
        type: "application/json",
      });
    } else if (fileFormat === "csv") {
      // convert sang CSV
      const header = Object.keys(formattedData[0]).join(",");
      const rows = formattedData.map((row) =>
        Object.values(row)
          .map((val) => `"${val ?? ""}"`)
          .join(",")
      );
      const csv = [header, ...rows].join("\n");
      blob = new Blob([csv], { type: "text/csv" });
    } else if (fileFormat === "xlsx") {
      // simple CSV giả lập Excel (cần thư viện xlsx nếu muốn chuẩn)
      const header = Object.keys(formattedData[0]).join("\t");
      const rows = formattedData.map((row) => Object.values(row).join("\t"));
      const tsv = [header, ...rows].join("\n");
      blob = new Blob([tsv], { type: "application/vnd.ms-excel" });
    }

    const url = URL.createObjectURL(blob);
    setDownloadUrl(url);

    setExporting(false);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">📤 Trích xuất dữ liệu</h2>
      <p>
        Công cụ này giúp bạn xuất dữ liệu bạn bè hoặc hơn thế để sao lưu hoặc phân tích.
      </p>

      <div className="mt-6 flex flex-col gap-5">
        {/* chọn loại dữ liệu */}
        <div>
          <label className="text-sm font-medium mb-1 block">
            Loại dữ liệu:
          </label>
          <select
            className="select select-bordered w-full"
            value={dataType}
            onChange={(e) => setDataType(e.target.value)}
          >
            <option value="" disabled>
              Chọn loại dữ liệu
            </option>
            <option value="friends_list">Danh sách bạn bè</option>
          </select>
        </div>

        {/* chọn định dạng */}
        <div>
          <label className="text-sm font-medium mb-1 block">
            Định dạng tệp:
          </label>
          <select
            className="select select-bordered w-full"
            value={fileFormat}
            onChange={(e) => setFileFormat(e.target.value)}
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
            <option value="xlsx">Excel (.xlsx)</option>
          </select>
        </div>

        <button
          onClick={handleExport}
          className="btn btn-primary w-full"
          disabled={exporting}
        >
          {exporting && <LoadingRing size={20} stroke={2} color="white" />}
          {exporting ? "Đang trích xuất..." : "📥 Bắt đầu trích xuất"}
        </button>

        {exporting && (
          <div className="bg-base-100 border rounded-lg p-4">
            <div className="text-sm mb-2">
              Đang xử lý: <strong>{fetchProgress.current}%</strong>
            </div>
            <div className="w-full bg-base-300 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-200"
                style={{
                  width: `${fetchProgress.current}%`,
                }}
              />
            </div>
          </div>
        )}

        {downloadUrl && (
          <a
            href={downloadUrl}
            download={`${dataType}.${fileFormat}`}
            className="btn btn-success w-full"
          >
            ⬇️ Tải xuống file {fileFormat.toUpperCase()}
          </a>
        )}
      </div>
    </div>
  );
}
