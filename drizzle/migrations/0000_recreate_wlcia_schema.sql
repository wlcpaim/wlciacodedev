-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- conversations
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL DEFAULT 'Novo chat',
  is_pinned boolean NOT NULL DEFAULT false,
  title_generated boolean NOT NULL DEFAULT false,
  title_manual boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own conversations" ON public.conversations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX conversations_user_idx ON public.conversations(user_id, updated_at DESC);

-- messages
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages" ON public.messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX messages_conversation_idx ON public.messages(conversation_id, created_at);
CREATE INDEX messages_user_idx ON public.messages(user_id);

-- chat_versions
CREATE TABLE public.chat_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  slug text NOT NULL,
  base_version text NOT NULL DEFAULT 'wlc-1.5.6',
  chat_instruction text NOT NULL,
  copilot_instruction text NOT NULL,
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  repo_full_name text,
  github_path text,
  github_sha text,
  sync_error text,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_versions TO authenticated;
GRANT ALL ON public.chat_versions TO service_role;
ALTER TABLE public.chat_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chat_versions" ON public.chat_versions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- version_training_messages
CREATE TABLE public.version_training_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.chat_versions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.version_training_messages TO authenticated;
GRANT ALL ON public.version_training_messages TO service_role;
ALTER TABLE public.version_training_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own version_training_messages" ON public.version_training_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX vtm_version_idx ON public.version_training_messages(version_id, created_at);

-- code_projects
CREATE TABLE public.code_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  source text NOT NULL DEFAULT 'git',
  repo_full_name text,
  branch text,
  base_sha text,
  cf_project text,
  deploy_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.code_projects TO authenticated;
GRANT ALL ON public.code_projects TO service_role;
ALTER TABLE public.code_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own code_projects" ON public.code_projects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX code_projects_user_idx ON public.code_projects(user_id);

-- code_files
CREATE TABLE public.code_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.code_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  path text NOT NULL,
  content text NOT NULL DEFAULT '',
  base_content text,
  deleted boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, path)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.code_files TO authenticated;
GRANT ALL ON public.code_files TO service_role;
ALTER TABLE public.code_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own code_files" ON public.code_files FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX code_files_user_idx ON public.code_files(user_id);

-- code_project_backups
CREATE TABLE public.code_project_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.code_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  message text NOT NULL,
  files_snapshot jsonb NOT NULL,
  files_count integer NOT NULL DEFAULT 0,
  commit_sha text,
  parent_sha text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.code_project_backups TO authenticated;
GRANT ALL ON public.code_project_backups TO service_role;
ALTER TABLE public.code_project_backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own code_project_backups" ON public.code_project_backups FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX cpb_project_idx ON public.code_project_backups(project_id, created_at DESC);

-- gemini_keys
CREATE TABLE public.gemini_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  label text NOT NULL,
  google_project text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT 'gemini-2.5-flash-lite',
  key_ciphertext text NOT NULL,
  key_iv text NOT NULL,
  key_hint text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'unchecked',
  last_checked_at timestamptz,
  last_used_at timestamptz,
  last_error text,
  cooldown_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gemini_keys TO authenticated;
GRANT ALL ON public.gemini_keys TO service_role;
ALTER TABLE public.gemini_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own gemini_keys" ON public.gemini_keys FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX gemini_keys_user_idx ON public.gemini_keys(user_id);

