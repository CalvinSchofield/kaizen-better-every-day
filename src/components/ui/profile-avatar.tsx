import { useNavigate } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getInitials } from "@/utils/nameUtils";

interface ProfileAvatarProps {
  userId: string;
  name?: string;
  photoUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
  onBeforeNavigate?: () => void;
}

/**
 * Avatar that navigates to /profile/:userId on tap.
 * Use `onBeforeNavigate` to close drawers/sheets before navigating.
 */
export const ProfileAvatar = ({
  userId,
  name,
  photoUrl,
  className,
  fallbackClassName,
  onBeforeNavigate,
}: ProfileAvatarProps) => {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onBeforeNavigate?.();
    // Small delay to let drawer close animation start
    setTimeout(() => {
      navigate(`/profile/${userId}`);
    }, 150);
  };

  return (
    <Avatar
      className={cn("cursor-pointer active:scale-95 transition-transform", className)}
      onClick={handleClick}
    >
      {photoUrl && <AvatarImage src={photoUrl} />}
      <AvatarFallback className={fallbackClassName}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
};
