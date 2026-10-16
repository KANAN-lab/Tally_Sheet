const TZ = "Asia/Jakarta";

function parts(iso, opts) {
  const d = new Date(iso);
  const p = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour12: false, ...opts })
    .formatToParts(d)
    .forEach((x) => (p[x.type] = x.value));
  return p;
}

export function fmtDateTime(iso) {
  if (!iso) return "-";
  const p = parts(iso, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}`;
}

export function fmtDate(ymd) {
  if (!ymd) return "-";
  const [y, m, d] = ymd.split("-");
  return `${d}-${m}-${y}`;
}

export function pctChange(cur, prev) {
  if (!prev) return cur ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

export function canEdit(sheet, user) {
  if (!sheet) return false;
  if (sheet.status !== "draft" && sheet.status !== "admin_hold") return false;
  return user?.role === "admin" || user?.role === "checker" || sheet.created_by === user?.id;
}

export function canCancel(sheet, user) {
  if (!sheet || sheet.status === "cancelled" || sheet.status === "completed") return false;
  return user?.role === "admin" || (sheet.status === "draft" && sheet.created_by === user?.id);
}

export function openPrint(id) {
  window.open(`/tally/${id}/print`, "_blank", "noopener");
}

export function formatTruckPlate(raw) {
  if (!raw) return "";
  let val = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
  val = val.replace(/^[^A-Z]+/, "");
  const match = val.match(/^([A-Z]{1,3})(\d{1,4})?([A-Z]{0,4})?/);
  if (match) {
    let formatted = match[1];
    if (match[2]) formatted += " " + match[2];
    if (match[3]) formatted += " " + match[3];
    return formatted;
  }
  return val.substring(0, 3);
}

