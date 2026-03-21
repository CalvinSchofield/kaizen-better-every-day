import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Share2, Copy, Check, Loader2 } from "lucide-react";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { hapticSuccess } from "@/utils/haptics";
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
      // Check if user already has an active invite code
      const { data: existing } = await supabase
        .from('invite_codes')
        .select('code')
        .eq('inviter_user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        const link = `${window.location.origin}/auth?invite=${existing.code}`;
        setInviteLink(link);
        return;
      }

      // Generate new invite code
      const code = generateShortCode();
      const { error } = await supabase
        .from('invite_codes')
        .insert({
          code,
          inviter_user_id: userId,
          is_active: true,
        });

      if (error) {
        // Code collision - try once more
        const retryCode = generateShortCode();
        const { error: retryError } = await supabase
          .from('invite_codes')
          .insert({
            code: retryCode,
            inviter_user_id: userId,
            is_active: true,
          });
        if (retryError) throw retryError;
        setInviteLink(`${window.location.origin}/auth?invite=${retryCode}`);
      } else {
        setInviteLink(`${window.location.origin}/auth?invite=${code}`);
      }
    } catch (error) {
      console.error('Error generating invite link:', error);
      toast({
        title: "Error",
        description: "Failed to generate invite link.",
        variant: "destructive",
      });
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
      toast({
        title: "Link copied!",
        description: "Share this link with your recruits to get them on Kaizen.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for mobile
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
        // User cancelled share
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
          Invite Rep
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Invite a Rep to Kaizen</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 pb-8 space-y-4">
          <p className="text-sm text-muted-foreground">
            Share this link with anyone you want to add to your team. When they sign up, they'll automatically be linked to you as their recruiter.
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
        </div>
      </DrawerContent>
    </Drawer>
  );
};
