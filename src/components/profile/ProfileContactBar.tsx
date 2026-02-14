import { useState } from "react";
import { Phone, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostContactDrawer } from "@/components/mygroup/PostContactDrawer";
import { AddPhoneDrawer } from "@/components/ui/AddPhoneDrawer";
import { Recruit } from "@/hooks/useGroupRecruits";
import { hapticLight } from "@/utils/haptics";
import { motion } from "framer-motion";

interface ProfileContactBarProps {
  name: string;
  phone: string | null;
  userId: string;
  repId?: string;
  /** Only leaders with this user in their downline should log post-contact notes */
  canLog?: boolean;
}

/** Build a minimal Recruit stub for the PostContactDrawer */
function makeRecruitStub(name: string, phone: string, userId: string): Recruit {
  return {
    id: userId,
    name,
    phone,
    email: '',
    stage: 'Sold 💲',
    recruiterId: null,
    recruiterName: null,
    recruiterUserId: null,
    teamName: null,
    teamId: null,
    mgmtGroupId: null,
    mgmtGroupName: null,
    year: 'Rookie',
    location: null,
    recruitmentSource: null,
    lastContact: null,
    nextAction: null,
    nextActionDue: null,
    createdAt: new Date().toISOString(),
  };
}

export const ProfileContactBar = ({ name, phone, userId, repId, canLog = false }: ProfileContactBarProps) => {
  const [postContactOpen, setPostContactOpen] = useState(false);
  const [contactMethod, setContactMethod] = useState<'call' | 'text'>('call');
  const [addPhoneOpen, setAddPhoneOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'call' | 'text' | null>(null);
  const [currentPhone, setCurrentPhone] = useState(phone);

  const handleContact = (method: 'call' | 'text') => {
    hapticLight();
    if (!currentPhone) {
      setPendingAction(method);
      setAddPhoneOpen(true);
      return;
    }

    // Open native app
    const cleanPhone = currentPhone.replace(/\D/g, '');
    if (method === 'call') {
      window.open(`tel:${cleanPhone}`, '_self');
    } else {
      window.open(`sms:${cleanPhone}`, '_self');
    }

    // Show post-contact drawer after short delay (leaders only)
    if (canLog) {
      setContactMethod(method);
      setTimeout(() => setPostContactOpen(true), 500);
    }
  };

  const handlePhoneSaved = (cleanPhone: string) => {
    setCurrentPhone(cleanPhone);
    setAddPhoneOpen(false);
    if (pendingAction) {
      setTimeout(() => handleContact(pendingAction), 300);
      setPendingAction(null);
    }
  };

  const recruitStub = currentPhone ? makeRecruitStub(name, currentPhone, userId) : null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.12 }}
        className="mx-5 mb-4 rounded-2xl bg-card border border-border p-3"
      >
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl h-9 text-xs font-semibold gap-1.5"
            onClick={() => handleContact('call')}
          >
            <Phone className="h-3.5 w-3.5" />
            Call
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl h-9 text-xs font-semibold gap-1.5"
            onClick={() => handleContact('text')}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Text
          </Button>
        </div>
      </motion.div>

      <PostContactDrawer
        open={postContactOpen}
        onOpenChange={setPostContactOpen}
        recruit={recruitStub}
        contactMethod={contactMethod}
      />

      <AddPhoneDrawer
        open={addPhoneOpen}
        onOpenChange={setAddPhoneOpen}
        personName={name}
        repId={repId}
        recruitId={userId}
        pendingAction={pendingAction}
        onPhoneSaved={handlePhoneSaved}
      />
    </>
  );
};
