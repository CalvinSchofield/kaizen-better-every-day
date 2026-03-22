import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, Link2, Loader2, Copy, Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { useToast } from "@/hooks/use-toast";
import { hapticSuccess } from "@/utils/haptics";

const generateShortCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

interface AddRecruitActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddRecruitActionSheet = ({ open, onOpenChange }: AddRecruitActionSheetProps) => {
  const navigate = useNavigate();
  const { userId } = useCurrentUserId();
  const { toast } = useToast();
  const [showInviteLink, setShowInviteLink] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleAddToPipeline = () => {
    onOpenChange(false);
    navigate('/add-recruit');
  };

  const handleInviteRep = async () => {
    setShowInviteLink(true);
    if (inviteLink) return; // Already generated
    if (!userId) return;
    setIsGenerating(true);

    try {
      const { data: existing } = await supabase
        .from('invite_codes')
        .select('code')
        .eq('inviter_user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        setInviteLink(`${window.location.origin}/auth?invite=${existing.code}`);
        return;
      }

      const code = generateShortCode();
      const { error } = await supabase
        .from('invite_codes')
        .insert({ code, inviter_user_id: userId, is_active: true });

      if (error) {
        const retryCode = generateShortCode();
        const { error: retryError } = await supabase
          .from('invite_codes')
          .insert({ code: retryCode, inviter_user_id: userId, is_active: true });
        if (retryError) throw retryError;
        setInviteLink(`${window.location.origin}/auth?invite=${retryCode}`);
      } else {
        setInviteLink(`${window.location.origin}/auth?invite=${code}`);
      }
    } catch (error) {
      console.error('Error generating invite link:', error);
      toast({ title: "Error", description: "Failed to generate invite link.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      hapticSuccess();
      toast({ title: "Link copied!", description: "Share this link with your recruits to get them on Kaizen." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = inviteLink;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      hapticSuccess();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (!inviteLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Kaizen',
          text: 'Join my team on Kaizen — the app to track and improve your sales performance.',
          url: inviteLink,
        });
        hapticSuccess();
      } catch {
        // User cancelled
      }
    } else {
      handleCopy();
    }
  };

  const handleClose = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      // Reset to initial view after closing
      setTimeout(() => setShowInviteLink(false), 300);
    }
  };

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{showInviteLink ? "Invite to Sign Up" : "Add a Rep"}</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 pb-8 space-y-3">
          {!showInviteLink ? (
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
                    Add someone you're reaching out to, evaluating, or tracking
                  </p>
                </div>
              </button>

              <button
                onClick={handleInviteRep}
                className="w-full flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:bg-accent/50 transition-colors text-left"
              >
                <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Link2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">Send Invite Link</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    They're on board — send a signup link to auto-connect them
                  </p>
                </div>
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Share this link with your rep. When they sign up, they'll automatically be linked to you.
              </p>
              {isGenerating ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : inviteLink ? (
                <div className="space-y-3">
                  <div className="bg-muted rounded-lg p-3 break-all">
                    <p className="text-sm font-mono">{inviteLink}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleCopy} variant="outline" className="flex-1 gap-2">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Copied!" : "Copy Link"}
                    </Button>
                    <Button onClick={handleShare} className="flex-1 gap-2">
                      <Share2 className="h-4 w-4" />
                      Share
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
