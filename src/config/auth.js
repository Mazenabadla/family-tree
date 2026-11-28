// حساب المشرف للتجربة.
// تحذير: هذه القيم تُقرأ من المتصفح، فالحماية مبدئية فقط.
// قبل أي نشر عام، ينبغي نقل التحقق إلى خادم.
export const ADMIN_USERNAME = "925495333";
export const ADMIN_PASSWORD = "htjpdhslsl63";

// يرجع { ok, reason }
export async function verifyAdmin(username, password) {
  if (username.trim() !== ADMIN_USERNAME) return { ok: false, reason: "invalid" };
  return password === ADMIN_PASSWORD
    ? { ok: true, reason: null }
    : { ok: false, reason: "invalid" };
}
