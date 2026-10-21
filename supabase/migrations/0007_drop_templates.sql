-- 0007: drop the prompt-templates feature (replaced by prompt presets). Idempotent.
drop table if exists public.prompt_templates cascade;
