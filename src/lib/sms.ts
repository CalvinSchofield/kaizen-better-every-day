import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const normalizePhoneForSms = (raw: string) => raw.trim().replace(/[^\d+]/g, "");
const toSmsRecipient = (raw: string) => raw.replace(/\D/g, "");
const digits10 = (raw: string) => toSmsRecipient(raw).slice(-10);

const isIOS = () => {
  const ua = navigator.userAgent || "";
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1)
  );
};

const debugEnabled = () => {
  try {
    return localStorage.getItem("debugGroupSms") === "1";
  } catch {
    return false;
  }
};

export const openRecruitSmsWithLeaderIfApplicable = async (params: {
  recruitPhone: string;
  teamId?: string | null;
  teamName?: string | null;
  leaderPhoneHint?: string | null;
}) => {
  const recruitPhone = normalizePhoneForSms(params.recruitPhone);
  const recruitRecipient = toSmsRecipient(recruitPhone);
  const recruitDigits = digits10(recruitPhone);

  const { data: userRes } = await supabase.auth.getUser();
  const currentUserId = userRes.user?.id ?? null;

  // Current user's phone (used to avoid adding yourself when you're the leader)
  let currentUserPhone: string | null = null;
  if (currentUserId) {
    const { data: meRep } = await supabase
      .from("reps")
      .select("phone")
      .eq("user_id", currentUserId)
      .maybeSingle();

    if (meRep?.phone) currentUserPhone = normalizePhoneForSms(meRep.phone);
  }

  let leaderUserId: string | null = null;

  // 1) Preferred: from teamId
  if (params.teamId) {
    const { data: teamData } = await supabase
      .from("teams")
      .select("lead_user_id")
      .eq("id", params.teamId)
      .maybeSingle();

    leaderUserId = teamData?.lead_user_id ?? null;
  }

  // 2) If we only have teamName, try to resolve the team row (more reliable than matching rep names)
  if (!leaderUserId && params.teamName) {
    const { data: teamByName } = await supabase
      .from("teams")
      .select("lead_user_id")
      .ilike("name", `%${params.teamName}%`)
      .maybeSingle();

    leaderUserId = teamByName?.lead_user_id ?? null;
  }

  // If I'm the leader, don't include myself in recipients.
  if (leaderUserId && currentUserId && leaderUserId === currentUserId) {
    window.location.href = `sms:${recruitRecipient}`;
    return { isGroup: false, leaderPhone: null };
  }

  let leaderPhone: string | null = null;

  // 3) Preferred leader phone: leader rep record
  if (leaderUserId) {
    const { data: leaderRep } = await supabase
      .from("reps")
      .select("phone")
      .eq("user_id", leaderUserId)
      .maybeSingle();

    if (leaderRep?.phone) leaderPhone = normalizePhoneForSms(leaderRep.phone);
  }

  // 4) Fallback: use hint from the recruit row (team_leader_phone), when available.
  if (!leaderPhone && params.leaderPhoneHint) {
    leaderPhone = normalizePhoneForSms(params.leaderPhoneHint);
  }

  const leaderDigits = leaderPhone ? digits10(leaderPhone) : null;
  const leaderRecipient = leaderPhone ? toSmsRecipient(leaderPhone) : null;

  // Secondary "I'm the leader" check (covers cases where we couldn't resolve leaderUserId)
  const currentUserDigits = currentUserPhone ? digits10(currentUserPhone) : null;
  if (leaderDigits && currentUserDigits && leaderDigits === currentUserDigits) {
    window.location.href = `sms:${recruitRecipient}`;
    return { isGroup: false, leaderPhone: null };
  }

  const isGroup = !!leaderRecipient && !!leaderDigits && leaderDigits !== recruitDigits;

  // iOS prefers commas; Android tends to prefer semicolons.
  const delimiter = isIOS() ? "," : ";";
  const smsUrl = isGroup
    ? `sms:${recruitRecipient}${delimiter}${leaderRecipient}`
    : `sms:${recruitRecipient}`;

  if (debugEnabled()) {
    console.log("[group-sms] recruit:", recruitRecipient, "teamId:", params.teamId, "teamName:", params.teamName);
    console.log("[group-sms] leaderUserId:", leaderUserId, "leaderPhone:", leaderPhone, "isGroup:", isGroup);
    console.log("[group-sms] url:", smsUrl);
    toast.message(isGroup ? "Group SMS (debug)" : "1:1 SMS (debug)", { description: smsUrl });
  }

  window.location.href = smsUrl;

  return { isGroup, leaderPhone: isGroup ? leaderPhone : null };
};


