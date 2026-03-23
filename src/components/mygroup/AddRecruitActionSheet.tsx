import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, Share2, Loader2, Copy, Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getSessionSafe } from "@/utils/authSession";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { useToast } from "@/hooks/use-toast";
import { hapticSuccess } from "@/utils/haptics";
import { APP_BASE_URL, INVITE_SHARE_MESSAGE } from "@/utils/constants";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { hasMinAccess, getRoleLabel, ROLE_HIERARCHY, ASSIGNABLE_ROLES, type AccessLevel } from "@/utils/roleHierarchy";

const generateShortCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const LATERAL_INVITE_MESSAGE =
  "Hey — I'm using Kaizen to manage my org. Join here and we'll get you set up with the right team 👇";

/** 
 * Full hierarchy of lateral invite roles (upline only).
 * Filtered at runtime based on the inviter's own access level — 
 * only roles strictly above theirs are shown.
 */
const LATERAL_INVITE_ROLES: AccessLevel[] = [
  'assistant_manager',
  'team_lead',
  'mgmt_group_lead',
  'senior_manager',
  'area_director',
  'regional',
  'sr_regional',
  'partner',
  'divisional',
  'corporate',
];

interface AddRecruitActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddRecruitActionSheet = ({ open, onOpenChange }: AddRecruitActionSheetProps) => {
  const navigate = useNavigate();
  const { userId } = useCurrentUserId();
  const { toast } = useToast();
  const { data: teamAccess } = useTeamAccess();
  const accessLevel = (teamAccess?.accessLevel || 'none') as AccessLevel;
  const canInviteLeaders = hasMinAccess(accessLevel, 'mgmt_group_lead');

  const [showShareView, setShowShareView] = useState(false);
  const [shareType, setShareType] = useState<'downline' | 'lateral'>('downline');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [lateralInviteLink, setLateralInviteLink] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Lateral invite role selection
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AccessLevel | ''>('');

  const handleAddToPipeline = () => {
    onOpenChange(false);
    navigate('/add-recruit');
  };

