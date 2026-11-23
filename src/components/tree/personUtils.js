// ألوان كل جيل (من الجذر لحد الأعمق)
export const LEVEL_COLORS = [
  { bg: "#dbeafe", bd: "#60a5fa", fg: "#1e3a8a" }, // المؤسسون
  { bg: "#e0e7ff", bd: "#818cf8", fg: "#312e81" }, // الأبناء
  { bg: "#fce7f3", bd: "#f472b6", fg: "#831843" }, // الأحفاد
  { bg: "#ccfbf1", bd: "#2dd4bf", fg: "#134e4a" }, // الجيل الرابع
  { bg: "#fef3c7", bd: "#fbbf24", fg: "#78350f" }, // الجيل الخامس
  { bg: "#ecfccb", bd: "#a3e635", fg: "#365314" }, // ما بعده
];

// الافتراضي: الجذر المعروض مفتوح، والباقي مقفول لحد ما تضغط
export const isNodeOpen = (expanded, id, depth, rootDepth = 0) =>
  expanded[id] ?? depth <= rootDepth;

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

// السنة من التاريخ (YYYY-MM-DD)
const yearOf = (d) => (d ? String(d).slice(0, 4) : "");

// سنين الميلاد والوفاة (للاستخدام لو احتجناها)
export const yearsText = (person) => {
  const b = yearOf(person?.profile?.birthDate);
  const d = yearOf(person?.profile?.deathDate);
  if (!b && !d) return "";
  return d ? `${b || "؟"} – ${d}` : `${b} –`;
};

// العمر الحالي للحي، أو العمر وقت الوفاة للمتوفى
export const ageText = (person) => {
  const b = person?.profile?.birthDate;
  const d = person?.profile?.deathDate;
  if (!b) return "";
  const start = new Date(b);
  const end = d ? new Date(d) : new Date();
  let age = end.getFullYear() - start.getFullYear();
  const m = end.getMonth() - start.getMonth();
  if (m < 0 || (m === 0 && end.getDate() < start.getDate())) age--;
  if (isNaN(age) || age < 0) return "";
  return d ? `توفي عن ${age}` : `العمر ${age}`;
};

// هل الشخص متوفى (له تاريخ وفاة)
export const isDeceased = (person) => !!person?.profile?.deathDate;

// عدد أفراد الفرع كله بما فيهم الشخص نفسه
export const countPeople = (person) =>
  1 + (person.children || []).reduce((s, c) => s + countPeople(c), 0);