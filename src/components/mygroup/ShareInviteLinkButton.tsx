import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSessionSafe } from "@/utils/authSession";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Share2, Copy, Check, Loader2 } from "lucide-react";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { hapticSuccess } from "@/utils/haptics";
import { APP_BASE_URL, INVITE_SHARE_MESSAGE } from "@/utils/constants";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

const generateShortCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const ShareInviteLinkButton = () => {
  const { userId } = useCurrentUserId();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateOrGetInviteLink = async () => {
    if (!userId) return;
    setIsGenerating(true);

    try {
      const { session } = await getSessionSafe();
      if (!session) return;

      const { data: existing } = await supabase
        .from('invite_codes')
        .select('code')
        .eq('inviter_user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        setInviteLink(`${APP_BASE_URL}/auth?invite=${existing.code}`);
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
        setInviteLink(`${APP_BASE_URL}/auth?invite=${retryCode}`);
      } else {
        setInviteLink(`${APP_BASE_URL}/auth?invite=${code}`);
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
    const fullText = `${INVITE_SHARE_MESSAGE}\n\n${inviteLink}`;
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

  const handleShare = async () => {
    if (!inviteLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Kaizen',
          text: INVITE_SHARE_MESSAGE,
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

  return (
    <Drawer open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (open) generateOrGetInviteLink();
    }}>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="h-4 w-4" />
          Share Kaizen
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Share Kaizen</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 pb-8 space-y-4">
          <p className="text-sm text-muted-foreground">
            {INVITE_SHARE_MESSAGE}
          </p>

          {isGenerating ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : inviteLink ? (
            <div className="flex gap-2">
              <Button onClick={handleCopy} variant="outline" className="flex-1 gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button onClick={handleShare} className="flex-1 gap-2">
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
