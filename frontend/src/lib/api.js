import axios from "axios";

export const TOKEN_KEY = "ts_token";

const envBase = (typeof import.meta !== "undefined" && import.meta.env?.VITE_BACKEND_URL) || 
                 (typeof process !== "undefined" && process.env?.REACT_APP_BACKEND_URL) || "";
const apiBase = envBase ? `${envBase.replace(/\/+$/, "")}/api` : "/api";

export const api = axios.create({ baseURL: apiBase });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const url = err.config?.url || "";
    if (err.response?.status === 401 && !url.includes("/auth/login")) {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export function errMsg(e) {
  const d = e?.response?.data?.detail;
  if (d == null) return e?.message || "Terjadi kesalahan. Silakan coba lagi.";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  if (typeof d === "object" && d.message) return d.message;
  return String(d);
}

export async function downloadExcel(sheetId) {
  const r = await api.get(`/tally-sheets/${sheetId}/export`, { responseType: "blob" });
  const cd = r.headers["content-disposition"] || "";
  const m = cd.match(/filename="?([^"]+)"?/);
  const name = m ? m[1] : "TallySheet.xlsx";
  const url = URL.createObjectURL(r.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return name;
}
