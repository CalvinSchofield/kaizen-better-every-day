
-- Badge definitions catalog
CREATE TABLE public.badge_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category text NOT NULL,
  icon_url text,
  icon_emoji text DEFAULT '🏅',
  rarity text DEFAULT 'common',
  is_hidden boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  rookie_only boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view badge definitions" ON public.badge_definitions FOR SELECT TO authenticated USING (true);

-- User badges tracking
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.badge_definitions(id) ON DELETE CASCADE,
  earned_at timestamptz DEFAULT now(),
  entry_date date,
  metadata jsonb DEFAULT '{}',
  UNIQUE(user_id, badge_id, entry_date)
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all badges" ON public.user_badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own badges" ON public.user_badges FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Seed: Daily FP+ milestones
INSERT INTO public.badge_definitions (slug, name, description, category, icon_emoji, rarity, sort_order) VALUES
('daily_fp_2', '2 FP+ Day', 'Score 2 FP+ in a single day', 'milestone', '⭐', 'common', 10),
('daily_fp_3', '3 FP+ Day', 'Score 3 FP+ in a single day', 'milestone', '🌟', 'common', 11),
('daily_fp_4', '4 FP+ Day', 'Score 4 FP+ in a single day', 'milestone', '💫', 'rare', 12),
('daily_fp_5', '5 FP+ Day', 'Score 5 FP+ in a single day', 'milestone', '🔥', 'rare', 13),
('daily_fp_6', '6 FP+ Day', 'Score 6 FP+ in a single day', 'milestone', '🔥', 'epic', 14),
('daily_fp_7', '7 FP+ Day', 'Score 7 FP+ in a single day', 'milestone', '🔥', 'epic', 15),
('daily_fp_8', '8 FP+ Day', 'Score 8 FP+ in a single day', 'milestone', '💎', 'epic', 16),
('daily_fp_9', '9 FP+ Day', 'Score 9 FP+ in a single day', 'milestone', '💎', 'legendary', 17),
('daily_fp_10', '10 FP+ Day', 'Score 10 FP+ in a single day', 'milestone', '👑', 'legendary', 18);

-- Seed: Weekly FP+ milestones
INSERT INTO public.badge_definitions (slug, name, description, category, icon_emoji, rarity, sort_order) VALUES
('weekly_fp_10', '10 FP+ Week', 'Score 10 FP+ in a week', 'milestone', '📈', 'common', 20),
('weekly_fp_15', '15 FP+ Week', 'Score 15 FP+ in a week', 'milestone', '📈', 'rare', 21),
('weekly_fp_20', '20 FP+ Week', 'Score 20 FP+ in a week', 'milestone', '🚀', 'rare', 22),
('weekly_fp_30', '30 FP+ Week', 'Score 30 FP+ in a week', 'milestone', '🚀', 'epic', 23),
('weekly_fp_40', '40 FP+ Week', 'Score 40 FP+ in a week', 'milestone', '💥', 'legendary', 24);

-- Seed: Weekly PRMR milestones
INSERT INTO public.badge_definitions (slug, name, description, category, icon_emoji, rarity, sort_order) VALUES
('weekly_prmr_1700', '$1,700 PRMR Week', 'Earn $1,700 PRMR in a week', 'milestone', '💵', 'common', 30),
('weekly_prmr_2550', '$2,550 PRMR Week', 'Earn $2,550 PRMR in a week', 'milestone', '💰', 'rare', 31),
('weekly_prmr_3400', '$3,400 PRMR Week', 'Earn $3,400 PRMR in a week', 'milestone', '🤑', 'epic', 32);

-- Seed: Season clubs (payscale tiers)
INSERT INTO public.badge_definitions (slug, name, description, category, icon_emoji, rarity, sort_order) VALUES
('club_20', '20 Club', 'Reach 20 FP+ in a season', 'club', '🏅', 'common', 100),
('club_40', '40 Club', 'Reach 40 FP+ in a season', 'club', '🏅', 'common', 101),
('club_60', '60 Club', 'Reach 60 FP+ in a season', 'club', '🥉', 'common', 102),
('club_80', '80 Club', 'Reach 80 FP+ in a season', 'club', '🥈', 'common', 103),
('club_100', '100 Club', 'Reach 100 FP+ in a season', 'club', '🥇', 'rare', 104),
('club_120', '120 Club', 'Reach 120 FP+ in a season', 'club', '🏆', 'rare', 105),
('club_140', '140 Club', 'Reach 140 FP+ in a season', 'club', '🏆', 'rare', 106),
('club_160', '160 Club', 'Reach 160 FP+ in a season', 'club', '🏆', 'epic', 107),
('club_200', '200 Club', 'Reach 200 FP+ in a season', 'club', '💎', 'epic', 108),
('club_240', '240 Club', 'Reach 240 FP+ in a season', 'club', '💎', 'epic', 109),
('club_300', '300 Club', 'Reach 300 FP+ in a season', 'club', '👑', 'legendary', 110),
('club_350', '350 Club', 'Reach 350 FP+ in a season', 'club', '👑', 'legendary', 111),
('club_400', '400 Club', 'Reach 400 FP+ in a season', 'club', '👑', 'legendary', 112),
('club_450', '450 Club', 'Reach 450 FP+ in a season', 'club', '👑', 'legendary', 113),
('club_500', '500 Club', 'Reach 500 FP+ in a season', 'club', '👑', 'legendary', 114),
('club_550', '550 Club', 'Reach 550 FP+ in a season', 'club', '👑', 'legendary', 115),
('club_600', '600 Club', 'Reach 600 FP+ in a season', 'club', '👑', 'legendary', 116);

