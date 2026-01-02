import { motion } from "framer-motion";
import { Phone, Mail, Trophy, Target, Handshake, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <section className="py-16 px-4 bg-muted/30">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl font-bold">Meet Your Leader</h2>
          <p className="text-muted-foreground mt-2">
            The person who'll help you get there
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-card rounded-2xl border border-border overflow-hidden"
        >
          {/* Header with photo and contact */}
          <div className="p-6 pb-4">
            <div className="flex items-start gap-4">
              <img
                src="/images/about-team/calvin-schofield.jpeg"
                alt="Calvin Schofield"
                className="w-24 h-24 rounded-xl object-cover object-top"
              />
              <div className="flex-1">
                <h3 className="text-xl font-bold">Calvin Schofield</h3>
                <p className="text-sm text-primary font-medium">Area Director</p>
                
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    asChild
                  >
                    <a href="sms:469-715-7056">
                      <Phone className="w-3 h-3 mr-1.5" />
                      Text
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    asChild
                  >
                    <a href="mailto:Calvin.Schofield@vivint.com">
                      <Mail className="w-3 h-3 mr-1.5" />
                      Email
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Track Record */}
          <div className="px-6 py-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-primary" />
              <h4 className="font-semibold text-sm">Track Record</h4>
            </div>
            <ul className="space-y-1.5">
              {trackRecord.map((item, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-foreground mt-3 italic">
              I've done the job at a high level and I know what actually works on the doors.
            </p>
          </div>

          {/* What I Care About */}
          <div className="px-6 py-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-primary" />
              <h4 className="font-semibold text-sm">What I Care About</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              My priorities are simple: my faith, my family, and my community.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Vivint has never been the end goal — it's been the vehicle. The flexibility, income, and opportunity this job provides has completely changed the trajectory of my career and my life.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              What drives me now is helping others realize they're capable of far more than they think — and giving them a system that actually works.
            </p>
            <p className="text-sm text-foreground mt-2 font-medium">
              I'll believe in you before you believe in yourself. And I'll hold you to your potential, not your comfort.
            </p>
          </div>

          {/* What You Can Expect */}
          <div className="px-6 py-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <Handshake className="w-4 h-4 text-primary" />
              <h4 className="font-semibold text-sm">What You Can Expect From Me</h4>
            </div>
            <ul className="space-y-1.5">
              {expectations.map((item, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Closing */}
          <div className="px-6 py-4 border-t border-border bg-muted/50">
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
