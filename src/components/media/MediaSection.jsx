import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { putFile, getFile, deleteFile } from "../../lib/storage";
import "./MediaSection.scss";

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = "image/*,audio/*,video/*,application/pdf,.doc,.docx,.txt";

const TABS = [
  { key: "all", label: "الكل" },
  { key: "image", label: "الصور" },
  { key: "document", label: "الوثائق" },
  { key: "av", label: "الصوت والفيديو" },
];

const KIND_LABEL = { image: "صورة", document: "وثيقة", audio: "تسجيل صوتي", video: "فيديو", link: "رابط" };
const KIND_GLYPH = { document: "وثيقة", audio: "صوت", video: "فيديو", link: "رابط" };

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const kindOf = (file) => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  return "document";
};

const formatSize = (bytes) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} كيلوبايت`
    : `${(bytes / 1024 / 1024).toFixed(1)} ميغابايت`;

const saveErrorText = (err) =>
  err?.name === "QuotaExceededError"
    ? "المساحة ممتلئة. صدّر نسخة احتياطية ثم احذف ملفات غير ضرورية."
    : "تعذر حفظ الملف في هذا المتصفح.";

// يحمّل الملف من التخزين عند الحاجة فقط، ويحرر الرابط المؤقت عند الخروج
function useFileUrl(fileId, enabled = true) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!fileId || !enabled) return undefined;
    let alive = true;
    let created = null;
    getFile(fileId)
      .then((blob) => {
        if (blob && alive) {
          created = URL.createObjectURL(blob);
          setUrl(created);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [fileId, enabled]);
  return url;
}

function MediaThumb({ item }) {
  const url = useFileUrl(item.fileId, item.kind === "image");
  if (item.kind === "image" && url) {
    return <img src={url} alt={item.title} loading="lazy" />;
  }
  return <span className="media-thumb__glyph" aria-hidden="true">{KIND_GLYPH[item.kind] || KIND_LABEL[item.kind]}</span>;
}

// عارض الملف: صورة كبيرة، أو مشغّل صوت وفيديو، أو معاينة PDF، أو رابط خارجي
function MediaViewer({ item, onClose }) {
  const url = useFileUrl(item.fileId);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isPdf = item.mime === "application/pdf";

  return createPortal(
    <div className="media-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="media-viewer" role="dialog" aria-modal="true" aria-label={item.title}>
        <header className="media-viewer__head">
          <div>
            <h3>{item.title}</h3>
            <small>{KIND_LABEL[item.kind]}{item.date ? ` · ${item.date}` : ""}</small>
          </div>
          <button type="button" className="media-btn" onClick={onClose} aria-label="إغلاق">×</button>
        </header>

        <div className="media-viewer__body">
          {item.kind === "link" && (
            <a className="media-btn media-btn--primary" href={item.url} target="_blank" rel="noopener noreferrer">
              فتح الرابط في صفحة جديدة
            </a>
          )}
          {item.kind !== "link" && !url && <p className="media-muted">جارٍ تحميل الملف…</p>}
          {url && item.kind === "image" && <img className="media-viewer__img" src={url} alt={item.title} />}
          {url && item.kind === "audio" && <audio controls src={url} className="media-viewer__av" />}
          {url && item.kind === "video" && <video controls src={url} className="media-viewer__av" />}
          {url && item.kind === "document" && isPdf && (
            <iframe className="media-viewer__frame" src={url} title={item.title} />
          )}
          {url && item.kind === "document" && !isPdf && (
            <p className="media-muted">معاينة هذا النوع غير متاحة. يمكنك تنزيل الملف لفتحه.</p>
          )}
        </div>

        {item.description && <p className="media-viewer__desc">{item.description}</p>}

        {url && item.kind !== "link" && (
          <footer className="media-viewer__foot">
            <a className="media-btn" href={url} download={item.fileName || item.title}>
              تنزيل الملف
            </a>
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
}

// نموذج إضافة أو تعديل وسيط. التعديل لا يغيّر الملف نفسه، فقط بياناته
function MediaForm({ initial, isEdit, onSubmit, onCancel }) {
  const [type, setType] = useState(initial?.kind === "link" ? "link" : "file");
  const [title, setTitle] = useState(initial?.title || "");
  const [date, setDate] = useState(initial?.date || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [url, setUrl] = useState(initial?.url || "");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    setError("");
    if (type === "link") {
      if (!/^https?:\/\//i.test(url.trim())) {
        setError("الرابط يجب أن يبدأ بـ http أو https");
        return;
      }
      onSubmit({ title: title.trim(), date: date.trim(), description: description.trim(), url: url.trim() });
      return;
    }
    if (!isEdit && !file) {
      setError("اختر ملفاً أولاً");
      return;
    }
    if (file && file.size > MAX_BYTES) {
      setError("حجم الملف أكبر من 25 ميغابايت");
      return;
    }
    onSubmit({ title: title.trim(), date: date.trim(), description: description.trim(), file });
  };

  return (
    <form className="media-form" onSubmit={submit}>
      <h4>{isEdit ? "تعديل بيانات الوسيط" : "إضافة وسيط"}</h4>

      {!isEdit && (
        <div className="media-form__types" role="radiogroup" aria-label="نوع الإضافة">
          {[["file", "ملف من الجهاز"], ["link", "رابط"]].map(([v, l]) => (
            <label key={v} className={`media-chip${type === v ? " is-on" : ""}`}>
              <input type="radio" name="media-type" hidden checked={type === v} onChange={() => setType(v)} />
              {l}
            </label>
          ))}
        </div>
      )}

      {type === "file" && !isEdit && (
        <label className="media-field">
          <span>الملف</span>
          <input type="file" accept={ALLOWED} onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <small className="media-muted">صورة، PDF، مستند، تسجيل صوتي، أو فيديو. الحد 25 ميغابايت.</small>
        </label>
      )}

      {type === "link" && (
        <label className="media-field">
          <span>الرابط</span>
          <input dir="ltr" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
        </label>
      )}

      <label className="media-field">
        <span>العنوان</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: صورة العيد عام ١٩٧٠" />
      </label>

      <label className="media-field">
        <span>التاريخ التقريبي</span>
        <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="مثال: ١٩٧٠ أو الصيف الماضي" />
      </label>

      <label className="media-field">
        <span>وصف مختصر</span>
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      {error && <p className="media-error" role="alert">{error}</p>}

      <div className="media-form__actions">
        <button type="submit" className="media-btn media-btn--primary">{isEdit ? "حفظ" : "إضافة"}</button>
        <button type="button" className="media-btn" onClick={onCancel}>إلغاء</button>
      </div>
    </form>
  );
}

// قسم الوثائق والوسائط داخل الملف الشخصي
// كل تغيير يُحفظ مباشرة عبر onChange، فلا يحتاج زر "حفظ البيانات"
export default function MediaSection({ personName, media = [], canEdit, onChange }) {
  const [tab, setTab] = useState("all");
  const [form, setForm] = useState(null); // null | { mode: "add" } | { mode: "edit", item }
  const [viewing, setViewing] = useState(null);
  const [error, setError] = useState("");

  const visible = media.filter((m) => {
    if (tab === "all") return true;
    if (tab === "image") return m.kind === "image";
    if (tab === "document") return m.kind === "document" || m.kind === "link";
    return m.kind === "audio" || m.kind === "video";
  });

  const addItem = async ({ title, date, description, file, url }) => {
    setError("");
    let item;
    if (file) {
      const fileId = newId();
      try {
        await putFile(fileId, file);
      } catch (err) {
        setError(saveErrorText(err));
        return;
      }
      item = {
        id: newId(),
        kind: kindOf(file),
        title: title || file.name,
        date,
        description,
        fileId,
        fileName: file.name,
        mime: file.type,
        size: file.size,
        addedAt: Date.now(),
      };
    } else {
      item = { id: newId(), kind: "link", title: title || url, date, description, url, addedAt: Date.now() };
    }
    onChange([...media, item]);
    setForm(null);
  };

  const editItem = (id, data) => {
    onChange(
      media.map((m) =>
        m.id === id
          ? { ...m, title: data.title || m.title, date: data.date, description: data.description, ...(m.kind === "link" && data.url ? { url: data.url } : {}) }
          : m
      )
    );
    setForm(null);
  };

  const removeItem = async (item) => {
    if (!window.confirm(`حذف "${item.title}" نهائياً؟`)) return;
    if (item.fileId) {
      try {
        await deleteFile(item.fileId);
      } catch {
        setError("تعذر حذف الملف من التخزين، ولم يُحذف من القائمة.");
        return;
      }
    }
    onChange(media.filter((m) => m.id !== item.id));
  };

  return (
    <div className="media">
      <div className="media__head">
        <div>
          <h3 className="media__title">الوثائق والوسائط</h3>
          <p className="media-muted">اختياري. تُضاف الصور والوثائق والتسجيلات إلى {personName || "الفرد"} نفسه.</p>
        </div>
        {canEdit && !form && (
          <button type="button" className="media-btn media-btn--primary" onClick={() => setForm({ mode: "add" })}>
            إضافة وسيط
          </button>
        )}
      </div>

      <div className="media-tabs" role="tablist" aria-label="تصفية الوسائط">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`media-tab${tab === t.key ? " is-on" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            <span className="media-tab__count">
              {t.key === "all"
                ? media.length
                : media.filter((m) =>
                    t.key === "image" ? m.kind === "image"
                    : t.key === "document" ? m.kind === "document" || m.kind === "link"
                    : m.kind === "audio" || m.kind === "video"
                  ).length}
            </span>
          </button>
        ))}
      </div>

      {error && <p className="media-error" role="alert">{error}</p>}

      {form && (
        <MediaForm
          initial={form.mode === "edit" ? form.item : null}
          isEdit={form.mode === "edit"}
          onCancel={() => setForm(null)}
          onSubmit={(data) =>
            form.mode === "edit" ? editItem(form.item.id, data) : addItem(data)
          }
        />
      )}

      {visible.length === 0 ? (
        <p className="media-empty">
          {media.length === 0
            ? "لم تُضَف وسائط بعد."
            : "لا توجد وسائط في هذا التصنيف."}
        </p>
      ) : (
        <ul className="media-grid">
          {visible.map((m) => (
            <li key={m.id} className="media-card">
              <button type="button" className="media-card__open" onClick={() => setViewing(m)} aria-label={`فتح ${m.title}`}>
                <span className="media-thumb">
                  <MediaThumb item={m} />
                </span>
                <span className="media-card__title">{m.title}</span>
                <span className="media-card__meta">
                  {KIND_LABEL[m.kind]}
                  {m.date ? ` · ${m.date}` : ""}
                  {m.size ? ` · ${formatSize(m.size)}` : ""}
                </span>
              </button>
              {canEdit && (
                <div className="media-card__actions">
                  <button type="button" className="media-btn media-btn--small" onClick={() => setForm({ mode: "edit", item: m })}>
                    تعديل
                  </button>
                  <button type="button" className="media-btn media-btn--small media-btn--danger" onClick={() => removeItem(m)}>
                    حذف
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {viewing && <MediaViewer item={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
