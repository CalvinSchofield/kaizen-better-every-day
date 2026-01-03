import { motion } from "framer-motion";
import { Phone, Mail, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlurImage } from "@/components/ui/BlurImage";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

const areaDirector = {
  name: "Calvin Schofield",
  photo: "/images/about-team/calvin-schofield.jpeg",
};

const teamLeads = [
  { name: "Christian Fabian", photo: "/images/about-team/christian-fabian.png" },
  { name: "Adam Schofield", photo: "/images/about-team/adam-schofield.jpg" },
  { name: "Ansel Severson", photo: "/images/about-team/ansel-severson.png" },
  { name: "Ammon Allan", photo: "/images/about-team/ammon-allan.png" },
  { name: "RJ Ashton", photo: "/images/about-team/rj-ashton.jpg" },
  { name: "Quinn Gleed", photo: "/images/about-team/quinn-gleed.png" },
  { name: "Misael Sanchez", photo: "/images/about-team/misael-sanchez.png" },
  { name: "Micah Ao", photo: "/images/about-team/micah-ao.png" },
  { name: "Jose Pineda", photo: "/images/about-team/jose-pineda.jpg" },
  { name: "Javier Estrada", photo: "/images/about-team/javier-estrada.jpg" },
  { name: "Jack Mair", photo: "/images/about-team/jack-mair.png" },
  { name: "Ephraim Wilde", photo: "/images/about-team/ephraim-wilde.jpg" },
  { name: "Deandre Abraham", photo: "/images/about-team/deandre-abraham.png" },
  { name: "Calder Severson", photo: "/images/about-team/calder-severson.jpeg" },
];

export const LeaderSection = () => {
  return (
    <section className="py-16 bg-muted/30">
      <div className="max-w-lg mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <h2 className="text-2xl font-bold">Meet the Team</h2>
          <p className="text-muted-foreground mt-2 text-base">
            This group of leaders has your back
          </p>
        </motion.div>

        {/* Area Director Highlight */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-card rounded-3xl border border-primary/30 p-6 mb-8"
        >
          <div className="flex items-center gap-5">
            <BlurImage
              src={areaDirector.photo}
              alt={areaDirector.name}
              loading="lazy"
              containerClassName="w-24 h-24 rounded-2xl border-2 border-primary flex-shrink-0"
              className="w-full h-full object-cover object-[center_30%]"
            />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-primary uppercase tracking-wider">
                  Area Director
                </span>
              </div>
              <h3 className="text-xl font-bold text-foreground">{areaDirector.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Leading the Kaizen team to build elite performers
              </p>
            </div>
          </div>
          
          {/* Contact buttons */}
          <div className="flex gap-2 mt-5">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-10"
              asChild
            >
              <a href="sms:469-715-7056">
                <Phone className="w-4 h-4 mr-2" />
                Text
              </a>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-10"
              asChild
            >
              <a href="mailto:Calvin.Schofield@vivint.com">
                <Mail className="w-4 h-4 mr-2" />
                Email
              </a>
            </Button>
          </div>
        </motion.div>

        {/* Team Leads Label */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-sm font-medium text-muted-foreground mb-4"
        >
          Team Leads
        </motion.p>
      </div>

      {/* Team Leads Carousel */}
      <Carousel
        opts={{
          align: "start",
          dragFree: true,
        }}
        className="w-full"
      >
        <CarouselContent className="ml-4">
          {teamLeads.map((leader, index) => (
            <CarouselItem key={leader.name} className="basis-auto pl-0 pr-3">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="text-center w-20"
              >
                <BlurImage
                  src={leader.photo}
                  alt={leader.name}
                  loading="lazy"
                  containerClassName="w-16 h-16 mx-auto rounded-full border-2 border-border"
                  className="w-full h-full object-cover"
                />
                <p className="text-xs font-medium mt-2 leading-tight">{leader.name}</p>
              </motion.div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
};
