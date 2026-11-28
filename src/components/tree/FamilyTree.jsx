import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PersonNode from "./PersonNode";
import ColumnsView from "./ColumnsView";
import PersonProfile from "../person/PersonProfile";
import { verifyAdmin } from "../../config/auth";
import { TREE_TITLE } from "../../config/app";
import { isNodeOpen, openChain } from "./personUtils";
import {
  loadTree,
  saveTree,
  readLegacy,
  clearLegacy,
  getFile,
  putFile,
  clearFiles,
} from "../../lib/storage";
import { blobToDataUrl, dataUrlToBlob } from "../../lib/fileUtils";
import "./FamilyTree.scss";
import "./AdminLogin.scss";
import seedData from "../../data/family-tree.json";

// ارفع هذا الرقم فقط عند تغيير شكل البيانات نفسه، لا عند تغيير محتوى الشجرة
const DATA_VERSION = 3;

// ترتيب المؤسسين من فوق لتحت
const FOUNDER_ORDER = [
  "founder-osman-abdullah",
  "founder-osman-gharbi",
  "founder-abdulkarim",
  "founder-salim",
  "founder-ibrahim",
];

// خمسة أجداد مؤسسين، كل واحد جذر فرع مستقل
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

// تطبيع للبحث العربي: يتجاهل التشكيل والفرق بين الهمزات والتاء المربوطة والألف المقصورة
const normalizeAr = (s) =>
  String(s)
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase();

const saveErrorText = (err) =>
  err?.name === "QuotaExceededError"
    ? "المساحة ممتلئة. صدّر نسخة احتياطية ثم أعد المحاولة."
    : "تعذر الحفظ. ستبقى التغييرات في الصفحة حتى إعادة التحميل.";

const SAVE_LABELS = {
  idle: "",
  saving: "جارٍ الحفظ…",
  saved: "تم الحفظ",
  error: "تعذر الحفظ",
};

