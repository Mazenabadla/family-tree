import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PersonNode from "./PersonNode";
import ColumnsView from "./ColumnsView";
import PersonProfile from "../person/PersonProfile";
import { ADMIN_USERNAME, ADMIN_PASSWORD } from "../../config/auth";
import { isNodeOpen, openChain } from "./personUtils";
import "./FamilyTree.scss";
import "./AdminLogin.scss";
import seedData from "../../data/family-tree.json";

const STORAGE_KEY = "family-tree-v1";
const DATA_VERSION = 2; // ارفعه عند تغيير family-tree.json

// ترتيب المؤسسين من فوق لتحت
const FOUNDER_ORDER = [
  "founder-osman-abdullah",
  "founder-osman-gharbi",
  "founder-abdulkarim",
  "founder-salim",
  "founder-ibrahim",
];

// خمسة أجداد مؤسسين، كل واحد جذر فرع مستقل تماماً
const INITIAL_FOUNDERS = [
  { id: "founder-osman-abdullah", name: "عثمان عبد الله", children: [] },
  { id: "founder-osman-gharbi", name: "عثمان الغربي", children: [] },
  { id: "founder-abdulkarim", name: "عبد الكريم", children: [] },
  { id: "founder-salim", name: "سليم", children: [] },
  { id: "founder-ibrahim", name: "إبراهيم", children: [] },
];

const CARD_FONT = "700 14px";
const MIN_CARD_W = 150;

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// تنظيف الشجرة: نحافظ على كل الحقول، ونضمن id و name و children
const normalize = (nodes) =>
  (Array.isArray(nodes) ? nodes : [])
    .filter((n) => n && typeof n === "object")
    .map((n) => ({
      ...n,
      id: n.id ?? newId(),
      name: String(n.name ?? "بدون اسم"),
      children: normalize(n.children),
    }));

const loadData = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.version === DATA_VERSION && Array.isArray(saved.people)) {
      const clean = normalize(saved.people);
      if (clean.length > 0) return clean;
    }
  } catch {
    // بيانات تالفة، نتجاهلها
  }
  return normalize(seedData);
};
// سلسلة الأشخاص من الجد لحد الشخص المطلوب (تشمل الاثنين)
const pathTo = (person, id) => {
  if (person.id === id) return [person];
  for (const child of person.children) {
    const sub = pathTo(child, id);
    if (sub) return [person, ...sub];
  }
  return null;
};

const findById = (nodes, id) => {
  for (const n of nodes) {
    if (n.id === id) return n;
    const f = findById(n.children, id);
    if (f) return f;
  }
  return null;
};

// سلسلة الأسماء لكل شخص من نفسه للجد
const buildLineage = (nodes, trail = [], out = {}) => {
  nodes.forEach((n) => {
    const t = [...trail, n.name];
    out[n.id] = [...t].reverse();
    buildLineage(n.children, t, out);
  });
  return out;
};

// كل الأشخاص اللي ليهم أبناء في الفروع المعروضة، مع عمق كل واحد
const collectParents = (nodes, depth, out = []) => {
  nodes.forEach((n) => {
    if (n.children.length) {
      out.push({ id: n.id, depth });
      collectParents(n.children, depth + 1, out);
    }
  });
  return out;
};

const collectNames = (nodes, out = []) => {
  nodes.forEach((n) => {
    out.push(n.name);
    collectNames(n.children, out);
  });
  return out;
};

// عرض البطاقة على قد أطول اسم بقياس فعلي في المتصفح
const measureCardWidth = (names) => {
  if (typeof document === "undefined") return MIN_CARD_W;
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.font = `${CARD_FONT} ${getComputedStyle(document.body).fontFamily || "sans-serif"}`;
  const widest = names.reduce((m, n) => Math.max(m, ctx.measureText(n).width), 0);
  return Math.max(MIN_CARD_W, Math.ceil(widest + 40 + 22 + 10 + 10 + 20 + 12));
};

