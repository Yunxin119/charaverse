-- 0007: drop the prompt-templates feature (replaced by SillyTavern-style presets). Idempotent.
drop table if exists public.prompt_templates cascade;
