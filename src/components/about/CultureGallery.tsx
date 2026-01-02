import { motion } from "framer-motion";
import { culturePhotos } from "@/data/aboutTeamData";
import { Heart } from "lucide-react";

export const CultureGallery = () => {
  return (
    <section className="py-12 bg-background">
      <div className="max-w-lg mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold mb-2">More Than a Job</h2>
          <p className="text-muted-foreground">
            You're not just joining a team. You're joining a family.
          </p>
        </motion.div>
        
        {/* Photo grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {culturePhotos.map((photo, index) => (
            <motion.div
              key={photo.id}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative aspect-square rounded-2xl overflow-hidden"
            >
              <img 
                src={photo.src} 
                alt={photo.alt}
                className="w-full h-full object-cover"
              />
            </motion.div>
          ))}
        </div>
        
        {/* Quote card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl p-6 text-center border border-primary/20"
        >
          <Heart className="w-8 h-8 text-primary mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground italic mb-2">
            "This isn't just a summer job. It's a family that pushes you to become the best version of yourself."
          </p>
          <p className="text-sm text-muted-foreground">
            — What our rookies say
          </p>
        </motion.div>
      </div>
    </section>
  );
};
