import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RARITY_PRIORITY } from "@/utils/badgeDefinitions";

export interface UserBadge {
  id: string;
  badgeId: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  iconEmoji: string;
  iconUrl: string | null;
  rarity: string;
  isHidden: boolean;
  rookieOnly: boolean;
  earnedAt: string;
  entryDate: string | null;
  metadata: Record<string, any>;
  sortOrder: number;
}

export interface BadgeDefinition {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  iconEmoji: string;
  iconUrl: string | null;
  rarity: string;
  isHidden: boolean;
  rookieOnly: boolean;
  sortOrder: number;
}

/**
 * Fetch all badge definitions (catalog)
 */
export const useBadgeDefinitions = () => {
  return useQuery({
    queryKey: ["badge-definitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("badge_definitions")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;

      return (data || []).map((d: any) => ({
        id: d.id,
        slug: d.slug,
        name: d.name,
        description: d.description,
        category: d.category,
        iconEmoji: d.icon_emoji,
        iconUrl: d.icon_url,
        rarity: d.rarity,
        isHidden: d.is_hidden,
        rookieOnly: d.rookie_only,
        sortOrder: d.sort_order,
      })) as BadgeDefinition[];
    },
    staleTime: 1000 * 60 * 30, // 30 min cache
  });
};

/**
 * Fetch badges earned by a specific user
 */
export const useUserBadges = (userId: string | null) => {
  return useQuery({
    queryKey: ["user-badges", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("user_badges")
        .select("*, badge_definitions(*)")
        .eq("user_id", userId);

      if (error) throw error;

      return (data || []).map((ub: any) => {
        const bd = ub.badge_definitions;
        return {
          id: ub.id,
          badgeId: ub.badge_id,
          slug: bd.slug,
          name: bd.name,
          description: bd.description,
          category: bd.category,
          iconEmoji: bd.icon_emoji,
          iconUrl: bd.icon_url,
          rarity: bd.rarity,
          isHidden: bd.is_hidden,
          rookieOnly: bd.rookie_only,
          earnedAt: ub.earned_at,
          entryDate: ub.entry_date,
          metadata: ub.metadata || {},
          sortOrder: bd.sort_order,
        } as UserBadge;
      });
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Get top N badges for a user, sorted by rarity (highest first), then most recent
 */
export const getTopBadges = (badges: UserBadge[], count: number = 2): UserBadge[] => {
  if (!badges.length) return [];

  // Deduplicate by slug — keep the most recent earned
  const bySlug = new Map<string, UserBadge>();
  for (const b of badges) {
    const existing = bySlug.get(b.slug);
    if (!existing || new Date(b.earnedAt) > new Date(existing.earnedAt)) {
      bySlug.set(b.slug, b);
    }
  }

  const unique = Array.from(bySlug.values());

  return unique
    .sort((a, b) => {
      const rarityDiff = (RARITY_PRIORITY[b.rarity] || 0) - (RARITY_PRIORITY[a.rarity] || 0);
      if (rarityDiff !== 0) return rarityDiff;
      return new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime();
    })
    .slice(0, count);
};

/**
 * Batch fetch top badges for multiple user IDs (for leaderboard overlay)
 */
export const useLeaderboardBadges = (userIds: string[]) => {
  return useQuery({
    queryKey: ["leaderboard-badges", userIds.sort().join(",")],
    queryFn: async () => {
      if (!userIds.length) return new Map<string, { emoji: string; name: string }[]>();

      const { data, error } = await supabase
        .from("user_badges")
        .select("user_id, badge_definitions(slug, name, icon_emoji, rarity, is_hidden)")
        .in("user_id", userIds);

      if (error) throw error;

      // Group by user and pick top 2
      const byUser = new Map<string, { slug: string; name: string; emoji: string; rarity: string; earnedAt: string }[]>();
      for (const row of data || []) {
        const bd = (row as any).badge_definitions;
        if (!bd) continue;
        const list = byUser.get(row.user_id) || [];
        list.push({
          slug: bd.slug,
          name: bd.name,
          emoji: bd.icon_emoji,
          rarity: bd.rarity,
          earnedAt: '',
        });
        byUser.set(row.user_id, list);
      }

      const result = new Map<string, { emoji: string; name: string; rarity: string }[]>();
      for (const [uid, badges] of byUser) {
        // Deduplicate by slug
        const uniqueBySlug = new Map<string, typeof badges[0]>();
        for (const b of badges) {
          if (!uniqueBySlug.has(b.slug)) uniqueBySlug.set(b.slug, b);
        }
        const sorted = Array.from(uniqueBySlug.values())
          .sort((a, b) => (RARITY_PRIORITY[b.rarity] || 0) - (RARITY_PRIORITY[a.rarity] || 0))
          .slice(0, 2);
        result.set(uid, sorted.map(b => ({ emoji: b.emoji, name: b.name, rarity: b.rarity })));
      }

      return result;
    },
    enabled: userIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });
};
