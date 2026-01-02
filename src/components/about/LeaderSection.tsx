import { motion } from "framer-motion";
import { Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

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

const allLeaders = [
  { name: "Calvin Schofield", photo: "/images/about-team/calvin-schofield.jpeg", isAreaDirector: true },
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
    <section className="py-16 px-4 bg-muted/30">
      <div className="max-w-lg mx-auto">
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

        {/* Leaders Grid - 3 columns, 5 rows */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-3 gap-4"
        >
          {allLeaders.map((leader, index) => (
            <div
              key={leader.name}
              className="text-center"
            >
              <div className={`w-20 h-20 mx-auto rounded-full overflow-hidden border-2 ${leader.isAreaDirector ? 'border-primary' : 'border-border'} bg-muted`}>
                <img
                  src={leader.photo}
                  alt={leader.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-xs font-medium mt-2 leading-tight">{leader.name}</p>
              <span className="text-[10px] text-muted-foreground">
                {leader.isAreaDirector ? 'Area Director' : 'Team Lead'}
              </span>
            </div>
          ))}
        </motion.div>

        {/* Contact Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-8 bg-card rounded-2xl border border-border p-4"
        >
          <p className="text-center text-sm text-muted-foreground mb-4">
            Questions? Reach out to Calvin
          </p>
          <div className="flex gap-2">
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
      </div>
    </section>
  );
};
