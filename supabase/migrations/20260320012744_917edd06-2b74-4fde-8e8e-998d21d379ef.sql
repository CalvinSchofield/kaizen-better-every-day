DELETE FROM public.user_badges 
WHERE badge_id = (SELECT id FROM public.badge_definitions WHERE slug = 'night_owl');