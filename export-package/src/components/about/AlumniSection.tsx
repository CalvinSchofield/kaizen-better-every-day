import { motion } from "framer-motion";
import { alumniStories } from "@/data/aboutTeamData";
import { Rocket, User } from "lucide-react";
import { BlurImage } from "@/components/ui/BlurImage";

export const AlumniSection = () => {
  return (
    <section className="py-12 bg-muted/30">
      <div className="max-w-lg mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold mb-2">Where Are They Now?</h2>
          <p className="text-muted-foreground">
            This summer sets up your future. See what past reps built.
          </p>
        </motion.div>
        
        <div className="space-y-4">
          {alumniStories.map((alumni, index) => (
            <motion.div
              key={alumni.id}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-card rounded-2xl p-5 border border-border"
            >
              <div className="flex gap-4">
                {alumni.photo ? (
                  <BlurImage
                    src={alumni.photo}
                    alt={alumni.name}
                    loading="lazy"
                    containerClassName="w-16 h-16 rounded-xl flex-shrink-0"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    <User className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-foreground">{alumni.name}</h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Rocket className="w-3.5 h-3.5 text-primary" />
                    <span className="text-sm text-primary font-medium">
                      {alumni.currentRole}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {alumni.story}
                  </p>
                  
                  {/* Josh Guthrie text screenshot - inline in his card */}
                  {alumni.id === "josh" && (
                    <BlurImage
                      src="/images/about-team/josh-text.png"
                      alt="Josh's thank you text"
                      loading="lazy"
                      containerClassName="w-full rounded-lg border border-border mt-3"
                      className="w-full"
                    />
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
