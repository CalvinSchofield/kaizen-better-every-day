// Static competitor data with local images for instant loading

export interface CompetitorData {
  id: string;
  name: string;
  category: "cameras" | "alarm" | "panels";
  image: string;
  ourSellingPoints: string[];
  theirSellingPoints: string[];
  objections: { objection: string; handle: string }[];
  monitoringCompanies?: string[];
  alternateVersions?: { name: string; image: string }[];
}

export const COMPETITORS: CompetitorData[] = [
  // ==================== CAMERAS ====================
  {
    id: "alarm-com-doorbell",
    name: "Alarm.com Doorbell",
    category: "cameras",
    image: "/images/competitors/alarm-com-doorbell.png",
    ourSellingPoints: [
      "Smart Deter — detect lurkers with light and whistle alerts",
      "24/7 Playback — record nonstop, not just clips",
      "Loads live video quick — shows up hands free on the panel",
      "High quality day/night vision",
      "Smart notifications — \"car\" or \"person detected\", not just motion",
      "Award-winning app that's easy to use",
      "We make and service equipment ourselves",
      "Warranty with free on-site visits",
    ],
    theirSellingPoints: [
      "Well known — Ring is what they know",
      "Works with their existing setup",
      "Professional install available",
    ],
    objections: [],
    alternateVersions: [
      { name: "Older Version", image: "/images/competitors/alarm-com-doorbell-older.jpg" },
      { name: "Oldest Version", image: "/images/competitors/alarm-com-doorbell-oldest.png" },
    ],
  },
  {
    id: "alarm-com-outdoor",
    name: "Alarm.com Outdoor Camera",
    category: "cameras",
    image: "/images/competitors/alarm-com-outdoor-camera.jpg",
    ourSellingPoints: [
      "Smart Deter — detect lurkers with light, whistle, flash to alert the whole street",
      "24/7 Playback — record nonstop, not just 30-second clips",
      "Loads live video quick on app and panel",
      "High quality day/night vision",
      "Smart notifications for cars and people, not just motion",
      "Award-winning app in one place",
      "We make and service our own equipment",
      "Free on-site visits and warranty",
    ],
    theirSellingPoints: [
      "Familiar with Alarm.com brand",
      "Works with existing monitoring",
      "Professional installation",
    ],
    objections: [],
    alternateVersions: [
      { name: "Newer Model", image: "/images/competitors/alarm-com-outdoor-camera-v2.jpg" },
      { name: "Spotlight Model", image: "/images/competitors/alarm-com-outdoor-spotlight.jpg" },
      { name: "Oldest Model", image: "/images/competitors/alarm-com-outdoor-camera-oldest.jpg" },
    ],
  },
  {
    id: "ring-doorbell",
    name: "Ring Doorbell",
    category: "cameras",
    image: "/images/competitors/ring-doorbell.png",
    ourSellingPoints: [
      "Smart Deter — we detect lurkers and deter with light/whistle before they act",
      "24/7 Playback — record everything, not just motion-triggered clips",
      "Faster load time — video shows up quickly on app and hands-free on panel",
      "Better night vision quality",
      "Smart AI notifications — \"person\" or \"car\", not just \"motion\"",
      "One integrated app for everything (cameras, locks, sensors)",
      "Professional monitoring included, not DIY",
      "We service equipment on-site for free",
    ],
    theirSellingPoints: [
      "Affordable upfront cost",
      "Easy DIY installation",
      "Works with Alexa ecosystem",
      "Neighborhood watch feature",
    ],
    objections: [
      {
        objection: "Ring is cheaper",
        handle: "Ring seems cheaper, but you're paying more over time with their subscription. Plus you get DIY with no professional monitoring. With us, everything is included and we come fix it if anything breaks.",
      },
      {
        objection: "I already have Ring",
        handle: "That's great, you already know you love having a doorbell camera! The difference is ours works smarter — it detects people lurking before they ring, records 24/7 instead of just clips, and everything shows up on one panel. Want to see how it compares?",
      },
    ],
  },
  {
    id: "ring-outdoor",
    name: "Ring Outdoor Camera",
    category: "cameras",
    image: "/images/competitors/ring-doorbell.png",
    ourSellingPoints: [
      "Smart Deter proactively warns intruders with light and sound",
      "24/7 continuous recording, not just motion clips",
      "Faster streaming to app and panel",
      "Superior night vision",
      "AI-powered alerts for people/cars/packages",
      "Professional 24/7 monitoring included",
      "On-site service warranty",
    ],
    theirSellingPoints: [
      "Lower upfront cost",
      "DIY friendly",
      "Amazon/Alexa integration",
    ],
    objections: [
      {
        objection: "Ring works fine for me",
        handle: "If Ring is working, that's a good start! But are you catching everything? With 24/7 recording you'll never miss a moment, and Smart Deter actually warns people away before they do anything. That's the upgrade.",
      },
    ],
  },
  {
    id: "ring-spotlight",
    name: "Ring Spotlight Camera",
    category: "cameras",
    image: "/images/competitors/ring-doorbell.png",
    ourSellingPoints: [
      "Smart Deter with light AND audio warnings, not just spotlight",
      "24/7 recording vs motion-triggered clips",
      "Professional monitoring responds if you don't",
      "One app for entire smart home",
      "Service warranty included",
    ],
    theirSellingPoints: [
      "Built-in spotlight deters",
      "Affordable",
      "DIY installation",
    ],
    objections: [],
  },
  {
    id: "arlo-outdoor",
    name: "Arlo Outdoor Camera",
    category: "cameras",
    image: "/images/competitors/arlo-outdoor-camera.jpg",
    ourSellingPoints: [
      "No battery charging hassle — wired power option",
      "24/7 continuous recording, not cloud-dependent clips",
      "Professional monitoring watches when you can't",
      "Smart Deter proactively warns people away",
      "One integrated system, not separate apps",
      "On-site service included",
    ],
    theirSellingPoints: [
      "Wire-free installation",
      "4K video quality",
      "Works standalone without hub",
    ],
    objections: [
      {
        objection: "Arlo has better video quality",
        handle: "4K is nice for marketing, but in reality you need cameras that reliably record everything and alert you when it matters. Our AI knows the difference between a car and a cat. Plus, what's the point of 4K if it only records clips?",
      },
    ],
  },
  {
    id: "blink-doorbell",
    name: "Blink Doorbell Camera",
    category: "cameras",
    image: "/images/competitors/blink-doorbell.jpg",
    ourSellingPoints: [
      "Smart Deter catches lurkers before they ring",
      "24/7 Playback — never miss anything",
      "Loads video quickly on app AND panel",
      "Professional monitoring included",
      "On-site service warranty",
      "One app for whole smart home",
    ],
    theirSellingPoints: [
      "Very affordable",
      "Long battery life",
      "Easy DIY setup",
    ],
    objections: [
      {
        objection: "Blink is so cheap though",
        handle: "You get what you pay for with Blink. It's budget for a reason — no 24/7 recording, no professional monitoring, and if something breaks you're on your own. This is about protecting your family, right?",
      },
    ],
  },
  {
    id: "blink-outdoor",
    name: "Blink Outdoor Camera",
    category: "cameras",
    image: "/images/competitors/blink-outdoor.jpg",
    ourSellingPoints: [
      "24/7 continuous recording vs clip-based",
      "Smart Deter with light and audio warnings",
      "Professional monitoring responds if you can't",
      "Faster live view loading",
      "Service warranty with on-site visits",
    ],
    theirSellingPoints: [
      "Budget friendly",
      "2-year battery life",
      "Wire-free",
    ],
    objections: [],
    alternateVersions: [
      { name: "Spotlight (Battery)", image: "/images/competitors/blink-spotlight-battery.jpg" },
      { name: "Spotlight (Wired)", image: "/images/competitors/blink-spotlight-wired.jpg" },
    ],
  },
  {
    id: "google-nest-doorbell",
    name: "Google Nest Doorbell",
    category: "cameras",
    image: "/images/competitors/google-nest-doorbell.jpg",
    ourSellingPoints: [
      "Smart Deter proactively warns before someone rings",
      "24/7 continuous recording vs 3-hour cloud history",
      "Professional monitoring watches when you can't",
      "Integrated panel for hands-free viewing",
      "On-site service included",
    ],
    theirSellingPoints: [
      "Google Assistant integration",
      "Good AI object detection",
      "Clean design",
    ],
    objections: [
      {
        objection: "I'm already in the Google ecosystem",
        handle: "Google makes great products, but security is different. When something happens, you want someone watching 24/7, not just recording to the cloud. Our cameras still work with Google Home, but now you have real protection backing them up.",
      },
    ],
    alternateVersions: [
      { name: "Wired Version", image: "/images/competitors/google-nest-doorbell.jpg" },
    ],
  },
  {
    id: "google-nest-outdoor",
    name: "Google Nest Outdoor Camera",
    category: "cameras",
    image: "/images/competitors/google-nest-doorbell.jpg",
    ourSellingPoints: [
      "24/7 Playback vs limited cloud history",
      "Smart Deter with light and audio warnings",
      "Professional monitoring response",
      "Faster video loading",
      "Panel integration",
      "Service warranty",
    ],
    theirSellingPoints: [
      "Google ecosystem",
      "Familiar faces recognition",
      "Activity zones",
    ],
    objections: [],
  },
  {
    id: "eufy-doorbell",
    name: "Eufy Doorbell Camera",
    category: "cameras",
    image: "/images/competitors/eufy-doorbell.jpg",
    ourSellingPoints: [
      "Professional 24/7 monitoring — not just local storage",
      "Smart Deter catches lurkers",
      "24/7 continuous recording",
      "Integrated with rest of smart home",
      "On-site service warranty",
    ],
    theirSellingPoints: [
      "No monthly fee (local storage)",
      "Good video quality",
      "AI detection",
    ],
    objections: [
      {
        objection: "Eufy has no monthly fees",
        handle: "That's because there's no one watching when you can't. If something happens at 3am, you're on your own with Eufy. We have pros monitoring 24/7 who can dispatch police even if you're asleep.",
      },
    ],
    alternateVersions: [
      { name: "Outdoor Camera", image: "/images/competitors/eufy-outdoor.jpg" },
      { name: "Outdoor 360", image: "/images/competitors/eufy-outdoor-360.jpg" },
    ],
  },
  {
    id: "reolink-doorbell",
    name: "Reolink Doorbell Camera",
    category: "cameras",
    image: "/images/competitors/reolink-doorbell.jpg",
    ourSellingPoints: [
      "Professional monitoring — someone always watching",
      "Smart Deter proactive deterrence",
      "24/7 recording included",
      "Integrated smart home system",
      "On-site service and warranty",
    ],
    theirSellingPoints: [
      "No subscription required",
      "Local NVR storage",
      "Good value",
    ],
    objections: [],
  },
  
  // ==================== ALARM SERVICES ====================
  {
    id: "adt",
    name: "ADT Monitoring Service",
    category: "alarm",
    image: "/images/competitors/adt-security.png",
    ourSellingPoints: [
      "Smart Deter — detect lurkers before they act, not just record",
      "24/7 Playback — record nonstop, not just clips",
      "Loads live video quick — shows up hands-free on panel",
      "High quality day/night vision",
      "Smart notifications — person/car detected, not just motion",
      "Top-rated app that's easy to use",
      "We make and service our own equipment",
      "Warranty with free on-site visits",
      "Usually $50-$70/month vs their higher rates",
      "Buyout in California is almost always doable",
    ],
    theirSellingPoints: [
      "Well known brand — family probably has it",
      "Professional install and monitoring",
      "Smarthome, cameras, and security integrated",
    ],
    objections: [
      {
        objection: "I'm already under contract with ADT",
        handle: "Contracts are usually buyout-able, especially in California. Let me check what it would take to get you out. Most of the time we can cover it or the upgrade is worth it.",
      },
      {
        objection: "ADT has been around forever",
        handle: "They have! But so has technology. ADT uses a lot of third-party equipment from different companies. We design, build, and service everything ourselves. One company means one call if anything needs fixing.",
      },
    ],
    monitoringCompanies: ["ADT", "Alarm.com"],
  },
  {
    id: "simplisafe",
    name: "SimpliSafe",
    category: "alarm",
    image: "/images/competitors/simplisafe.png",
    ourSellingPoints: [
      "Professional installation done right",
      "24/7 monitoring that actually responds",
      "Smart cameras with 24/7 recording, not clips",
      "Panel integration for hands-free control",
      "On-site service included",
      "Equipment warranty with free visits",
    ],
    theirSellingPoints: [
      "Easy DIY setup",
      "No long-term contract",
      "Affordable monthly",
    ],
    objections: [
      {
        objection: "SimpliSafe is month-to-month",
        handle: "Month-to-month sounds nice until you realize you're also on your own for setup, troubleshooting, and if anything breaks. We handle all of that and our tech is way smarter.",
      },
      {
        objection: "I don't want a contract",
        handle: "I get that. But think of it less as a contract and more as a commitment to actually having protection. DIY systems are great until there's a real emergency and you're trying to figure out why your sensor isn't working.",
      },
    ],
  },
  {
    id: "xfinity-security",
    name: "Xfinity Home Security",
    category: "alarm",
    image: "/images/competitors/xfinity-home-security.jpg",
    ourSellingPoints: [
      "Dedicated security company, not a side product",
      "Smart cameras with 24/7 recording",
      "Smart Deter proactive deterrence",
      "Faster app and panel response",
      "On-site service warranty",
      "Security is our only focus",
    ],
    theirSellingPoints: [
      "Bundle with internet/cable",
      "One bill",
      "Known brand",
    ],
    objections: [
      {
        objection: "I bundle it with my internet",
        handle: "Bundling is convenient, but security should be with a company that specializes in it. Xfinity is an internet company first. When something goes wrong, do you want to call the same place you call about your WiFi?",
      },
    ],
    monitoringCompanies: ["Xfinity"],
  },
  {
    id: "brinks",
    name: "Brinks Home Security",
    category: "alarm",
    image: "/images/competitors/brinks-security.png",
    ourSellingPoints: [
      "Smarter cameras with Smart Deter",
      "24/7 continuous recording, not clips",
      "Modern panel with faster response",
      "On-site service included",
      "We make our own equipment",
    ],
    theirSellingPoints: [
      "Professional monitoring",
      "Known brand",
      "Contract flexibility",
    ],
    objections: [],
    monitoringCompanies: ["Brinks"],
  },
  {
    id: "bay-alarm",
    name: "Bay Alarm",
    category: "alarm",
    image: "/images/competitors/bay-alarm.png",
    ourSellingPoints: [
      "Smart cameras with AI detection",
      "24/7 Playback recording",
      "Modern touchscreen panel",
      "One integrated app for everything",
      "On-site service and warranty",
    ],
    theirSellingPoints: [
      "Local company",
      "Long history",
      "Professional monitoring",
    ],
    objections: [],
    monitoringCompanies: ["Bay Alarm"],
  },

  // ==================== PANELS & EQUIPMENT ====================
  {
    id: "adt-panel",
    name: "ADT Panel",
    category: "panels",
    image: "/images/competitors/adt-security.png",
    ourSellingPoints: [
      "Bigger, modern touchscreen",
      "Shows camera feeds directly on panel",
      "Works with latest smart cameras",
      "Voice control built-in",
      "Faster processor for quick response",
    ],
    theirSellingPoints: [
      "Works with existing ADT service",
      "Professional installation",
    ],
    objections: [],
  },
  {
    id: "honeywell-panel",
    name: "Honeywell Panel",
    category: "panels",
    image: "/images/competitors/honeywell-panel.jpg",
    ourSellingPoints: [
      "Modern touchscreen vs keypad",
      "Camera integration on panel",
      "Works with smart home devices",
      "Faster, more intuitive interface",
      "On-site service warranty",
    ],
    theirSellingPoints: [
      "Reliable brand",
      "Long history",
      "Works with many monitoring companies",
    ],
    objections: [],
    monitoringCompanies: ["Various"],
  },
  {
    id: "iq-panel",
    name: "IQ Panel",
    category: "panels",
    image: "/images/competitors/iq-panel.jpg",
    ourSellingPoints: [
      "Our panel has built-in Smart Deter integration",
      "Seamless camera viewing on panel",
      "One unified app experience",
      "On-site service and warranty",
    ],
    theirSellingPoints: [
      "Modern touchscreen",
      "Works with many providers",
      "Good smart home integration",
    ],
    objections: [],
    monitoringCompanies: ["Qolsys", "Various"],
  },
  {
    id: "xfinity-panel",
    name: "Xfinity Panel",
    category: "panels",
    image: "/images/competitors/xfinity-panel.jpg",
    ourSellingPoints: [
      "Modern full touchscreen vs small display",
      "Camera feeds directly on panel",
      "Dedicated security company",
      "Smarter AI features",
      "On-site service included",
    ],
    theirSellingPoints: [
      "Bundles with internet",
      "One bill",
    ],
    objections: [],
    monitoringCompanies: ["Xfinity"],
  },
];

// Quick access for rookie-friendly competitors
export const ROOKIE_COMPETITORS = [
  "alarm-com-doorbell",
  "alarm-com-outdoor",
  "ring-doorbell",
  "ring-outdoor",
  "adt",
  "google-nest-doorbell",
  "ring-spotlight",
  "blink-outdoor",
];

export const getCompetitorById = (id: string): CompetitorData | undefined => {
  return COMPETITORS.find(c => c.id === id);
};

export const getCompetitorsByCategory = (category: "cameras" | "alarm" | "panels"): CompetitorData[] => {
  return COMPETITORS.filter(c => c.category === category);
};
