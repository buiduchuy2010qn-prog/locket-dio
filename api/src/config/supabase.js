const { createClient } = require("@supabase/supabase-js");
const { supabaseConfig } = require("./app.config");

/**
 * Lazy / safe Supabase client.
 * Không có SUPABASE_URL → stub (server vẫn boot; plan/login Supabase sẽ fail rõ ràng).
 */
const url = supabaseConfig.url || process.env.SUPABASE_URL || "";
const key =
  supabaseConfig.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let supabase = null;

if (url && key) {
  supabase = createClient(url, key);
} else {
  console.warn(
    "[supabase] SUPABASE_URL / SERVICE_ROLE_KEY chưa set — dùng stub (health/weather vẫn chạy)."
  );
  // Proxy stub: mọi method throw message rõ
  const fail = () => {
    throw new Error(
      "Supabase chưa cấu hình. Thêm SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY vào .env"
    );
  };
  supabase = new Proxy(
    {},
    {
      get() {
        return fail;
      },
    }
  );
}

module.exports = {
  supabase,
  isSupabaseConfigured: Boolean(url && key),
};
