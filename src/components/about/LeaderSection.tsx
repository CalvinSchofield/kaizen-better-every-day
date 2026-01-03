import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { Phone, Mail, Trophy, Target, Handshake, Key, Crown } from "lucide-react";
import Autoplay from "embla-carousel-autoplay";
import { Button } from "@/components/ui/button";
import { BlurImage } from "@/components/ui/BlurImage";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  { name: "Calder Severson", photo: "/images/about-team/calder-severson.png" },
];

const trackRecord = [
  "5 years in the field (rookie → vet → leader)",
  "4× Dream Team Earner 🇺🇸",
  "Top 3 Earnings Rep out of ~6,000 reps",
  "Top 3 Upgrade Rep company-wide",
  "Highest Avg. PRMR among reps with 100+ sales",
  "#1 Growth in Region (2025)",
  "2× Viper Champion",
  "Sevens Competition Winner",
];

const expectations = [
  "Honest feedback",
  "Real coaching, not hype",
  "High standards with real support",
  "A proven path to get prepared and get paid",
  "Training that actually works and tech no other team has—so you can put all your energy into effort and mindset.",
];

export const LeaderSection = () => {
  const autoplayPlugin = useRef(
    Autoplay({ delay: 1000, stopOnInteraction: false, stopOnMouseEnter: false })
  );
  
  // Auto-expand Track Record when it scrolls into view (only once)
  const accordionRef = useRef<HTMLDivElement>(null);
  const hasAutoExpanded = useRef(false);
  const isInView = useInView(accordionRef, { once: true, margin: "-50px" });
  const [accordionValue, setAccordionValue] = useState<string | undefined>(undefined);
  
  useEffect(() => {
    if (isInView && !hasAutoExpanded.current) {
      const timer = setTimeout(() => {
        setAccordionValue("track-record");
        hasAutoExpanded.current = true;
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isInView]);

  return (
    <section className="py-16 bg-muted/30">
      <div className="max-w-lg mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-6"
        >
          <h2 className="text-2xl font-bold">Meet Your Leader</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            The person who'll be in your corner
          </p>
        </motion.div>

        {/* Calvin - Hero Card with Large Photo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-card rounded-3xl border border-border overflow-hidden mb-8 shadow-lg"
        >
          {/* Large Hero Image with Overlay */}
          <div className="relative">
            <BlurImage
              src="/images/about-team/calvin-schofield.jpeg"
              alt="Calvin Schofield"
              loading="eager"
              containerClassName="w-full aspect-[4/3]"
              className="w-full h-full object-cover object-[center_20%]"
            />
            
            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            
            {/* Name & Title Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Area Director
                </span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Calvin Schofield</h3>
              
              {/* Contact Buttons - Overlayed with high contrast */}
              <div className="flex gap-3">
                <Button
                  size="sm"
                  className="flex-1 h-12 bg-primary text-primary-foreground hover:bg-primary/90 border-0 font-semibold shadow-lg"
                  asChild
                >
                  <a href="sms:469-715-7056">
                    <Phone className="w-4 h-4 mr-2" />
                    Text Me
                  </a>
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-12 bg-white text-foreground hover:bg-white/90 border-0 font-semibold shadow-lg"
                  asChild
                >
                  <a href="mailto:Calvin.Schofield@vivint.com">
                    <Mail className="w-4 h-4 mr-2" />
                    Email
                  </a>
                </Button>
              </div>
            </div>
          </div>

          {/* Collapsible Sections */}
          <Accordion 
            ref={accordionRef}
            type="single" 
            collapsible 
            value={accordionValue} 
            onValueChange={setAccordionValue}
            className="w-full"
          >
            {/* Track Record */}
            <AccordionItem value="track-record" className="border-b border-border">
              <AccordionTrigger className="px-5 py-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Trophy className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-semibold text-foreground">Track Record</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5">
                <ul className="space-y-2.5 mb-4">
                  {trackRecord.map((item, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2.5">
                      <span className="text-primary font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-foreground font-medium italic border-l-2 border-primary pl-3">
                  I've done the job at a high level and I know what actually works on the doors.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* What I Care About */}
            <AccordionItem value="values" className="border-b border-border">
              <AccordionTrigger className="px-5 py-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Target className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-semibold text-foreground">What I Care About</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5 space-y-3">
                <p className="text-sm text-muted-foreground">
                  My priorities are simple: <span className="text-foreground font-medium">my faith, my family, and my community.</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Vivint has never been the end goal — it's been the vehicle. The flexibility, income, and opportunity this job provides has completely changed the trajectory of my career and my life.
                </p>
                <p className="text-sm text-muted-foreground">
                  What drives me now is helping others realize they're capable of far more than they think — and giving them a system that actually works.
                </p>
                <p className="text-sm text-foreground font-medium italic border-l-2 border-primary pl-3">
                  I'll believe in you before you believe in yourself. And I'll hold you to your potential, not your comfort.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* What You Can Expect */}
            <AccordionItem value="expectations" className="border-b border-border">
              <AccordionTrigger className="px-5 py-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Handshake className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-semibold text-foreground">What You Can Expect</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5">
                <ul className="space-y-2.5">
                  {expectations.map((item, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2.5">
                      <span className="text-primary font-bold">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Always-Visible Closing Line */}
          <div className="p-5 bg-primary/5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Key className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground leading-relaxed">
                If you're willing to work, stay coachable, and commit to the process — you got me in your corner. I don't take it lightly that you are trusting me with your time and effort. <span className="text-primary">Let's get to work 👊</span>
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
          loop: true,
        }}
        plugins={[autoplayPlugin.current]}
        className="w-full"
      >
        <CarouselContent className="ml-4">
          {teamLeads.map((leader) => (
            <CarouselItem key={leader.name} className="basis-auto pl-0 pr-3">
              <div className="text-center w-20">
                <BlurImage
                  src={leader.photo}
                  alt={leader.name}
                  loading="lazy"
                  containerClassName="w-16 h-16 mx-auto rounded-full border-2 border-border overflow-hidden"
                  className="w-full h-full object-cover"
                />
                <p className="text-xs font-medium mt-2 leading-tight">{leader.name}</p>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
};
