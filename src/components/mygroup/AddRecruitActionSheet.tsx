import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, Share2, Loader2, Copy, Check } from "lucide-react";
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
import { APP_BASE_URL, INVITE_SHARE_MESSAGE } from "@/utils/constants";

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
  const [showShareView, setShowShareView] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleAddToPipeline = () => {
    onOpenChange(false);
    navigate('/add-recruit');
  };

  const generateOrGetInviteLink = async (): Promise<string | null> => {
    if (inviteLink) return inviteLink;
    if (!userId) return null;
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
        const link = `${APP_BASE_URL}/auth?invite=${existing.code}`;
        setInviteLink(link);
        return link;
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
        const link = `${APP_BASE_URL}/auth?invite=${retryCode}`;
        setInviteLink(link);
        return link;
      }
      const link = `${APP_BASE_URL}/auth?invite=${code}`;
      setInviteLink(link);
      return link;
    } catch (error) {
      console.error('Error generating invite link:', error);
      toast({ title: "Error", description: "Failed to generate invite link.", variant: "destructive" });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShareKaizen = async () => {
    setShowShareView(true);
    const link = await generateOrGetInviteLink();
    if (!link) return;

    // Immediately open native share sheet if available
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Kaizen',
          text: INVITE_SHARE_MESSAGE,
          url: link,
        });
        hapticSuccess();
      } catch {
        // User cancelled — stay on share view so they can copy instead
      }
    }
  };

  const handleCopy = async () => {
    const link = inviteLink || (await generateOrGetInviteLink());
    if (!link) return;
    const fullText = `${INVITE_SHARE_MESSAGE}\n\n${link}`;
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
    const link = inviteLink || (await generateOrGetInviteLink());
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Kaizen',
          text: INVITE_SHARE_MESSAGE,
          url: link,
        });
        hapticSuccess();
      } catch {
        // cancelled
      }
    } else {
      handleCopy();
    }
  };

  const handleClose = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setTimeout(() => setShowShareView(false), 300);
    }
  };

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{showShareView ? "Share Kaizen" : "Add a Rep"}</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 pb-8 space-y-3">
          {!showShareView ? (
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
                    Track someone you're reaching out to or evaluating
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
                    Send your invite link — they'll auto-connect to you on signup
                  </p>
                </div>
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {INVITE_SHARE_MESSAGE}
              </p>
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
