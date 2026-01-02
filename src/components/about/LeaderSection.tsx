import { motion } from "framer-motion";
import { Phone, Mail, Trophy, Target, Handshake, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const trackRecord = [
  "5 years in the field (rookie → vet → leader)",
  "4× Dream Team Earner 🇺🇸",
  "Top 3 Earnings Rep out of ~6,000 reps",
  "Top 3 Upgrade Rep company-wide",
  "Highest Avg. PRMR among reps with 100+ sales",
  "#1 Growth in Region",
  "Sevens Competition Winner",
  "2× Viper Champion",
];

const expectations = [
  "Honest feedback",
  "Real coaching, not hype",
  "High standards with real support",
  "A proven path to get prepared and get paid",
  "High quality trainings and tech to leverage your attitude and effort",
];

export const LeaderSection = () => {
  return (
    <section className="py-16 px-4 bg-muted/30">
      <div className="max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-6"
        >
          <h2 className="text-2xl font-bold">Meet Your Leader</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            The person who'll help you get there
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-card rounded-2xl border border-border overflow-hidden"
        >
          {/* Large photo header */}
          <div className="relative aspect-[4/3] overflow-hidden">
            <img
              src="/images/about-team/calvin-schofield.jpeg"
              alt="Calvin Schofield"
              className="w-full h-full object-cover object-top"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-5 py-5">
              <h3 className="text-2xl font-bold text-white">Calvin Schofield</h3>
              <p className="text-primary font-medium">Area Director</p>
            </div>
          </div>

          {/* Contact buttons */}
          <div className="flex gap-2 p-4 border-b border-border">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-10"
              asChild
            >
              <a href="sms:469-715-7056">
                <Phone className="w-4 h-4 mr-2" />
                Text Me
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
                Email Me
              </a>
            </Button>
          </div>

          {/* Accordion sections */}
          <Accordion type="single" collapsible defaultValue="track-record" className="px-4">
            <AccordionItem value="track-record" className="border-b-border">
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">Track Record</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <ul className="space-y-1.5">
                  {trackRecord.map((item, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-foreground mt-3 italic">
                  I've done the job at a high level and I know what actually works on the doors.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="what-i-care-about" className="border-b-border">
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">What I Care About</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4 space-y-2 text-sm text-muted-foreground">
                <p>
                  My priorities are simple: my faith, my family, and my community.
                </p>
                <p>
                  Vivint has never been the end goal — it's been the vehicle. The flexibility, income, and opportunity this job provides has completely changed the trajectory of my career and my life.
                </p>
                <p>
                  What drives me now is helping others realize they're capable of far more than they think — and giving them a system that actually works.
                </p>
                <p className="text-foreground font-medium">
                  I'll believe in you before you believe in yourself. And I'll hold you to your potential, not your comfort.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="what-to-expect" className="border-b-0">
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Handshake className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">What You Can Expect</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <ul className="space-y-1.5">
                  {expectations.map((item, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Closing quote */}
          <div className="px-4 py-4 bg-muted/50 border-t border-border">
            <div className="flex items-start gap-2">
              <Quote className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm font-medium">
                If you're willing to work, stay coachable, and commit to the process — I'll go to bat for you.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
