import { useState } from "react";
import { createPortal } from "react-dom";
import { LEVEL_COLORS, isNodeOpen, ageText, isDeceased, countPeople } from "./personUtils";
import { IconUserPlus, IconResume, PersonAvatar } from "./icons";
import { IconBranch, IconPencil } from "./icons-extra";

const IconChevron = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
    strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

// نموذج صغير لإدخال اسم: يُستخدم للإضافة وللتعديل
function NameForm({ initial, placeholder, submitLabel, onSubmit, onCancel }) {
  const [value, setValue] = useState(initial);

  const submit = (e) => {
    e.preventDefault();
    const v = value.trim();
    if (v) onSubmit(v);
  };

  return (
    <form className="add-child-form" onSubmit={submit}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        aria-label={placeholder}
        autoFocus
      />
      <div className="add-child-form__actions">
        <button type="submit">{submitLabel}</button>
        <button type="button" className="cancel-button" onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </form>
  );
}

// بطاقة شخص: الضغط على الاسم يفتح الأبناء أو يقفلهم، وشريط الإجراءات تحت البطاقة
function PersonNode({
  person,
  depth = 0,
  rootDepth = 0,
  isRoot = false,
  isLast = false,
  expanded = {},
  lineageMap = {},
  canEdit = false,
  flashId = null,
  onToggle,
  onSelect,
  onAddChild,
  onRename,
  onOpenProfile,
}) {
  const [mode, setMode] = useState(null); // null | "add" | "rename"
  const [tip, setTip] = useState(null);

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

  const toggle = () => hasChildren && onToggle && onToggle(person.id, depth, rootDepth);

  const submitAdd = (name) => {
    onAddChild(person.id, name);
    setMode(null);
  };

  const submitRename = (name) => {
    onRename(person.id, name);
    setMode(null);
  };

  const nodeClass = [
    "tree-node",
    isRoot && "tree-node--root",
    isLast && "is-last",
    flashId === person.id && "is-flash",
  ]
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
        id={`node-${person.id}`}
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
        title={hasChildren ? (open ? "اضغط لطي الأجيال" : "اضغط لعرض الأجيال") : undefined}
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
      </div>

      {/* شريط الإجراءات: خارج البطاقة حتى لا تتداخل الأزرار مع زر الفتح والطي */}
      <div className="person-strip" role="toolbar" aria-label={`إجراءات ${person.name}`}>
        <button
          type="button"
          className="mini"
          title="عرض هذا الفرع وحده"
          aria-label="عرض هذا الفرع وحده"
          onClick={() => onSelect(person.id)}
        >
          <IconBranch />
        </button>

        {canEdit && (
          <button
            type="button"
            className="mini"
            title="تعديل الاسم"
            aria-label="تعديل الاسم"
            aria-pressed={mode === "rename"}
            onClick={() => setMode(mode === "rename" ? null : "rename")}
          >
            <IconPencil />
          </button>
        )}

        {canEdit && (
          <button
            type="button"
            className="mini"
            title="إضافة ابن"
            aria-label="إضافة ابن"
            aria-pressed={mode === "add"}
            onClick={() => setMode(mode === "add" ? null : "add")}
          >
            <IconUserPlus />
          </button>
        )}

        <button
          type="button"
          className="mini"
          title="السيرة الذاتية"
          aria-label="السيرة الذاتية"
          onClick={() => onOpenProfile && onOpenProfile(person.id)}
        >
          <IconResume />
        </button>
      </div>

      {tip &&
        createPortal(
          <div className="name-tip" style={{ left: tip.x, top: tip.y }}>
            {tipText}
          </div>,
          document.body
        )}

      {canEdit && mode === "add" && (
        <NameForm
          key="add"
          initial=""
          placeholder="اكتب اسم الابن"
          submitLabel="إضافة"
          onSubmit={submitAdd}
          onCancel={() => setMode(null)}
        />
      )}

      {canEdit && mode === "rename" && (
        <NameForm
          key="rename"
          initial={person.name}
          placeholder="الاسم الكامل"
          submitLabel="حفظ الاسم"
          onSubmit={submitRename}
          onCancel={() => setMode(null)}
        />
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
              flashId={flashId}
              onToggle={onToggle}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onRename={onRename}
              onOpenProfile={onOpenProfile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default PersonNode;
