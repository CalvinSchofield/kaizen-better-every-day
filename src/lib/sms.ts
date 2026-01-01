import { supabase } from "@/integrations/supabase/client";

const normalizePhoneForSms = (raw: string) => raw.trim().replace(/[^\d+]/g, "");
const digits10 = (raw: string) => raw.replace(/\D/g, "").slice(-10);

export const openRecruitSmsWithLeaderIfApplicable = async (params: {
  recruitPhone: string;
  teamId?: string | null;
  teamName?: string | null;
}) => {
  const recruitPhone = normalizePhoneForSms(params.recruitPhone);
  const recruitDigits = digits10(recruitPhone);

  // Determine leader user id from team, then phone from reps
  const { data: userRes } = await supabase.auth.getUser();
  const currentUserId = userRes.user?.id ?? null;

  let leaderUserId: string | null = null;
  if (params.teamId) {
    const { data: teamData } = await supabase
      .from("teams")
      .select("lead_user_id")
      .eq("id", params.teamId)
      .maybeSingle();
    leaderUserId = teamData?.lead_user_id ?? null;
  }

  // If I'm the leader, don't include myself in recipients.
  if (leaderUserId && currentUserId && leaderUserId === currentUserId) {
    window.location.href = `sms:${recruitPhone}`;
    return { isGroup: false, leaderPhone: null };
  }

  let leaderPhone: string | null = null;

  if (leaderUserId) {
    const { data: leaderRep } = await supabase
      .from("reps")
      .select("phone")
      .eq("user_id", leaderUserId)
      .maybeSingle();

    if (leaderRep?.phone) leaderPhone = normalizePhoneForSms(leaderRep.phone);
  }

  // Fallback: lookup leader by teamName (if team doesn't have lead_user_id set yet)
  if (!leaderPhone && params.teamName) {
    const { data: leaderRepByName } = await supabase
      .from("reps")
      .select("phone")
      .ilike("name", `%${params.teamName}%`)
      .maybeSingle();

    if (leaderRepByName?.phone) leaderPhone = normalizePhoneForSms(leaderRepByName.phone);
  }

  const leaderDigits = leaderPhone ? digits10(leaderPhone) : null;
  const canGroup = !!leaderPhone && !!leaderDigits && leaderDigits !== recruitDigits;

  window.location.href = canGroup
    ? `sms:${recruitPhone},${leaderPhone}`
    : `sms:${recruitPhone}`;

  return { isGroup: canGroup, leaderPhone: canGroup ? leaderPhone : null };
};
