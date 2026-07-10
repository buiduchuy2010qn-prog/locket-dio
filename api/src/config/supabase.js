const { supabaseConfig } = require("./app.config");

/**
 * Supabase client — optional on Huy Locket self-host.
 * Without SUPABASE_URL + SERVICE_ROLE_KEY: safe no-op client (never throws).
 * Login / moments work with Free local plan; membership DB features are skipped.
 */
const url = (supabaseConfig.url || process.env.SUPABASE_URL || "").trim();
const key = (
  supabaseConfig.serviceRoleKey ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  ""
).trim();

const isSupabaseConfigured = Boolean(url && key);

/**
 * Chainable thenable stub: await supabase.from().select().eq().single()
 * always resolves to { data: null, error: null } without throwing.
 */
function createSupabaseStub() {
  const empty = { data: null, error: null, count: 0 };

  function makeChain() {
    const chain = {
      then(onFulfilled, onRejected) {
        return Promise.resolve(empty).then(onFulfilled, onRejected);
      },
      catch(onRejected) {
        return Promise.resolve(empty).catch(onRejected);
      },
      finally(onFinally) {
        return Promise.resolve(empty).finally(onFinally);
      },
    };
    return new Proxy(chain, {
      get(target, prop) {
        if (prop in target) return target[prop];
        // any builder method (.select, .eq, .single, .upsert, …) keeps chaining
        return () => makeChain();
      },
    });
  }

  return {
    from: () => makeChain(),
    rpc: () => Promise.resolve(empty),
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve(empty),
        download: () => Promise.resolve(empty),
        remove: () => Promise.resolve(empty),
      }),
    },
  };
}

let supabase = null;

if (isSupabaseConfigured) {
  // Lazy require so environments without the package still boot on stub path
  const { createClient } = require("@supabase/supabase-js");
  supabase = createClient(url, key);
  console.log(
    "[supabase] connected:",
    url.replace(/https?:\/\//, "").slice(0, 40),
  );
} else {
  console.warn(
    "[supabase] SUPABASE_URL / SERVICE_ROLE_KEY chưa set — dùng no-op stub (login Free vẫn OK).",
  );
  supabase = createSupabaseStub();
}

module.exports = {
  supabase,
  isSupabaseConfigured,
};
