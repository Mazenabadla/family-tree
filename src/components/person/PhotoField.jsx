import { useRef } from "react";

// رفع صورة: بتتقص مربع وتتصغر لـ 256 بكسل، وتتحفظ كـ JPEG خفيف
export default function PhotoField({ value, name, onChange }) {
  const inputRef = useRef(null);

  const pick = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const S = 256;
      const canvas = document.createElement("canvas");
      canvas.width = S;
      canvas.height = S;
      const ctx = canvas.getContext("2d");
      const m = Math.min(img.width, img.height);
      const sx = (img.width - m) / 2;
      const sy = (img.height - m) / 2;
      ctx.drawImage(img, sx, sy, m, m, 0, 0, S, S);
      onChange(canvas.toDataURL("image/jpeg", 0.85));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="pf-photo">
      <div className="pf-photo__preview">
        {value ? (
          <img src={value} alt={name || "صورة الشخص"} />
        ) : (
          <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
            <circle cx="32" cy="24" r="11" fill="currentColor" />
            <path d="M11 58c2-13 10-19 21-19s19 6 21 19z" fill="currentColor" />
          </svg>
        )}
      </div>

      <div className="pf-photo__actions">
        <button type="button" className="pf-add" onClick={() => inputRef.current?.click()}>
          {value ? "تغيير الصورة" : "رفع صورة"}
        </button>
        {value && (
          <button type="button" className="pf-add pf-add--danger" onClick={() => onChange("")}>
            حذف الصورة
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}