-- github_connections (one per user)
CREATE TABLE public.github_connections (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  auth_type text NOT NULL DEFAULT 'pat',
  login text,
  display_name text,
  avatar_url text,
  html_url text,
  account_id bigint,
  email text,
  scopes text,
  token_ciphertext text NOT NULL,
  token_iv text NOT NULL,
  token_hint text NOT NULL,
  token_expires_at timestamptz,
  status text NOT NULL DEFAULT 'connected',
  last_checked_at timestamptz,
  last_error text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.github_connections TO authenticated;
GRANT ALL ON public.github_connections TO service_role;
ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own github_connections" ON public.github_connections FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- github_selection (one per user)
CREATE TABLE public.github_selection (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  repo_full_name text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.github_selection TO authenticated;
GRANT ALL ON public.github_selection TO service_role;
ALTER TABLE public.github_selection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own github_selection" ON public.github_selection FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- cloudflare_connections (one per user)
CREATE TABLE public.cloudflare_connections (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  account_id text NOT NULL,
  account_name text,
  token_ciphertext text NOT NULL,
  token_iv text NOT NULL,
  token_hint text,
  status text NOT NULL DEFAULT 'connected',
  last_checked_at timestamptz,
  last_error text,
  db_url text,
  db_key text,
  db_project_id text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cloudflare_connections TO authenticated;
GRANT ALL ON public.cloudflare_connections TO service_role;
ALTER TABLE public.cloudflare_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cloudflare_connections" ON public.cloudflare_connections FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- integration_runs
CREATE TABLE public.integration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  provider text NOT NULL,
  kind text NOT NULL,
  ok boolean NOT NULL DEFAULT false,
  key_id uuid,
  http_status integer,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_runs TO authenticated;
GRANT ALL ON public.integration_runs TO service_role;
ALTER TABLE public.integration_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own integration_runs" ON public.integration_runs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX integration_runs_user_idx ON public.integration_runs(user_id, created_at DESC);

-- integration_status
CREATE TABLE public.integration_status (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  provider text NOT NULL,
  auth_type text NOT NULL DEFAULT 'api_key',
  status text NOT NULL DEFAULT 'disconnected',
  last_checked_at timestamptz,
  last_used_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_status TO authenticated;
GRANT ALL ON public.integration_status TO service_role;
ALTER TABLE public.integration_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own integration_status" ON public.integration_status FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- system_events (live project feed)
CREATE TABLE public.system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  project_id text NOT NULL,
  source text NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_events TO authenticated;
GRANT ALL ON public.system_events TO service_role;
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own system_events" ON public.system_events FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX system_events_project_idx ON public.system_events(project_id, created_at);
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_events;

-- system_sessions
CREATE TABLE public.system_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_key text NOT NULL,
  active_project_id text,
  pending_plan jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_sessions TO authenticated;
GRANT ALL ON public.system_sessions TO service_role;
ALTER TABLE public.system_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own system_sessions" ON public.system_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at triggers
CREATE TRIGGER t_conversations_upd BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_chat_versions_upd BEFORE UPDATE ON public.chat_versions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_code_projects_upd BEFORE UPDATE ON public.code_projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_gemini_keys_upd BEFORE UPDATE ON public.gemini_keys FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_integration_status_upd BEFORE UPDATE ON public.integration_status FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Legacy identity map: original user id -> new sign-in. Server/DB only.
CREATE TABLE public.legacy_users (
  original_user_id uuid PRIMARY KEY,
  email text NOT NULL,
  display_name text,
  new_user_id uuid UNIQUE,
  claimed_at timestamptz,
  imported_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.legacy_users TO service_role;
ALTER TABLE public.legacy_users ENABLE ROW LEVEL SECURITY;
CREATE INDEX legacy_users_email_idx ON public.legacy_users(lower(email));

-- Claim: moves imported records to the signed-in user when their verified email uniquely matches.
CREATE OR REPLACE FUNCTION public.claim_legacy_account()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  v_email text;
  v_old uuid;
  n int;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('claimed', false, 'reason', 'not_signed_in'); END IF;
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = uid AND u.email_confirmed_at IS NOT NULL;
  IF v_email IS NULL THEN RETURN jsonb_build_object('claimed', false, 'reason', 'email_not_verified'); END IF;
  IF EXISTS (SELECT 1 FROM legacy_users WHERE new_user_id = uid) THEN RETURN jsonb_build_object('claimed', false, 'reason', 'already_claimed'); END IF;
  SELECT count(*) INTO n FROM legacy_users WHERE lower(email) = lower(v_email) AND new_user_id IS NULL;
  IF n <> 1 THEN RETURN jsonb_build_object('claimed', false, 'reason', CASE WHEN n = 0 THEN 'no_match' ELSE 'ambiguous' END); END IF;
  SELECT original_user_id INTO v_old FROM legacy_users WHERE lower(email) = lower(v_email) AND new_user_id IS NULL;

  -- single-row-per-user tables: the newer row the user already created wins
  DELETE FROM github_connections WHERE user_id = v_old AND EXISTS (SELECT 1 FROM github_connections WHERE user_id = uid);
  DELETE FROM github_selection WHERE user_id = v_old AND EXISTS (SELECT 1 FROM github_selection WHERE user_id = uid);
  DELETE FROM cloudflare_connections WHERE user_id = v_old AND EXISTS (SELECT 1 FROM cloudflare_connections WHERE user_id = uid);
  DELETE FROM integration_status o WHERE o.user_id = v_old AND EXISTS (SELECT 1 FROM integration_status x WHERE x.user_id = uid AND x.provider = o.provider);
  DELETE FROM system_sessions o WHERE o.user_id = v_old AND EXISTS (SELECT 1 FROM system_sessions x WHERE x.user_id = uid AND x.session_key = o.session_key);
  DELETE FROM chat_versions o WHERE o.user_id = v_old AND EXISTS (SELECT 1 FROM chat_versions x WHERE x.user_id = uid AND x.slug = o.slug);

  UPDATE conversations SET user_id = uid WHERE user_id = v_old;
  UPDATE messages SET user_id = uid WHERE user_id = v_old;
  UPDATE chat_versions SET user_id = uid WHERE user_id = v_old;
  UPDATE version_training_messages SET user_id = uid WHERE user_id = v_old;
  UPDATE code_projects SET user_id = uid WHERE user_id = v_old;
  UPDATE code_files SET user_id = uid WHERE user_id = v_old;
  UPDATE code_project_backups SET user_id = uid WHERE user_id = v_old;
  UPDATE gemini_keys SET user_id = uid WHERE user_id = v_old;
  UPDATE github_connections SET user_id = uid WHERE user_id = v_old;
  UPDATE github_selection SET user_id = uid WHERE user_id = v_old;
  UPDATE cloudflare_connections SET user_id = uid WHERE user_id = v_old;
  UPDATE integration_runs SET user_id = uid WHERE user_id = v_old;
  UPDATE integration_status SET user_id = uid WHERE user_id = v_old;
  UPDATE system_events SET user_id = uid WHERE user_id = v_old;
  UPDATE system_sessions SET user_id = uid WHERE user_id = v_old;

  UPDATE legacy_users SET new_user_id = uid, claimed_at = now() WHERE original_user_id = v_old;
  RETURN jsonb_build_object('claimed', true);
END; $$;
REVOKE ALL ON FUNCTION public.claim_legacy_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_legacy_account() TO authenticated;

-- Read-only schema inspector (structure of public tables)
CREATE OR REPLACE FUNCTION public.inspect_schema()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT jsonb_build_object(
    'database', current_database(),
    'version', current_setting('server_version'),
    'tables', COALESCE((
      SELECT jsonb_agg(t ORDER BY t->>'name') FROM (
        SELECT jsonb_build_object(
          'name', c.relname,
          'comment', obj_description(c.oid, 'pg_class'),
          'rls_enabled', c.relrowsecurity,
          'estimated_rows', GREATEST(c.reltuples, 0)::bigint,
          'columns', COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'name', a.attname,
              'type', format_type(a.atttypid, a.atttypmod),
              'nullable', NOT a.attnotnull,
              'default', pg_get_expr(d.adbin, d.adrelid)) ORDER BY a.attnum)
            FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
            WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped), '[]'::jsonb),
          'constraints', COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'name', co.conname, 'type', co.contype::text, 'definition', pg_get_constraintdef(co.oid)) ORDER BY co.conname)
            FROM pg_constraint co WHERE co.conrelid = c.oid), '[]'::jsonb),
          'indexes', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', i.indexname, 'definition', i.indexdef) ORDER BY i.indexname)
            FROM pg_indexes i WHERE i.schemaname = 'public' AND i.tablename = c.relname), '[]'::jsonb),
          'policies', COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'name', p.policyname, 'command', p.cmd, 'roles', to_jsonb(p.roles), 'using', p.qual, 'check', p.with_check) ORDER BY p.policyname)
            FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname), '[]'::jsonb)
        ) AS t
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      ) s
    ), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.inspect_schema() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inspect_schema() TO authenticated, service_role;

-- Migration runner used by the server-side database bot. Server only.
CREATE OR REPLACE FUNCTION public.exec_migration(p_sql text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_sql IS NULL OR length(trim(p_sql)) = 0 THEN RAISE EXCEPTION 'empty sql'; END IF;
  EXECUTE p_sql;
  RETURN jsonb_build_object('ok', true, 'executed_at', now());
END; $$;
REVOKE ALL ON FUNCTION public.exec_migration(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exec_migration(text) TO service_role;