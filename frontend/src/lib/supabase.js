import { createClient } from "@supabase/supabase-js";
import { api } from "./api";

let supabaseClient = null;
let initPromise = null;

const DEFAULT_SUPABASE_URL = "https://jooffdovcomgyvvsftmf.supabase.co";

/**
 * Menginisialisasi Supabase Client secara dinamis (Build-time env atau Runtime config).
 * Menggunakan mode non-blocking agar tidak menghambat rendering aplikasi.
 */
export async function initSupabase() {
  if (supabaseClient) return supabaseClient;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    let url = (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) || DEFAULT_SUPABASE_URL;
    let anonKey = (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) || "";

    // Jika anonKey tidak diset di build-time, coba ambil dari endpoint konfigurasi publik backend
    if (!anonKey) {
      try {
        const res = await api.get("/config/public");
        if (res.data?.supabase_url) url = res.data.supabase_url;
        if (res.data?.supabase_anon_key) anonKey = res.data.supabase_anon_key;
      } catch {
        // Fallback diam
      }
    }

    if (url && anonKey) {
      try {
        supabaseClient = createClient(url, anonKey, {
          realtime: {
            params: {
              eventsPerSecond: 10
            }
          }
        });
        return supabaseClient;
      } catch (err) {
        console.warn("[Realtime] Gagal inisialisasi Supabase client:", err);
      }
    }

    return null;
  })();

  return initPromise;
}

export function getSupabaseSync() {
  return supabaseClient;
}
