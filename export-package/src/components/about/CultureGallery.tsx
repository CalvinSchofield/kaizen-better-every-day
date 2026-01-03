import { motion } from "framer-motion";
import { culturePhotos } from "@/data/aboutTeamData";
import { Users } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { BlurImage } from "@/components/ui/BlurImage";

export const CultureGallery = () => {
  return (
    <section className="py-12 bg-background">
      <div className="max-w-lg mx-auto px-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl font-bold mb-2">More Than a Job</h2>
          <p className="text-muted-foreground">
            You're not just joining a team. You're joining a community.
          </p>
        </motion.div>
      </div>
      
      {/* Photo carousel */}
      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        className="w-full"
      >
        <CarouselContent className="ml-4">
          {culturePhotos.map((photo, index) => (
            <CarouselItem key={photo.id} className="basis-[85%] sm:basis-[70%] pl-0 pr-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative rounded-2xl overflow-hidden"
              >
                <BlurImage
                  src={photo.src}
                  alt={photo.alt}
                  loading="lazy"
                  containerClassName="aspect-[4/3]"
                  className="w-full h-full object-cover"
                />
                {photo.caption && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
                    <p className="text-white text-sm font-medium">{photo.caption}</p>
                  </div>
                )}
              </motion.div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      
      {/* Community message */}
      <div className="max-w-lg mx-auto px-4 mt-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl p-6 text-center border border-primary/20"
        >
          <Users className="w-8 h-8 text-primary mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground">
            Work hard. Have fun. Build lifelong friendships.
          </p>
        </motion.div>
      </div>
    </section>
  );
};
