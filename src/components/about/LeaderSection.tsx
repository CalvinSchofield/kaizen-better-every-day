import { motion } from "framer-motion";
import { Phone, Mail, Trophy, Target, Handshake, Key, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlurImage } from "@/components/ui/BlurImage";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

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

const trackRecord = [
  "5 years in the field (rookie → vet → leader)",
  "4× Dream Team Earner 🇺🇸",
  "#1 in Regional Growth (2025)",
  "Top 3 Upgrade Rep company-wide",
  "Top 3 Earnings Rep out of ~6,000 reps",
  "Highest Avg. PRMR among reps with 100+ sales",
  "2× Viper Champion",
  "Sevens Competition Winner",
];

const expectations = [
  "Honest feedback",
  "Real coaching, not hype",
  "High standards with real support",
  "A proven path to get prepared and get paid",
  "High quality trainings and tech to help you leverage what you can control — your attitude and effort",
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
          <h2 className="text-2xl font-bold">Meet the Leaders</h2>
          <p className="text-muted-foreground mt-2 text-base">
            Leadership that's approachable and proven
          </p>
        </motion.div>

        {/* Calvin - Area Director Full Bio */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-card rounded-3xl border border-border overflow-hidden mb-8"
        >
          {/* Header with photo */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-5">
              <BlurImage
                src="/images/about-team/calvin-schofield.jpeg"
                alt="Calvin Schofield"
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
                <h3 className="text-xl font-bold text-foreground">Calvin Schofield</h3>
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
          </div>

          {/* Track Record */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-primary" />
              <h4 className="font-bold text-foreground">Track Record</h4>
            </div>
            <ul className="space-y-2">
              {trackRecord.map((item, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-foreground mt-4 italic">
              I've done the job at a high level and I know what actually works on the doors.
            </p>
          </div>

          {/* What I Care About */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-primary" />
              <h4 className="font-bold text-foreground">What I Care About</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              My priorities are simple: my faith, my family, and my community.
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              Vivint has never been the end goal — it's been the vehicle. The flexibility, income, and opportunity this job provides has completely changed the trajectory of my career and my life.
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              What drives me now is helping others realize they're capable of far more than they think — and giving them a system that actually works.
            </p>
            <p className="text-sm text-foreground font-medium">
              I'll believe in you before you believe in yourself. And I'll hold you to your potential, not your comfort.
            </p>
          </div>

          {/* What You Can Expect */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-2 mb-4">
              <Handshake className="w-5 h-5 text-primary" />
              <h4 className="font-bold text-foreground">What You Can Expect From Me</h4>
            </div>
            <ul className="space-y-2">
              {expectations.map((item, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Closing Line */}
          <div className="p-6 bg-primary/5">
            <div className="flex items-start gap-3">
              <Key className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-foreground">
                If you're willing to work, stay coachable, and commit to the process — I'll go to bat for you.
              </p>
            </div>
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
