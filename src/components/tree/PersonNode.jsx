import { useState } from "react";
import { createPortal } from "react-dom";
import { LEVEL_COLORS, isNodeOpen, ageText, isDeceased, countPeople } from "./personUtils";
import { IconUserPlus, IconResume, PersonAvatar } from "./icons";

const IconChevron = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
    strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

// بطاقة شخص: الضغط عليها يفتح أو يقفل الأبناء، والعدد يظهر كشارة لما تكون مقفولة
function PersonNode({
  person,
  depth = 0,
  rootDepth = 0,
  isRoot = false,
  isLast = false,
  expanded = {},
  lineageMap = {},
  canEdit = false,
  onToggle,
  onSelect,
  onAddChild,
  onOpenProfile,
}) {
  const [showForm, setShowForm] = useState(false);
  const [childName, setChildName] = useState("");
  const [tip, setTip] = useState(null);

  // حماية: لو الشخص ناقص نرجع بدون ما نكسر الصفحة
  if (!person) return null;

  const children = person.children || [];
  const hasChildren = children.length > 0;
  const open = isNodeOpen(expanded, person.id, depth, rootDepth);
  const descendants = countPeople(person) - 1;

  const level = Math.max(0, depth - rootDepth);
  const palette = LEVEL_COLORS[Math.min(level, LEVEL_COLORS.length - 1)];
  const nodeStyle = { "--bg": palette.bg, "--bd": palette.bd, "--fg": palette.fg };

  const lineage = lineageMap[person.id] || [person.name];
  const tipText = lineage.join(" بن ");
  const age = ageText(person);
  const dead = isDeceased(person);

  const showTip = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ x: r.left + r.width / 2, y: r.top });
  };
  const hideTip = () => setTip(null);

  // الأزرار داخل البطاقة ما توصلش للنقر العام
  const stop = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  const toggle = () => hasChildren && onToggle && onToggle(person.id, depth, rootDepth);

  const handleSubmit = (e) => {
    e.preventDefault();
    const n = childName.trim();
    if (!n || !canEdit) return;
    onAddChild(person.id, n);
    setChildName("");
    setShowForm(false);
  };

  const nodeClass = ["tree-node", isRoot && "tree-node--root", isLast && "is-last"]
    .filter(Boolean)
    .join(" ");

  const cardClass = [
    "person-card",
    isRoot && "person-card--root",
    dead && "person-card--dead",
    hasChildren && "person-card--clickable",
    hasChildren && open && "is-open",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={nodeClass} style={nodeStyle}>
      <div
        className={cardClass}
        onClick={toggle}
        role={hasChildren ? "button" : undefined}
        tabIndex={hasChildren ? 0 : undefined}
        aria-expanded={hasChildren ? open : undefined}
        onKeyDown={(e) => {
          if (hasChildren && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            toggle();
          }
        }}
        title={hasChildren ? (open ? "اضغط لطي الأجيال" : "اضغط لتوسيع الأجيال") : undefined}
      >
        {hasChildren && !open && descendants > 0 && (
          <span className="person-card__badge" title={`${descendants} فرد في الذرية`}>
            {descendants}
          </span>
        )}

        {hasChildren && (
          <span className="person-card__chev" aria-hidden="true">
            <IconChevron />
          </span>
        )}

        <div className="person-card__avatar">
          <PersonAvatar person={person} />
        </div>

        <div className="person-card__text">
          <div className="person-card__name" onMouseEnter={showTip} onMouseLeave={hideTip}>
            {person.name}
          </div>
          {age && <div className="person-card__years">{age}</div>}
          {isRoot && <div className="person-card__years">{countPeople(person)} فرد</div>}
        </div>

        <div className="person-card__actions">
          {canEdit && (
            <button
              type="button"
              className="mini"
              title="إضافة أفراد جدد"
              aria-label="إضافة أفراد جدد"
              onClick={stop(() => setShowForm((v) => !v))}
            >
              <IconUserPlus />
            </button>
          )}

          <button
            type="button"
            className="mini"
            title="السيرة الذاتية"
            aria-label="السيرة الذاتية"
            onClick={stop(() => onOpenProfile && onOpenProfile(person.id))}
          >
            <IconResume />
          </button>
        </div>
      </div>

      {tip &&
        createPortal(
          <div className="name-tip" style={{ left: tip.x, top: tip.y }}>
            {tipText}
          </div>,
          document.body
        )}

      {canEdit && showForm && (
        <form className="add-child-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="اكتب اسم العضو الجديد"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            autoFocus
          />
          <div className="add-child-form__actions">
            <button type="submit">إضافة</button>
            <button
              type="button"
              className="cancel-button"
              onClick={() => {
                setShowForm(false);
                setChildName("");
              }}
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      {hasChildren && open && (
        <div className="tree-children">
          {children.map((child, i) => (
            <PersonNode
              key={child.id}
              person={child}
              depth={depth + 1}
              rootDepth={rootDepth}
              isLast={i === children.length - 1}
              expanded={expanded}
              lineageMap={lineageMap}
              canEdit={canEdit}
              onToggle={onToggle}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onOpenProfile={onOpenProfile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
// سلسلة الأشخاص المفتوحين (كل واحد مفتوح وعنده أبناء): الشجرة والأعمدة بيستخدموها مع بعض
export const openChain = (roots, expanded) => {
  const out = [];
  let list = roots;
  let depth = 0;
  while (true) {
    const sel = list.find(
      (n) => (n.children || []).length > 0 && isNodeOpen(expanded, n.id, depth, 0)
    );
    if (!sel) break;
    out.push(sel);
    list = sel.children;
    depth += 1;
  }
  return out;
};

export default PersonNode;