  const generateOrGetInviteLink = async (type: 'downline' | 'lateral', role?: string): Promise<string | null> => {
    // For lateral invites, always generate a new code since each has a unique role
    const cached = type === 'lateral' ? null : inviteLink;
    if (cached) return cached;
    if (!userId) return null;
    setIsGenerating(true);

    try {
      const { session } = await getSessionSafe();
      if (!session) {
        toast({ title: "Error", description: "Not authenticated. Please restart the app.", variant: "destructive" });
        return null;
      }

      // For downline invites, check for existing
      if (type !== 'lateral') {
        const { data: existing } = await supabase
          .from('invite_codes')
          .select('code')
          .eq('inviter_user_id', userId)
          .eq('is_active', true)
          .eq('invite_type', type)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing) {
          const link = `${APP_BASE_URL}/auth?invite=${existing.code}`;
          setInviteLink(link);
          return link;
        }
      }

      const code = generateShortCode();

      const insertData = {
        code,
        inviter_user_id: userId,
        is_active: true,
        invite_type: type,
        pre_assigned_role: (type === 'lateral' && role) ? role : null,
      };

      const { error } = await supabase
        .from('invite_codes')
        .insert(insertData);

      if (error) {
        const retryCode = generateShortCode();
        const { error: retryError } = await supabase
          .from('invite_codes')
          .insert({ ...insertData, code: retryCode });
        if (retryError) throw retryError;
        const link = `${APP_BASE_URL}/auth?invite=${retryCode}`;
        if (type === 'lateral') setLateralInviteLink(link);
        else setInviteLink(link);
        return link;
      }

      const link = `${APP_BASE_URL}/auth?invite=${code}`;
      if (type === 'lateral') setLateralInviteLink(link);
      else setInviteLink(link);
      return link;
    } catch (error) {
      console.error('Error generating invite link:', error);
      toast({ title: "Error", description: "Failed to generate invite link.", variant: "destructive" });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const currentMessage = shareType === 'lateral' ? LATERAL_INVITE_MESSAGE : INVITE_SHARE_MESSAGE;

  const handleShareKaizen = async () => {
    setShareType('downline');
    setShowShareView(true);
    const link = await generateOrGetInviteLink('downline');
    if (!link) return;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Kaizen', text: INVITE_SHARE_MESSAGE, url: link });
        hapticSuccess();
      } catch { /* User cancelled */ }
    }
  };

  const handleInviteLeader = () => {
    // Show role picker first, then generate link
    setShowRolePicker(true);
    setSelectedRole('');
  };

  const handleConfirmRoleAndShare = async () => {
    if (!selectedRole) {
      toast({ title: "Select a role", description: "Choose the role for the leader you're inviting.", variant: "destructive" });
      return;
    }

    setShowRolePicker(false);
    setShareType('lateral');
    setShowShareView(true);
    const link = await generateOrGetInviteLink('lateral', selectedRole);
    if (!link) return;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Kaizen', text: LATERAL_INVITE_MESSAGE, url: link });
        hapticSuccess();
      } catch { /* User cancelled */ }
    }
  };

  const handleCopy = async () => {
    const link = (shareType === 'lateral' ? lateralInviteLink : inviteLink) 
      || (await generateOrGetInviteLink(shareType, selectedRole || undefined));
    if (!link) return;
    const fullText = `${currentMessage}\n\n${link}`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      hapticSuccess();
      toast({ title: "Copied!", description: "Share message and link copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = fullText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      hapticSuccess();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareAgain = async () => {
    const link = (shareType === 'lateral' ? lateralInviteLink : inviteLink) 
      || (await generateOrGetInviteLink(shareType, selectedRole || undefined));
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Kaizen', text: currentMessage, url: link });
        hapticSuccess();
      } catch { /* cancelled */ }
    } else {
      handleCopy();
    }
  };

  const handleClose = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setTimeout(() => {
        setShowShareView(false);
        setShowRolePicker(false);
        setShareType('downline');
        setSelectedRole('');
      }, 300);
    }
  };

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {showRolePicker
              ? "Invite a Leader"
              : showShareView 
                ? (shareType === 'lateral' ? "Invite a Leader" : "Share Kaizen")
                : "Add a Rep"
            }
          </DrawerTitle>
        </DrawerHeader>
        <div className="p-4 pb-8 space-y-3">
          {showRolePicker ? (
            // Step 1 for lateral invites: Pick the role
            <>
              <p className="text-sm text-muted-foreground">
                What role does this leader hold? They'll be auto-approved with this role when they sign up.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AccessLevel)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select their role..." />
                  </SelectTrigger>
                  <SelectContent>
                    {LATERAL_INVITE_ROLES
                      .filter((role) => ROLE_HIERARCHY.indexOf(role) > ROLE_HIERARCHY.indexOf(accessLevel))
                      .map((role) => (
                        <SelectItem key={role} value={role}>
                          {getRoleLabel(role)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                They'll land in the app ready to set up their own teams and org structure.
                Their recruiter field will stay empty until their direct upline onboards.
              </p>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowRolePicker(false)}>
                  Back
                </Button>
                <Button className="flex-1" onClick={handleConfirmRoleAndShare} disabled={!selectedRole}>
                  Generate & Share
                </Button>
              </div>
            </>
          ) : !showShareView ? (
            <>
              <button
                onClick={handleAddToPipeline}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:bg-accent/50 transition-colors text-left"
              >
                <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Add to Pipeline</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Add someone you want to work with
                  </p>
                </div>
              </button>

              <button
                onClick={handleShareKaizen}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:bg-accent/50 transition-colors text-left"
              >
                <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Share2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Share Kaizen</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Send the app to your recruits
                  </p>
                </div>
              </button>

              {canInviteLeaders && (
                <button
                  onClick={handleInviteLeader}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Invite a Leader</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Help other leaders get started on Kaizen
                    </p>
                  </div>
                </button>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {currentMessage}
              </p>
              {shareType === 'lateral' && selectedRole && (
                <p className="text-xs text-primary bg-primary/10 rounded-lg px-3 py-2">
                  ✅ This link will auto-approve signups as <strong>{getRoleLabel(selectedRole)}</strong>. They'll set up their own org structure.
                </p>
              )}
              {isGenerating ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={handleCopy} variant="outline" className="flex-1 gap-2">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                  <Button onClick={handleShareAgain} className="flex-1 gap-2">
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
