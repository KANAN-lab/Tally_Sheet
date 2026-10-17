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

export function fmtTimeAgo(iso) {
  if (!iso) return "-";
  const now = new Date();
  const d = new Date(iso);
  const diffSec = Math.floor((now - d) / 1000);
  if (diffSec < 60) return "Baru saja";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return "Kemarin";
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return fmtDateTime(iso);
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

export function openBeritaAcaraPrint(id) {
  window.open(`/tally/${id}/print-ba`, "_blank", "noopener");
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

/**
 * Standard ISO 6346 Container Number Formatter:
 * 4 Uppercase Letters (Owner Code + Category 'U') + Space + 6 Serial Digits + Hyphen + 1 Check Digit
 * Example: TCLU 123456-7
 */
export function formatContainerNo(raw) {
  if (!raw) return "";
  let val = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const letters = val.replace(/[^A-Z]/g, "").slice(0, 4);
  const remaining = val.slice(letters.length);
  const digits = remaining.replace(/[^0-9]/g, "").slice(0, 7);

  if (letters.length === 0) {
    return val.slice(0, 4);
  }

  let formatted = letters;
  if (digits.length > 0) {
    const serial = digits.slice(0, 6);
    formatted += " " + serial;
    if (digits.length > 6) {
      const checkDigit = digits.slice(6, 7);
      formatted += "-" + checkDigit;
    }
  }
  return formatted;
}


