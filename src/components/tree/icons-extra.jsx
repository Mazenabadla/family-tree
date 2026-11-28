// أيقونات إضافية لشريط الإجراءات تحت البطاقة
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
};

export const IconSearch = ({ size = 13 }) => (
  <svg {...base} width={size} height={size} strokeWidth="2.2">
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </svg>
);

export const IconPencil = ({ size = 13 }) => (
  <svg {...base} width={size} height={size} strokeWidth="2">
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

// أيقونة الفرع: عقدة تتفرع منها عقدتان (لعرض الفرع وحده)
export const IconBranch = ({ size = 13 }) => (
  <svg {...base} width={size} height={size} strokeWidth="2">
    <circle cx="12" cy="5" r="2.2" />
    <circle cx="6" cy="19" r="2.2" />
    <circle cx="18" cy="19" r="2.2" />
    <path d="M12 7.2V12M6 16.8V13.5a1.5 1.5 0 0 1 1.5-1.5h9a1.5 1.5 0 0 1 1.5 1.5v3.3" />
  </svg>
);
