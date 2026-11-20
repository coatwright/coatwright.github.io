/* Coatwright online settings. These values are public by design (security lives in Supabase's database rules). */
window.CW_CONFIG = {
  supabaseUrl: 'https://tbgcxcocnqbnmjnvncic.supabase.co',
  supabaseKey: 'sb_publishable_TpdyMrMfjVOV3C3pag9GhA_zlkJxa05',
  // Require an account before the trial. Switch on once ACCOUNTS_SETUP.md steps 1–3 are done.
  accounts: true,
  // Show "Continue with Google". Switch on once ACCOUNTS_SETUP.md step 4 is done.
  google: true,
  // Cloud backup & sync of jobs/settings to the painter's account (supabase/sync.sql run by the owner on 2026-11-20).
  sync: true,
  // Usage counts (actions only) and the owner dashboard. Switch on once supabase/analytics.sql has been run.
  analytics: false
};
