import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./PersonProfile.scss";
import PhotoField from "./PhotoField";

const EDUCATION = [
  { value: "", label: "اختر المستوى" },
  { value: "primary", label: "ابتدائي" },
  { value: "prep", label: "إعدادي" },
  { value: "secondary", label: "ثانوي" },
  { value: "bachelor", label: "جامعة" },
  { value: "master", label: "ماجستير" },
  { value: "phd", label: "دكتوراه" },
];
const SPECIALIZED = ["bachelor", "master", "phd"];
const ACADEMIC_TITLES = ["دكتور", "أستاذ مساعد", "أستاذ مشارك", "أستاذ"];
const EXPERIENCES = [
  "إدارة", "تدريس", "طب وصحة", "هندسة", "تجارة وأعمال",
  "زراعة", "قانون", "تقنية ومعلومات", "عمل حر", "أخرى",
];
const SOCIALS = [
  { key: "facebook", label: "فيسبوك", hint: "https://facebook.com/..." },
  { key: "x", label: "إكس (تويتر)", hint: "https://x.com/..." },
  { key: "instagram", label: "إنستجرام", hint: "https://instagram.com/..." },
  { key: "tiktok", label: "تيك توك", hint: "https://tiktok.com/@..." },
  { key: "youtube", label: "يوتيوب", hint: "https://youtube.com/..." },
  { key: "linkedin", label: "لينكدإن", hint: "https://linkedin.com/in/..." },
  { key: "telegram", label: "تيليجرام", hint: "https://t.me/..." },
  { key: "whatsapp", label: "واتساب", hint: "رقم الواتساب مع الكود" },
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_SPOUSES = 4;

const emptyDraft = {
  name: "",
  mother: "",
  birthDate: "",
  birthPlace: "",
  deathDate: "",
  gender: "",
  idNumber: "",
  email: "",
  residence: "",
  socials: {},
  maritalStatus: "",
  spouses: [],
  educationLevel: "",
  specialization: "",
  academicTitle: "",
  certificates: [],
  experiences: [],
  notes: "",
};

// نحول الزوجات للشكل الجديد (كل زوجة اسم + قائمة أبناء)، ونقبل البيانات القديمة اللي كانت نصوص
const normalizeSpouses = (list) =>
  (Array.isArray(list) ? list : []).map((s) =>
    typeof s === "string"
      ? { name: s, children: [] }
      : {
        name: s?.name ?? "",
        children: Array.isArray(s?.children) ? s.children : [],
      }
  );

const buildDraft = (person) => {
  const p = person.profile || {};
  return {
    ...emptyDraft,
    ...p,
    name: person.name || "",
    socials: p.socials || {},
    spouses: normalizeSpouses(p.spouses),
  };
};

// التحقق من الحقول المطلوبة وصحتها
const validate = (d) => {
  const e = {};
  if (!d.name.trim()) e.name = "الاسم مطلوب";
  if (!d.mother.trim()) e.mother = "اسم الأم مطلوب";
  if (!d.birthDate) e.birthDate = "تاريخ الميلاد مطلوب";
  else if (new Date(d.birthDate) > new Date())
    e.birthDate = "تاريخ الميلاد ما يصحش يكون في المستقبل";
  if (d.deathDate && d.birthDate && d.deathDate < d.birthDate)
    e.deathDate = "تاريخ الوفاة لازم يكون بعد تاريخ الميلاد";
  if (!d.gender) e.gender = "اختر الجنس";
  if (!d.idNumber.trim()) e.idNumber = "رقم الهوية مطلوب";
  else if (!/^\d+$/.test(d.idNumber.trim())) e.idNumber = "رقم الهوية أرقام بس";
  if (!d.email.trim()) e.email = "الإيميل مطلوب";
  else if (!EMAIL_RE.test(d.email.trim())) e.email = "صيغة الإيميل مش صحيحة";
  if (!d.maritalStatus) e.maritalStatus = "اختر الحالة الاجتماعية";

  if (d.maritalStatus === "married") {
    if (d.spouses.length === 0) e.spouses = "أضف زوجة واحدة على الأقل";
    else if (d.spouses.some((s) => !s.name.trim())) e.spouses = "اكتب أسماء كل الزوجات";
    else if (d.spouses.some((s) => s.children.some((c) => !c.name.trim())))
      e.spouses = "اكتب أسماء كل الأبناء والبنات";
  }
  return e;
};

// تنظيف البيانات قبل الحفظ
const cleanDraft = (d) => ({
  ...d,
  name: d.name.trim(),
  mother: d.mother.trim(),
  idNumber: d.idNumber.trim(),
  email: d.email.trim(),
  residence: d.residence.trim(),
  birthPlace: d.birthPlace.trim(),
  deathDate: d.deathDate || "",
  socials: Object.fromEntries(
    Object.entries(d.socials || {})
      .map(([k, v]) => [k, (v || "").trim()])
      .filter(([, v]) => v)
  ),
  spouses:
    d.maritalStatus === "married"
      ? d.spouses.map((s) => ({
        name: s.name.trim(),
        children: s.children.map((c) => ({
          name: c.name.trim(),
          gender: c.gender,
        })),
      }))
      : [],
  certificates: d.certificates.map((c) => c.trim()).filter(Boolean),
  notes: d.notes.trim(),
});

// صورة الشخص، أو أفاتار ذكر/أنثى لو مفيش صورة
function Avatar({ gender, image, name }) {
  if (image) return <img src={image} alt={name} className="pf-avatar" />;
  const female = gender === "female";
  return (
    <div className={`pf-avatar pf-avatar--${female ? "female" : "male"}`} aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="32" className="pf-avatar__bg" />
        {female ? (
          <path d="M18 30c0-9 6-16 14-16s14 7 14 16v10c0 3-2 5-4 5H22c-2 0-4-2-4-5z" className="pf-avatar__hair" />
        ) : (
          <path d="M19 27c0-8 5-13 13-13s13 5 13 13v3H19z" className="pf-avatar__hair" />
        )}
        <circle cx="32" cy="28" r="9" className="pf-avatar__face" />
        <path d="M14 56c2-10 9-14 18-14s16 4 18 14" className="pf-avatar__body" />
      </svg>
    </div>
  );
}

// حقل واحد: عنوان + الحقل + رسالة الخطأ
function Field({ label, required, error, wide, children }) {
  return (
    <div className={`pf-field${wide ? " pf-field--wide" : ""}${error ? " has-error" : ""}`}>
      <span className="pf-label">
        {label}
        {required && <b className="pf-req"> *</b>}
      </span>
      {children}
      {error && <small className="pf-error">{error}</small>}
    </div>
  );
}

function PersonProfile({ person, lineage, canEdit, onClose, onSave }) {
  const [draft, setDraft] = useState(() => buildDraft(person));
  const [submitted, setSubmitted] = useState(false);

  // الأخطاء بتظهر بعد أول محاولة حفظ، وبعدها بتتحدث مع الكتابة
  const errors = submitted && canEdit ? validate(draft) : {};
  const fullName = lineage.join(" ");

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  const setSocial = (key, value) =>
    setDraft((d) => ({ ...d, socials: { ...(d.socials || {}), [key]: value } }));

  // تغيير الحالة الاجتماعية: لو متزوج ومفيش زوجات نضيف واحدة تلقائياً
  const setMarital = (value) =>
    setDraft((d) => ({
      ...d,
      maritalStatus: value,
      spouses:
        value === "married" && d.spouses.length === 0
          ? [{ name: "", children: [] }]
          : d.spouses,
    }));

  const editSpouses = (fn) => setDraft((d) => ({ ...d, spouses: fn(d.spouses) }));

  const patchSpouse = (si, patch) =>
    editSpouses((list) => list.map((s, j) => (j === si ? { ...s, ...patch } : s)));

  const removeSpouse = (si) => editSpouses((list) => list.filter((_, j) => j !== si));

  const addSpouse = () =>
    editSpouses((list) => (list.length < MAX_SPOUSES ? [...list, { name: "", children: [] }] : list));

  const patchChild = (si, ci, patch) =>
    editSpouses((list) =>
      list.map((s, j) =>
        j !== si
          ? s
          : { ...s, children: s.children.map((c, k) => (k === ci ? { ...c, ...patch } : c)) }
      )
    );

  const addChild = (si) =>
    editSpouses((list) =>
      list.map((s, j) =>
        j !== si ? s : { ...s, children: [...s.children, { name: "", gender: "male" }] }
      )
    );

  const removeChild = (si, ci) =>
    editSpouses((list) =>
      list.map((s, j) =>
        j !== si ? s : { ...s, children: s.children.filter((_, k) => k !== ci) }
      )
    );

  // Esc بيقفل النافذة
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setSubmitted(true);
    if (Object.keys(validate(draft)).length) return;
    const { name, ...profile } = cleanDraft(draft);
    onSave(name, profile);
  };

  const showSpecialization = SPECIALIZED.includes(draft.educationLevel);
  const showTitle = draft.educationLevel === "phd";
  const maxDate = new Date().toISOString().slice(0, 10);

  return createPortal(
    <div className="pf-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="pf-modal" role="dialog" aria-modal="true" onSubmit={submit} noValidate>
        <header className="pf-header">
          <Avatar gender={draft.gender} image={draft.image} name={draft.name || person.name} />          <div className="pf-header__info">
            <span className="pf-header__label">الاسم الكامل</span>
            <h2 className="pf-header__name">{fullName}</h2>
          </div>
          <button type="button" className="pf-close" onClick={onClose} aria-label="إغلاق">
            ×
          </button>
        </header>

        {!canEdit && (
          <p className="pf-readonly">وضع العرض فقط. فعّل التحرير من الشريط العلوي للتعديل.</p>
        )}

        <div className="pf-scroll">
          <fieldset className="pf-fieldset" disabled={!canEdit}>
            <div className="pf-body">
              <section className="pf-section">
                <h3 className="pf-section__title">الصورة الشخصية</h3>
                <PhotoField value={draft.image} name={draft.name} onChange={(v) => set("image", v)} />
              </section>
              <section className="pf-section">
                <h3 className="pf-section__title">البيانات الأساسية</h3>
                <div className="pf-grid">
                  <Field label="الاسم" required error={errors.name} wide>
                    <input className="pf-input" value={draft.name} onChange={(e) => set("name", e.target.value)} />
                  </Field>

                  <Field label="الأم" required error={errors.mother}>
                    <input className="pf-input" value={draft.mother} onChange={(e) => set("mother", e.target.value)} />
                  </Field>

                  <Field label="تاريخ الميلاد" required error={errors.birthDate}>
                    <input
                      type="date"
                      className="pf-input"
                      max={maxDate}
                      value={draft.birthDate}
                      onChange={(e) => set("birthDate", e.target.value)}
                    />
                  </Field>

                  <Field label="مكان الميلاد">
                    <input
                      className="pf-input"
                      value={draft.birthPlace}
                      onChange={(e) => set("birthPlace", e.target.value)}
                    />
                  </Field>

                  <Field label="تاريخ الوفاة" error={errors.deathDate}>
                    <input
                      type="date"
                      className="pf-input"
                      max={maxDate}
                      value={draft.deathDate}
                      onChange={(e) => set("deathDate", e.target.value)}
                    />
                  </Field>

                  <Field label="الجنس" required error={errors.gender}>
                    <div className="pf-chips">
                      {[["male", "ذكر"], ["female", "أنثى"]].map(([v, l]) => (
                        <label key={v} className={`pf-chip${draft.gender === v ? " is-on" : ""}`}>
                          <input type="radio" hidden checked={draft.gender === v} onChange={() => set("gender", v)} />
                          {l}
                        </label>
                      ))}
                    </div>
                  </Field>

                  <Field label="رقم الهوية" required error={errors.idNumber}>
                    <input
                      className="pf-input"
                      inputMode="numeric"
                      value={draft.idNumber}
                      onChange={(e) => set("idNumber", e.target.value)}
                    />
                  </Field>

                  <Field label="الإيميل" required error={errors.email}>
                    <input
                      type="email"
                      className="pf-input"
                      dir="ltr"
                      value={draft.email}
                      onChange={(e) => set("email", e.target.value)}
                    />
                  </Field>

                  <Field label="السكن الحالي" wide>
                    <input
                      className="pf-input"
                      value={draft.residence}
                      onChange={(e) => set("residence", e.target.value)}
                    />
                  </Field>
                </div>
              </section>

              <section className="pf-section">
                <h3 className="pf-section__title">وسائل التواصل</h3>
                <div className="pf-grid">
                  {SOCIALS.map((s) => (
                    <Field key={s.key} label={s.label}>
                      <input
                        className="pf-input"
                        dir="ltr"
                        placeholder={s.hint}
                        value={draft.socials?.[s.key] || ""}
                        onChange={(e) => setSocial(s.key, e.target.value)}
                      />
                    </Field>
                  ))}
                </div>
              </section>

              <section className="pf-section">
                <h3 className="pf-section__title">الحالة الاجتماعية</h3>
                <div className="pf-grid">
                  <Field label="الحالة" required error={errors.maritalStatus} wide>
                    <div className="pf-chips">
                      {[["single", "أعزب"], ["married", "متزوج"], ["divorced", "مطلق"]].map(([v, l]) => (
                        <label key={v} className={`pf-chip${draft.maritalStatus === v ? " is-on" : ""}`}>
                          <input type="radio" hidden checked={draft.maritalStatus === v} onChange={() => setMarital(v)} />
                          {l}
                        </label>
                      ))}
                    </div>
                  </Field>

                  {draft.maritalStatus === "married" && (
                    <div className="pf-spouses">
                      {draft.spouses.map((s, si) => (
                        <div className="pf-spouse" key={si}>
                          <div className="pf-spouse__head">
                            <span className="pf-spouse__no">الزوجة {si + 1}</span>
                            <button type="button" className="pf-icon-btn" aria-label="حذف الزوجة" onClick={() => removeSpouse(si)}>
                              ×
                            </button>
                          </div>

                          <input
                            className="pf-input"
                            placeholder="اسم الزوجة"
                            value={s.name}
                            onChange={(e) => patchSpouse(si, { name: e.target.value })}
                          />

                          <div className="pf-children-title">الأبناء والبنات</div>
                          {s.children.map((c, ci) => (
                            <div className="pf-child-row" key={ci}>
                              <input
                                className="pf-input"
                                placeholder="الاسم"
                                value={c.name}
                                onChange={(e) => patchChild(si, ci, { name: e.target.value })}
                              />
                              <select
                                className="pf-input"
                                value={c.gender}
                                onChange={(e) => patchChild(si, ci, { gender: e.target.value })}
                              >
                                <option value="male">ابن</option>
                                <option value="female">بنت</option>
                              </select>
                              <button type="button" className="pf-icon-btn" aria-label="حذف" onClick={() => removeChild(si, ci)}>
                                ×
                              </button>
                            </div>
                          ))}

                          <button type="button" className="pf-add" onClick={() => addChild(si)}>
                            + إضافة ابن / بنت
                          </button>
                        </div>
                      ))}

                      {draft.spouses.length < MAX_SPOUSES && (
                        <button type="button" className="pf-add" onClick={addSpouse}>
                          + إضافة زوجة
                        </button>
                      )}
                      {errors.spouses && <small className="pf-error">{errors.spouses}</small>}
                    </div>
                  )}
                </div>
              </section>

              <section className="pf-section">
                <h3 className="pf-section__title">التحصيل العلمي</h3>
                <div className="pf-grid">
                  <Field label="المستوى">
                    <select
                      className="pf-input"
                      value={draft.educationLevel}
                      onChange={(e) => set("educationLevel", e.target.value)}
                    >
                      {EDUCATION.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </Field>

                  {showSpecialization && (
                    <Field label="التخصص">
                      <input
                        className="pf-input"
                        list="pf-specializations"
                        value={draft.specialization}
                        onChange={(e) => set("specialization", e.target.value)}
                      />
                      <datalist id="pf-specializations">
                        {["هندسة", "طب", "صيدلة", "حاسوب", "إدارة أعمال", "محاسبة", "قانون", "تربية", "أدب", "علوم"].map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </Field>
                  )}

                  {showTitle && (
                    <Field label="اللقب العلمي">
                      <select
                        className="pf-input"
                        value={draft.academicTitle}
                        onChange={(e) => set("academicTitle", e.target.value)}
                      >
                        <option value="">اختر اللقب</option>
                        {ACADEMIC_TITLES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </Field>
                  )}

                  <Field label="شهادات علمية أخرى" wide>
                    <div className="pf-list">
                      {draft.certificates.map((c, i) => (
                        <div className="pf-row" key={i}>
                          <input
                            className="pf-input"
                            value={c}
                            placeholder="اسم الشهادة"
                            onChange={(e) =>
                              set(
                                "certificates",
                                draft.certificates.map((x, j) => (j === i ? e.target.value : x))
                              )
                            }
                          />
                          <button
                            type="button"
                            className="pf-icon-btn"
                            aria-label="حذف الشهادة"
                            onClick={() => set("certificates", draft.certificates.filter((_, j) => j !== i))}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button type="button" className="pf-add" onClick={() => set("certificates", [...draft.certificates, ""])}>
                        + إضافة شهادة
                      </button>
                    </div>
                  </Field>
                </div>
              </section>

              <section className="pf-section">
                <h3 className="pf-section__title">الخبرات</h3>
                <div className="pf-chips">
                  {EXPERIENCES.map((x) => {
                    const on = draft.experiences.includes(x);
                    return (
                      <label key={x} className={`pf-chip${on ? " is-on" : ""}`}>
                        <input
                          type="checkbox"
                          hidden
                          checked={on}
                          onChange={() =>
                            set(
                              "experiences",
                              on ? draft.experiences.filter((v) => v !== x) : [...draft.experiences, x]
                            )
                          }
                        />
                        {x}
                      </label>
                    );
                  })}
                </div>
              </section>

              <section className="pf-section">
                <h3 className="pf-section__title">نبذة عن الشخص</h3>
                <textarea
                  className="pf-input pf-textarea"
                  rows={6}
                  placeholder={"كل سطر نقطة، مثلاً:\nيعمل في ...\nيسكن في ..."}
                  value={draft.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </section>
            </div>
          </fieldset>
        </div>

        <footer className="pf-footer">
          <span className="pf-spacer" />
          <button type="button" className="pf-btn pf-btn--ghost" onClick={onClose}>
            {canEdit ? "إلغاء" : "إغلاق"}
          </button>
          {canEdit && (
            <button type="submit" className="pf-btn">
              حفظ البيانات
            </button>
          )}
        </footer>
      </form>
    </div>,
    document.body
  );
}

export default PersonProfile;