-- Seed: Streak badges - transitions (rookie only)
INSERT INTO public.badge_definitions (slug, name, description, category, icon_emoji, rarity, sort_order, rookie_only) VALUES
('streak_transition_3', '3-Day Transition Streak', 'Get inside 3 days in a row', 'streak', '🔗', 'common', 200, true),
('streak_transition_5', '5-Day Transition Streak', 'Get inside 5 days in a row', 'streak', '🔗', 'common', 201, true),
('streak_transition_7', '7-Day Transition Streak', 'Get inside 7 days in a row', 'streak', '⛓️', 'rare', 202, true),
('streak_transition_10', '10-Day Transition Streak', 'Get inside 10 days in a row', 'streak', '⛓️', 'rare', 203, true),
('streak_transition_14', '14-Day Transition Streak', 'Get inside 14 days in a row', 'streak', '🔥', 'epic', 204, true),
('streak_transition_21', '21-Day Transition Streak', 'Get inside 21 days in a row', 'streak', '🔥', 'epic', 205, true),
('streak_transition_30', '30-Day Transition Streak', 'Get inside 30 days in a row', 'streak', '💎', 'legendary', 206, true);

-- Seed: Streak badges - presentations (rookie only)
INSERT INTO public.badge_definitions (slug, name, description, category, icon_emoji, rarity, sort_order, rookie_only) VALUES
('streak_presentation_3', '3-Day Presentation Streak', 'Give a presentation 3 days in a row', 'streak', '🎤', 'common', 210, true),
('streak_presentation_5', '5-Day Presentation Streak', 'Give a presentation 5 days in a row', 'streak', '🎤', 'common', 211, true),
('streak_presentation_7', '7-Day Presentation Streak', 'Give a presentation 7 days in a row', 'streak', '🎯', 'rare', 212, true),
('streak_presentation_10', '10-Day Presentation Streak', 'Give a presentation 10 days in a row', 'streak', '🎯', 'rare', 213, true),
('streak_presentation_14', '14-Day Presentation Streak', 'Give a presentation 14 days in a row', 'streak', '🔥', 'epic', 214, true),
('streak_presentation_21', '21-Day Presentation Streak', 'Give a presentation 21 days in a row', 'streak', '🔥', 'epic', 215, true),
('streak_presentation_30', '30-Day Presentation Streak', 'Give a presentation 30 days in a row', 'streak', '💎', 'legendary', 216, true);

-- Seed: Streak badges - sales
INSERT INTO public.badge_definitions (slug, name, description, category, icon_emoji, rarity, sort_order) VALUES
('streak_sales_3', '3-Day Sales Streak', 'Sell 3 days in a row', 'streak', '🔥', 'common', 220),
('streak_sales_5', '5-Day Sales Streak', 'Sell 5 days in a row', 'streak', '🔥', 'rare', 221),
('streak_sales_7', '7-Day Sales Streak', 'Sell 7 days in a row', 'streak', '💪', 'rare', 222),
('streak_sales_10', '10-Day Sales Streak', 'Sell 10 days in a row', 'streak', '💪', 'epic', 223),
('streak_sales_14', '14-Day Sales Streak', 'Sell 14 days in a row', 'streak', '⚡', 'epic', 224),
('streak_sales_21', '21-Day Sales Streak', 'Sell 21 days in a row', 'streak', '⚡', 'legendary', 225);

-- Seed: Multi-sale streaks
INSERT INTO public.badge_definitions (slug, name, description, category, icon_emoji, rarity, sort_order) VALUES
('streak_multi_2_3', '3-Day Double Sale Streak', 'Sell 2+ three days in a row', 'streak', '✌️', 'rare', 230),
('streak_multi_2_5', '5-Day Double Sale Streak', 'Sell 2+ five days in a row', 'streak', '✌️', 'epic', 231),
('streak_multi_3_3', '3-Day Triple Sale Streak', 'Sell 3+ three days in a row', 'streak', '🤟', 'epic', 232),
('streak_multi_4_3', '3-Day Quad Sale Streak', 'Sell 4+ three days in a row', 'streak', '🤯', 'legendary', 233);

-- Seed: Special / hidden badges
INSERT INTO public.badge_definitions (slug, name, description, category, icon_emoji, rarity, sort_order, is_hidden) VALUES
('first_door_magic', 'First Door Magic', 'Sell after knocking exactly 1 door', 'special', '🪄', 'rare', 300, true),
('night_owl', 'Night Owl', 'Knock a door after 9 PM and make a sale', 'special', '🦉', 'rare', 301, true),
('first_blood', 'First Blood', 'First sale on your team for the day', 'special', '🩸', 'rare', 302, true),
('one_two_combo', '1-2 Combo', 'FP+ and upgrade sale in the same day', 'special', '🥊', 'rare', 303, true),
('upgrade_assassin', 'Upgrade Assassin', '1+ FP+ worth of upgrades in a day', 'special', '🗡️', 'rare', 304, true);

-- Seed: Competition badges (placeholder)
INSERT INTO public.badge_definitions (slug, name, description, category, icon_emoji, rarity, sort_order) VALUES
('comp_dream_team', 'Dream Team', 'Dream Team member', 'competition', '⭐', 'legendary', 400),
('comp_the_cup', 'The Cup', 'The Cup winner', 'competition', '🏆', 'legendary', 401),
('comp_the_viper', 'The Viper', 'The Viper winner', 'competition', '🐍', 'epic', 402),
('comp_sevens', 'Sevens', 'Sevens winner', 'competition', '7️⃣', 'epic', 403),
('comp_premier_league', 'Premier League', 'Premier League winner', 'competition', '⚽', 'epic', 404);
