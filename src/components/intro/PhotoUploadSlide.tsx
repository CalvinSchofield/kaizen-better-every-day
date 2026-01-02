import { motion } from "framer-motion";
import { ProfilePhotoUpload } from "@/components/ProfilePhotoUpload";
import { useRepData } from "@/hooks/useRepData";

interface PhotoUploadSlideProps {
  title: string;
  description: string;
}

export const PhotoUploadSlide = ({
  title,
  description,
}: PhotoUploadSlideProps) => {
  const { repData } = useRepData();

  const handlePhotoUpdated = () => {
    // Photo is automatically saved by ProfilePhotoUpload
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center text-center max-w-md mx-auto"
    >
      <div className="mb-8">
        <ProfilePhotoUpload
          currentPhotoUrl={repData?.profile_photo_url}
          onPhotoUpdated={handlePhotoUpdated}
          name={repData?.name || "User"}
          size="lg"
          showRemoveButton={false}
        />
      </div>
      
      <h2 className="text-2xl font-bold mb-3">{title}</h2>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
      
      <p className="text-sm text-muted-foreground/70 mt-6">
        Tap the camera icon to upload
      </p>
    </motion.div>
  );
};
