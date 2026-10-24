-- Optional one-off: skins saved before HTML rendering became the default carry an explicit
-- renderHtml=false that was the old default, not an author choice. Flip them on.
-- Authors can still turn it off per character in the skin editor afterwards.
update public.characters
   set skin = skin || '{"renderHtml": true}'::jsonb
 where skin ? 'renderHtml' and (skin->>'renderHtml') = 'false';
