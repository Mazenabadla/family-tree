import { useState } from "react";
import { LEVEL_COLORS, ageText, isDeceased } from "./personUtils";
import { IconResume, PersonAvatar } from "./icons";

// عرض الأعمدة: الأعمدة مبنية من سلسلة الأشخاص المفتوحين (chain) المشتركة مع الشجرة
export default function ColumnsView({ roots, chain, onPick, onProfile, canEdit, onAddChild }) {
  const [adding, setAdding] = useState(null);
  const [name, setName] = useState("");

  // العمود الأول: الفروع الرئيسية. كل عمود بعده: أبناء الشخص المفتوح اللي قبله
  const columns = [{ list: roots, parent: null }];
  chain.forEach((n) => columns.push({ list: n.children, parent: n }));

  const submit = (e, parentId) => {
    e.preventDefault();
    const v = name.trim();
    if (!v) return;
    onAddChild(parentId, v);
    setName("");
    setAdding(null);
  };

  return (
    <div className="cols">
      {columns.map((col, k) => {
        const palette = LEVEL_COLORS[Math.min(k, LEVEL_COLORS.length - 1)];
        const style = { "--bg": palette.bg, "--bd": palette.bd, "--fg": palette.fg };
        const selectedId = chain[k]?.id;

        return (
          <section className="col" key={col.parent ? col.parent.id : "roots"} style={style}>
            <header className="col__head">
              <strong>{k === 0 ? "الفروع الرئيسية" : `ذرية ${col.parent.name}`}</strong>
              <small>
                {col.list.length} {k === 0 ? "فرع" : "فرد"}
              </small>
            </header>

            <div className="col__body">
              {col.list.map((n) => {
                const has = n.children.length > 0;
                const selected = selectedId === n.id;
                const age = ageText(n);
                const dead = isDeceased(n);
                return (
                  <div
                    key={n.id}
                    className={`row${selected ? " is-sel" : ""}${dead ? " row--dead" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onPick(k, n.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onPick(k, n.id);
                    }}
                  >
                    <span className="row__ava">
                      <PersonAvatar person={n} />
                    </span>
                    <span className="row__txt">
                      <span className="row__name">{n.name}</span>
                      {age && <span className="row__yrs">{age}</span>}
                    </span>
                    {has && <span className="row__cnt">‹ {n.children.length}</span>}
                    <button
                      type="button"
                      className="row__info"
                      title="السيرة الذاتية"
                      aria-label="السيرة الذاتية"
                      onClick={(e) => {
                        e.stopPropagation();
                        onProfile(n.id);
                      }}
                    >
                      <IconResume size={13} />
                    </button>
                  </div>
                );
              })}
            </div>

            {canEdit &&
              k > 0 &&
              (adding === col.parent.id ? (
                <form className="col__add" onSubmit={(e) => submit(e, col.parent.id)}>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="اسم العضو الجديد"
                    autoFocus
                  />
                  <button type="submit">إضافة</button>
                </form>
              ) : (
                <button
                  type="button"
                  className="col__addbtn"
                  onClick={() => {
                    setAdding(col.parent.id);
                    setName("");
                  }}
                >
                  ＋ إضافة فرد لـ {col.parent.name}
                </button>
              ))}
          </section>
        );
      })}
    </div>
  );
}