// نافذة دخول المشرف
function AdminLogin({ onClose, onSuccess }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await verifyAdmin(user, pass);
      if (r.ok) {
        onSuccess();
        return;
      }
      setError("اسم المستخدم أو كلمة المرور غير صحيحة");
    } catch {
      setError("تعذر التحقق في هذا المتصفح");
    } finally {
      setBusy(false);
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
          <button type="submit" className="login-btn" disabled={busy}>
            {busy ? "جارٍ التحقق…" : "دخول"}
          </button>
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
  // البيانات تبدأ فارغة حتى تُحمَّل من التخزين، فلا تُكتب الشجرة الأصلية فوق بيانات محفوظة
  const [familyData, setFamilyData] = useState(null);
  const [storageError, setStorageError] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const [saveMsg, setSaveMsg] = useState("");
  const legacyRef = useRef(false);
  const importRef = useRef(null);

  const [mode, setMode] = useState("tree"); // "tree" أو "columns"
  const [focusId, setFocusId] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [profileId, setProfileId] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [query, setQuery] = useState("");
  const [flashId, setFlashId] = useState(null);

  // تحميل البيانات مرة واحدة: من IndexedDB، ثم من النسخة القديمة إن وُجدت، ثم من الملف الأصلي
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let people = null;
      let fromLegacy = false;
      try {
        const saved = await loadTree();
        if (Array.isArray(saved?.people)) people = saved.people;
      } catch {
        setStorageError("تعذر فتح التخزين في هذا المتصفح، والتغييرات لن تُحفظ بعد إغلاق الصفحة.");
      }
      if (!people) {
        const legacy = readLegacy();
        if (legacy) {
          people = legacy;
          fromLegacy = true;
        }
      }
      if (cancelled) return;
      legacyRef.current = fromLegacy;
      setFamilyData(normalize(people && people.length ? people : seedData));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // الحفظ عند كل تغيير، مع حالة ظاهرة للمستخدم
  useEffect(() => {
    if (!familyData || storageError) return;
    setSaveState("saving");
    saveTree({ version: DATA_VERSION, people: familyData, savedAt: Date.now() })
      .then(() => {
        if (legacyRef.current) {
          clearLegacy();
          legacyRef.current = false;
        }
        setSaveMsg("");
        setSaveState("saved");
      })
      .catch((err) => {
        setSaveMsg(saveErrorText(err));
        setSaveState("error");
      });
  }, [familyData, storageError]);

  const data = familyData ?? [];

  const sortedFounders = useMemo(
    () =>
      [...data].sort((a, b) => {
        const ia = FOUNDER_ORDER.indexOf(a.id);
        const ib = FOUNDER_ORDER.indexOf(b.id);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      }),
    [data]
  );

  // هذه القيم تُحسب فقط عند تغيير البيانات، لا عند كل نقرة على بطاقة
  const lineageMap = useMemo(() => buildLineage(data), [data]);
  const cardW = useMemo(() => measureCardWidth(collectNames(data)), [data]);

  const hits = useMemo(() => {
    const q = normalizeAr(query.trim());
    if (!q) return [];
    const out = [];
    const walk = (list) =>
      list.forEach((n) => {
        if (normalizeAr(n.name).includes(q)) out.push(n);
        walk(n.children);
      });
    walk(data);
    return out.slice(0, 8);
  }, [query, data]);

  // ---------- الشجرة ----------
  const focusPath = (() => {
    if (!focusId) return null;
    for (const f of data) {
      const p = pathTo(f, focusId);
      if (p) return p;
    }
    return null;
  })();
  const focusDepth = focusPath ? focusPath.length - 1 : 0;
  const treeRoots = focusPath ? [focusPath[focusPath.length - 1]] : sortedFounders;

  // ---------- الأعمدة والمسار المفتوح (نفس الحالة المشتركة مع الشجرة) ----------
  const openNodes = openChain(sortedFounders, expanded);

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

  const toggleNode = (id, depth) =>
    setExpanded((prev) => ({ ...prev, [id]: !isNodeOpen(prev, id, depth, 0) }));

  // "عرض هذا الفرع وحده": يركّز الشجرة على الشخص ويفتح طريقه من الجد
  const focusPerson = (personId) => {
    const f = data.find((x) => pathTo(x, personId));
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

  // ---------- البحث: يفتح طريق الشخص، ويمرر الشاشة إليه، ويضيء البطاقة لحظات ----------
  const revealPerson = (id) => {
    const f = data.find((x) => pathTo(x, id));
    if (!f) return;
    const p = pathTo(f, id);
    setExpanded((prev) => {
      const copy = { ...prev };
      p.forEach((n) => {
        copy[n.id] = true;
      });
      return copy;
    });
    setFocusId(null);
    setMode("tree");
    setQuery("");
    setFlashId(id);
    window.setTimeout(() => {
      document.getElementById(`node-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 80);
    window.setTimeout(() => setFlashId(null), 2400);
  };

  // ---------- الأعمدة ----------
  const closeBelow = (i) => {
    const n = openNodes[i];
    if (!n) return;
    setExpanded((prev) => ({ ...prev, [n.id]: false }));
  };

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

  // ---------- التعديل (يتطلب تفعيل وضع التحرير) ----------
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

  // التحديث يقرأ أحدث نسخة من الشخص، فلا يضيع تغيير حدث أثناء فتح النافذة
  const updatePersonWith = (id, makePatch) => {
    if (!editMode) return;
    setFamilyData((prev) =>
      (function walk(list) {
        return list.map((person) =>
          person.id === id
            ? { ...person, ...makePatch(person) }
            : { ...person, children: walk(person.children) }
        );
      })(prev)
    );
  };

  const updatePerson = (id, patch) => updatePersonWith(id, () => patch);

  const renamePerson = (id, name) => updatePerson(id, { name });

  const resetTree = async () => {
    if (!editMode) return;
    if (!window.confirm("مسح كل الأفراد والوسائط وإعادة الشجرة إلى وضعها الأصلي؟")) return;
    try {
      await clearFiles();
    } catch {
      window.alert("تعذر مسح الملفات المحفوظة. لم تُعد الشجرة.");
      return;
    }
    setFamilyData(normalize(INITIAL_FOUNDERS));
    setExpanded({});
    setFocusId(null);
    setProfileId(null);
  };

  // ---------- النسخ الاحتياطي: الملفات تُضمَّن كنص داخل النسخة لتكون قابلة للنقل ----------
  const embedMedia = async (nodes) =>
    Promise.all(
      nodes.map(async (n) => {
        const list = n.profile?.media || [];
        let profile = n.profile;
        if (list.length) {
          const media = await Promise.all(
            list.map(async (m) => {
              if (!m.fileId) return m;
              const blob = await getFile(m.fileId);
              return blob ? { ...m, data: await blobToDataUrl(blob) } : m;
            })
          );
          profile = { ...n.profile, media };
        }
        return { ...n, profile, children: await embedMedia(n.children) };
      })
    );

  const extractMedia = async (nodes) => {
    for (const n of nodes) {
      for (const m of n.profile?.media || []) {
        if (!m.data) continue;
        const fileId = m.fileId || newId();
        await putFile(fileId, await dataUrlToBlob(m.data));
        m.fileId = fileId;
        delete m.data;
      }
      await extractMedia(n.children);
    }
  };

  const exportData = async () => {
    try {
      const people = await embedMedia(data);
      const blob = new Blob([JSON.stringify({ version: DATA_VERSION, people }, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `family-tree-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      window.alert("تعذر تجهيز النسخة الاحتياطية. جرّب مرة أخرى.");
    }
  };

  const onImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let people;
    try {
      const parsed = JSON.parse(await file.text());
      people = Array.isArray(parsed) ? parsed : parsed?.people;
      if (!Array.isArray(people)) throw new Error("invalid");
    } catch {
      window.alert("الملف غير صالح. تأكد أنه نسخة صادرة من هذا التطبيق.");
      return;
    }
    if (!window.confirm("استيراد هذه النسخة يستبدل الشجرة والوسائط الحالية. هل تريد المتابعة؟")) return;
    try {
      await clearFiles();
      await extractMedia(people);
    } catch {
      window.alert("تعذر استعادة الوسائط من النسخة. لم تُستبدل الشجرة.");
      return;
    }
    setFamilyData(normalize(people));
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

  if (!familyData) {
    return (
      <div className="family-tree">
        <p className="tree-loading" role="status">جارٍ تحميل الشجرة…</p>
      </div>
    );
  }

  const profilePerson = profileId ? findById(data, profileId) : null;

  return (
    <div className="family-tree" style={{ "--card-w": `${cardW}px` }}>
      {storageError && (
        <p className="storage-banner" role="alert">{storageError}</p>
      )}

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
              <h2 className="tree-title">{TREE_TITLE}</h2>
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
            <h2 className="tree-title">{TREE_TITLE}</h2>
          )}
        </div>

        <div className="tree-search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن فرد بالاسم"
            aria-label="ابحث عن فرد بالاسم"
          />
          {hits.length > 0 && (
            <ul className="search-results" role="listbox" aria-label="نتائج البحث">
              {hits.map((n) => {
                const lineage = lineageMap[n.id] || [n.name];
                return (
                  <li key={n.id}>
                    <button type="button" onClick={() => revealPerson(n.id)}>
                      <span>{n.name}</span>
                      <small>{lineage.slice(1, 3).join(" بن ") || "من المؤسسين"}</small>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="toolbar-actions">
          <span className={`save-status save-status--${saveState}`} aria-live="polite" title={saveMsg}>
            {saveState === "error" ? saveMsg : SAVE_LABELS[saveState]}
          </span>

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
                flashId={flashId}
                onToggle={toggleNode}
                onSelect={focusPerson}
                onAddChild={addChild}
                onRename={renamePerson}
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

      {editMode && (
        <div className="tree-footer">
          <button type="button" className="tree-btn tree-btn--ghost" onClick={exportData}>
            تصدير نسخة احتياطية
          </button>
          <button type="button" className="tree-btn tree-btn--ghost" onClick={() => importRef.current?.click()}>
            استيراد نسخة
          </button>
          <input ref={importRef} type="file" accept="application/json" hidden onChange={onImportFile} />
          {mode === "tree" && (
            <button type="button" className="tree-btn tree-btn--danger" onClick={resetTree}>
              إعادة ضبط الشجرة
            </button>
          )}
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
            updatePersonWith(profilePerson.id, (cur) => ({
              name,
              profile: { ...cur.profile, ...profile },
            }));
            setProfileId(null);
          }}
          onMediaChange={(list) =>
            updatePersonWith(profilePerson.id, (cur) => ({
              profile: { ...cur.profile, media: list },
            }))
          }
        />
      )}

      {loginOpen && <AdminLogin onClose={() => setLoginOpen(false)} onSuccess={onLoginSuccess} />}
    </div>
  );
}

export default FamilyTree;