// نافذة دخول المشرف
function AdminLogin({ onClose, onSuccess }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e) => {
    e.preventDefault();
    if (user.trim() === ADMIN_USERNAME && pass === ADMIN_PASSWORD) {
      onSuccess();
    } else {
      setError("اسم المستخدم أو كلمة المرور غلط");
    }
  };

  return createPortal(
    <div className="login-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="login-box" onSubmit={submit}>
        <h3>دخول المشرف</h3>
        <label className="login-field">
          <span>اسم المستخدم</span>
          <input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" autoFocus />
        </label>
        <label className="login-field">
          <span>كلمة المرور</span>
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <p className="login-error">{error}</p>}
        <div className="login-actions">
          <button type="submit" className="login-btn">دخول</button>
          <button type="button" className="login-btn login-btn--ghost" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function FamilyTree() {
  const [familyData, setFamilyData] = useState(loadData);
  const [mode, setMode] = useState("tree");      // "tree" افتراضياً، أو "columns"
  const [focusId, setFocusId] = useState(null);  // الفرع المركّز عليه في الشجرة (null = الكل)
  // حالة التوسيع المشتركة بين الشجرة والأعمدة (المفتاح: المعرف)
  const [expanded, setExpanded] = useState({});
  const [profileId, setProfileId] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

useEffect(() => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: DATA_VERSION, people: familyData })
    );
  } catch {
    // التخزين ممتلئ أو مغلق، والشجرة تفضل شغالة
  }
}, [familyData]);

  const sortedFounders = [...familyData].sort((a, b) => {
    const ia = FOUNDER_ORDER.indexOf(a.id);
    const ib = FOUNDER_ORDER.indexOf(b.id);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  // ---------- الشجرة ----------
  // مسار الفرع المركّز عليه (من الجد لحد الفرع)
  const focusPath = (() => {
    if (!focusId) return null;
    for (const f of familyData) {
      const p = pathTo(f, focusId);
      if (p) return p;
    }
    return null;
  })();
  const focusDepth = focusPath ? focusPath.length - 1 : 0;
  const treeRoots = focusPath ? [focusPath[focusPath.length - 1]] : sortedFounders;

  // ---------- الأعمدة + المسار المفتوح (نفس الحالة اللي بتستخدمها الشجرة) ----------
  const openNodes = openChain(sortedFounders, expanded);

  const lineageMap = buildLineage(familyData);
  const cardW = measureCardWidth(collectNames(familyData));

  // زرار توسيع/طي الكل في الشجرة
  const parents = collectParents(treeRoots, focusDepth);
  const allOpen = parents.length > 0 && parents.every((p) => isNodeOpen(expanded, p.id, p.depth, 0));

  const toggleAll = () => {
    const next = !allOpen;
    setExpanded((prev) => {
      const copy = { ...prev };
      parents.forEach((p) => {
        copy[p.id] = next;
      });
      return copy;
    });
  };

  // الضغط على بطاقة في الشجرة: يفتح أو يقفل الأبناء
  const toggleNode = (id, depth) =>
    setExpanded((prev) => ({ ...prev, [id]: !isNodeOpen(prev, id, depth, 0) }));

  // زرار "عرض الفرع": يركّز الشجرة على الشخص، ويفتح طريقه من الجد (فالأعمدة تعرض نفس الطريق)
  const focusPerson = (personId) => {
    const f = familyData.find((x) => pathTo(x, personId));
    if (!f) return;
    const p = pathTo(f, personId);
    setExpanded((prev) => {
      const copy = { ...prev };
      p.forEach((n) => {
        copy[n.id] = true;
      });
      return copy;
    });
    setFocusId(personId);
  };

  // ---------- الأعمدة ----------
  // يقفل كل الأشخاص اللي تحت المستوى i (يعني المستوى i يبقى آخر مفتوح)
  const closeBelow = (i) => {
    const n = openNodes[i];
    if (!n) return;
    setExpanded((prev) => ({ ...prev, [n.id]: false }));
  };

  // الضغط على صف في عمود k: يفتح أو يقفل الشخص، ويقفل إخوته في نفس العمود
  const pickColumn = (k, id) => {
    const list = k === 0 ? sortedFounders : openNodes[k - 1].children;
    const node = list.find((n) => n.id === id);
    if (!node) return;
    setExpanded((prev) => {
      const copy = { ...prev };
      list.forEach((s) => {
        if (s.id !== id) copy[s.id] = false;
      });
      if (node.children.length) copy[id] = !isNodeOpen(prev, id, k, 0);
      return copy;
    });
  };

  // ---------- التعديل (لازم وضع التحرير مفتوح) ----------
  const addChild = (parentId, childName) => {
    if (!editMode) return;
    const child = { id: newId(), name: childName, children: [] };
    setFamilyData((prev) =>
      (function walk(list) {
        return list.map((person) =>
          person.id === parentId
            ? { ...person, children: [...person.children, child] }
            : { ...person, children: walk(person.children) }
        );
      })(prev)
    );
    setExpanded((prev) => ({ ...prev, [parentId]: true }));
  };

  const updatePerson = (id, patch) => {
    if (!editMode) return;
    setFamilyData((prev) =>
      (function walk(list) {
        return list.map((person) =>
          person.id === id
            ? { ...person, ...patch }
            : { ...person, children: walk(person.children) }
        );
      })(prev)
    );
  };

  const resetTree = () => {
    if (!editMode) return;
    if (!window.confirm("مسح كل الأفراد وإعادة الشجرة للوضع الفارغ؟")) return;
    setFamilyData(INITIAL_FOUNDERS);
    setExpanded({});
    setFocusId(null);
    setProfileId(null);
  };

  const toggleEdit = () => {
    if (editMode) {
      setEditMode(false);
      setProfileId(null);
    } else {
      setLoginOpen(true);
    }
  };

  const onLoginSuccess = () => {
    setEditMode(true);
    setLoginOpen(false);
  };

  const profilePerson = profileId ? findById(familyData, profileId) : null;

  return (
    <div className="family-tree" style={{ "--card-w": `${cardW}px` }}>
      <div className="tree-toolbar">
        <div className="tree-toolbar__path">
          {mode === "tree" ? (
            focusPath ? (
              <nav className="breadcrumb" aria-label="مسار الفرع">
                <span className="breadcrumb__item">
                  <button type="button" onClick={() => setFocusId(null)}>الكل</button>
                  <span className="breadcrumb__sep">‹</span>
                </span>
                {focusPath.map((p, i) =>
                  i === focusPath.length - 1 ? (
                    <span key={p.id} className="breadcrumb__current">{p.name}</span>
                  ) : (
                    <span key={p.id} className="breadcrumb__item">
                      <button type="button" onClick={() => setFocusId(p.id)}>{p.name}</button>
                      <span className="breadcrumb__sep">‹</span>
                    </span>
                  )
                )}
              </nav>
            ) : (
              <h2 className="tree-title">شجرة العبادلة</h2>
            )
          ) : openNodes.length ? (
            <nav className="breadcrumb" aria-label="مسار الأعمدة">
              <span className="breadcrumb__item">
                <button type="button" onClick={() => closeBelow(0)}>الكل</button>
                <span className="breadcrumb__sep">‹</span>
              </span>
              {openNodes.map((p, i) =>
                i === openNodes.length - 1 ? (
                  <span key={p.id} className="breadcrumb__current">{p.name}</span>
                ) : (
                  <span key={p.id} className="breadcrumb__item">
                    <button type="button" onClick={() => closeBelow(i + 1)}>{p.name}</button>
                    <span className="breadcrumb__sep">‹</span>
                  </span>
                )
              )}
            </nav>
          ) : (
            <h2 className="tree-title">شجرة العبادلة</h2>
          )}
        </div>

        <div className="toolbar-actions">
          <label className="view-select">
            <span>طريقة العرض</span>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="tree">عرض الشجرة</option>
              <option value="columns">عرض الأعمدة</option>
            </select>
          </label>

          {mode === "tree" && parents.length > 0 && (
            <button type="button" className="tree-btn tree-btn--ghost" onClick={toggleAll} aria-expanded={allOpen}>
              {allOpen ? "طي الكل −" : "توسيع الكل ＋"}
            </button>
          )}
          {mode === "columns" && openNodes.length > 0 && (
            <button type="button" className="tree-btn tree-btn--ghost" onClick={() => closeBelow(0)}>
              طي الكل −
            </button>
          )}

          <button
            type="button"
            className={`tree-btn ${editMode ? "tree-btn--danger" : "tree-btn--ghost"}`}
            onClick={toggleEdit}
            aria-pressed={editMode}
          >
            {editMode ? "إيقاف التحرير" : "فتح التحرير"}
          </button>
        </div>
      </div>

      {mode === "tree" ? (
        <section className="tree-scroll">
          <div className="tree-view">
            {treeRoots.map((r) => (
              <PersonNode
                key={r.id}
                person={r}
                depth={focusDepth}
                rootDepth={0}
                isRoot
                expanded={expanded}
                lineageMap={lineageMap}
                canEdit={editMode}
                onToggle={toggleNode}
                onSelect={focusPerson}
                onAddChild={addChild}
                onOpenProfile={setProfileId}
              />
            ))}
          </div>
        </section>
      ) : (
        <ColumnsView
          roots={sortedFounders}
          chain={openNodes}
          onPick={pickColumn}
          onProfile={setProfileId}
          canEdit={editMode}
          onAddChild={addChild}
        />
      )}

      {mode === "tree" && editMode && (
        <div className="tree-footer">
          <button type="button" className="tree-btn tree-btn--danger" onClick={resetTree}>
            إعادة ضبط الشجرة
          </button>
        </div>
      )}

      {profilePerson && (
        <PersonProfile
          key={profilePerson.id}
          person={profilePerson}
          lineage={lineageMap[profilePerson.id] || [profilePerson.name]}
          canEdit={editMode}
          onClose={() => setProfileId(null)}
          onSave={(name, profile) => {
            updatePerson(profilePerson.id, { name, profile });
            setProfileId(null);
          }}
        />
      )}

      {loginOpen && <AdminLogin onClose={() => setLoginOpen(false)} onSuccess={onLoginSuccess} />}
    </div>
  );
}

export default FamilyTree;