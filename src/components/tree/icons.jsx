// أيقونات SVG داخلية، من غير مكتبات إضافية
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
};

export const IconPlus = ({ size = 12 }) => (
  <svg {...base} width={size} height={size} strokeWidth="2.6">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconMinus = ({ size = 12 }) => (
  <svg {...base} width={size} height={size} strokeWidth="2.6">
    <path d="M5 12h14" />
  </svg>
);

export const IconUserPlus = ({ size = 12 }) => (
  <svg {...base} width={size} height={size} strokeWidth="2.2">
    <circle cx="10" cy="8" r="4" />
    <path d="M3 20c0-3.3 3-6 7-6" />
    <path d="M18 8v6M15 11h6" />
  </svg>
);

// أيقونة السيرة الذاتية: ورقة فيها شخص (مش حرف i)
export const IconResume = ({ size = 13 }) => (
  <svg {...base} width={size} height={size} strokeWidth="2">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <circle cx="12" cy="12.5" r="2.2" />
    <path d="M8.8 17c.5-1.5 1.6-2.2 3.2-2.2s2.7.7 3.2 2.2" />
  </svg>
);

// للتوافق مع الكود القديم
export const IconProfile = IconResume;

// الصورة: لو موجودة تظهر، ولو لأ شكل شخص افتراضي
export function PersonAvatar({ person }) {
  const src = person.image || person.profile?.image;
  if (src) {
    return <img src={src} alt={person.name} />;
  }
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
      <circle cx="32" cy="24" r="11" fill="currentColor" />
      <path d="M11 58c2-13 10-19 21-19s19 6 21 19z" fill="currentColor" />
    </svg>
  );
}