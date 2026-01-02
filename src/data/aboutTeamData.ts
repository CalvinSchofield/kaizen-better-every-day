import { 
  MessageSquare, 
  Shield, 
  Heart, 
  Clock, 
  Users, 
  MessageCircle, 
  Lightbulb, 
  Eye, 
  Brain, 
  Target, 
  Flag, 
  Crown,
  type LucideIcon
} from "lucide-react";

// Success Stories
export interface SuccessStory {
  id: string;
  name: string;
  photo: string;
  hook: string;
  age?: number;
  beforeStory: string;
  afterResult: string;
  earnings?: string;
  rhetoricalQuestion: string;
  youtubeUrl?: string;
}

export const successStories: SuccessStory[] = [
  {
    id: "christian",
    name: "Christian Fabian",
    photo: "/images/about-team/christian-fabian.png",
    hook: "18 years old. No experience. Six figures.",
    age: 18,
    beforeStory: "Christian and Javier were caught ding-dong ditching Vivint doorbell cameras six months before selling them.",
    afterResult: "This 18-year-old went on to make six figures this year and finished as the top rookie in the entire region—with no prior sales experience.",
    earnings: "$100k+",
    rhetoricalQuestion: "If he can do it at 18 with no sales experience, can you?",
    youtubeUrl: "https://www.youtube.com/embed/votRoVLUbO0"
  },
  {
    id: "javier",
    name: "Javier Estrada",
    photo: "/images/about-team/javier-estrada.png",
    hook: "From Target to record-setting rookie.",
    age: 19,
    beforeStory: "Javier was working at Target making $20/hour and building a mobile detailing company before knocking doors with Vivint.",
    afterResult: "This 19-year-old made $800 on his first blitz and never looked back. He sold a rookie-record 5 in a day during the summer season and ended up making $75k+ this summer.",
    earnings: "$75k+",
    rhetoricalQuestion: "Do you feel like you're hustling and spending all your time working and can't break free?",
    youtubeUrl: undefined
  },
  {
    id: "ansel",
    name: "Ansel Severson",
    photo: "/images/about-team/ansel-severson.jpg",
    hook: "Proposed in Hawaii. Paid for by Vivint.",
    beforeStory: "Ansel was a college student looking for a way to graduate debt-free while still having time for what matters most.",
    afterResult: "Ansel proposed to his now-fiancée on the free five-star Hawaii trip he earned for himself and a guest—all while making $70k+ in four months with no sales experience. Now he doesn't have to work during the school year.",
    earnings: "$70k+",
    rhetoricalQuestion: "Would a high income summer job help you get better grades and focus on those who matter most too?",
    youtubeUrl: "https://www.youtube.com/embed/ROrZpeL-UAA"
  },
  {
    id: "ammon",
    name: "Ammon Allan",
    photo: "/images/about-team/placeholder-avatar.jpg",
    hook: "College athlete. $100k+ in 5 months.",
    beforeStory: "Ammon was a college basketball player looking for a way to channel his competitiveness and work ethic into a high income opportunity.",
    afterResult: "Ammon applied the skills he developed playing sports—discipline, coachability, hard work, and positivity—to this opportunity and made $100k+ in 5 months with no prior sales experience.",
    earnings: "$100k+",
    rhetoricalQuestion: "Are you an athlete with similar attributes that misses competing at a high level?",
    youtubeUrl: "https://www.youtube.com/embed/-7aXnGXmasc"
  },
  {
    id: "levi",
    name: "Levi Tingey",
    photo: "/images/about-team/placeholder-avatar.jpg",
    hook: "High school grad. $40k in 3 months.",
    beforeStory: "Levi started the summer late graduating high school and had some time to kill before starting college.",
    afterResult: "He prepped well in the preseason and shortened the learning curve to hit the ground running, making $9k in a week during his short summer.",
    earnings: "$40k",
    rhetoricalQuestion: "Would you rather pickup a summer job that teaches you the skills of CEOs and millionaires while giving you an uncapped earning potential or work at a Chipotle?",
    youtubeUrl: "https://www.youtube.com/embed/chAVXv91kHg"
  }
];

// Transferable Skills
export interface TransferableSkill {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: "communication" | "mindset" | "execution" | "leadership";
}

export const transferableSkills: TransferableSkill[] = [
  {
    id: "communication",
    name: "Communication Under Pressure",
    description: "Learn to clearly explain ideas, read people, and adapt your message in real time.",
    icon: MessageSquare,
    category: "communication"
  },
  {
    id: "confidence",
    name: "Confidence (Earned, Not Fake)",
    description: "Build real confidence through repetition, feedback, and results — not hype.",
    icon: Shield,
    category: "mindset"
  },
  {
    id: "resilience",
    name: "Emotional Resilience",
    description: "Get comfortable with rejection and stay focused, motivated, and positive.",
    icon: Heart,
    category: "mindset"
  },
  {
    id: "discipline",
    name: "Discipline & Work Ethic",
    description: "Learn to show up daily, manage your time, and produce without supervision.",
    icon: Clock,
    category: "execution"
  },
  {
    id: "persuasion",
    name: "Persuasion & Influence",
    description: "Understand how people make decisions and how to ethically influence outcomes.",
    icon: Users,
    category: "communication"
  },
  {
    id: "objection-handling",
    name: "Objection Handling",
    description: "Listen, respond calmly, and turn resistance into productive conversations.",
    icon: MessageCircle,
    category: "communication"
  },
  {
    id: "problem-solving",
    name: "Problem Solving on the Fly",
    description: "Think quickly, adjust your approach, and find solutions in real time.",
    icon: Lightbulb,
    category: "execution"
  },
  {
    id: "social-awareness",
    name: "Social Awareness",
    description: "Read body language, tone, and context to connect with different personalities.",
    icon: Eye,
    category: "communication"
  },
  {
    id: "mental-toughness",
    name: "Mental Toughness",
    description: "Push through discomfort, fatigue, and doubt while staying consistent.",
    icon: Brain,
    category: "mindset"
  },
  {
    id: "accountability",
    name: "Accountability",
    description: "Own your results — good or bad — and learn to self-correct.",
    icon: Target,
    category: "execution"
  },
  {
    id: "goal-setting",
    name: "Goal Setting & Execution",
    description: "Set clear goals, track progress, and take daily action toward results.",
    icon: Flag,
    category: "execution"
  },
  {
    id: "leadership",
    name: "Leadership Foundations",
    description: "Learn how to take initiative, influence others, and lead by example.",
    icon: Crown,
    category: "leadership"
  }
];

// Earning Stats
export const earningStats = {
  teamRookieAverage: 48500,
  companyRookieAverage: 38000,
  biggestWeek: 11500,
  biggestDay: 5111,
  percentAboveAverage: 27
};

// Job Comparisons (4-month summer earnings)
export interface JobComparison {
  job: string;
  earnings: number;
}

export const jobComparisons: JobComparison[] = [
  { job: "Painter", earnings: 20656 },
  { job: "Construction", earnings: 19712 },
  { job: "Dental Assistant", earnings: 18792 },
  { job: "Customer Service", earnings: 17456 },
  { job: "Landscaper", earnings: 15728 },
  { job: "Bartender", earnings: 15336 },
  { job: "Server", earnings: 14752 },
  { job: "Retail", earnings: 13640 }
];

// Big Wins / Purchases
export interface BigWin {
  id: string;
  name: string;
  achievement: string;
  photo?: string;
}

export const bigWins: BigWin[] = [
  {
    id: "calvin",
    name: "Calvin",
    achievement: "Bought a cash-flowing investment property after his rookie year",
    photo: "/images/about-team/calvin-investment.jpeg"
  },
  {
    id: "misael",
    name: "Misael",
    achievement: "Retired his parents and bought a house",
    photo: undefined
  },
  {
    id: "stephen-property",
    name: "Stephen Kastner",
    achievement: "Bought an investment property",
    photo: undefined
  }
];

// Alumni Stories (Where Are They Now)
export interface AlumniStory {
  id: string;
  name: string;
  photo?: string;
  currentRole: string;
  story: string;
}

export const alumniStories: AlumniStory[] = [
  {
    id: "stephen",
    name: "Stephen Kastner",
    photo: undefined, // Placeholder until photo provided
    currentRole: "Founder, Zipsies",
    story: "Started his own company with his wife after learning the fundamentals of sales and business."
  },
  {
    id: "jay",
    name: "Jay Grijalva",
    photo: undefined, // Placeholder until photo provided
    currentRole: "Tire Shop Owner",
    story: "Raised money and purchased a cash-flowing tire shop while still in college."
  },
  {
    id: "josh",
    name: "Josh Guthrie",
    photo: "/images/about-team/josh-text.jpeg",
    currentRole: "Medical Device Sales",
    story: "Wanted to transition to medical sales—the job increased his offer because of the experience he earned with Vivint."
  }
];

// Team Accolades
export interface Accolade {
  id: string;
  title: string;
  subtitle?: string;
  icon: "trophy" | "medal" | "star" | "crown";
}

export const teamAccolades: Accolade[] = [
  {
    id: "viper",
    title: "VIPER Champions",
    subtitle: "2026",
    icon: "trophy"
  },
  {
    id: "sevens",
    title: "SEVENS Competition",
    subtitle: "Champions",
    icon: "medal"
  },
  {
    id: "100-club",
    title: "4 100+ Account Rookies",
    subtitle: "Elite performers",
    icon: "star"
  },
  {
    id: "dream-dream",
    title: "2 Dream Dream Rookies",
    subtitle: "Top tier achievers",
    icon: "crown"
  }
];

// Quick Stats for horizontal scroll
export interface QuickStat {
  id: string;
  value: string;
  label: string;
  highlight?: boolean;
}

export const quickStats: QuickStat[] = [
  { id: "avg", value: "$48.5k", label: "Avg Rookie Earnings", highlight: true },
  { id: "100-club", value: "4", label: "100+ Account Rookies" },
  { id: "week", value: "$11.5k", label: "Biggest Rookie Week" },
  { id: "day", value: "$5.1k", label: "Biggest Rookie Day" },
  { id: "viper", value: "🏆", label: "VIPER Champions 2026" },
  { id: "sevens", value: "🥇", label: "SEVENS Champions" },
  { id: "dream", value: "2", label: "Dream Dream Rookies" },
  { id: "trips", value: "5-Star", label: "Trips Earned" }
];

// Culture photos
export const culturePhotos = [
  {
    id: "dinner",
    src: "/images/about-team/team-dinner.jpeg",
    alt: "Team dinner celebration"
  },
  {
    id: "formal",
    src: "/images/about-team/team-formal.jpeg",
    alt: "Team formal event"
  }
];

// Hero content
export const heroContent = {
  backgroundImage: "/images/about-team/viper-champions.jpeg",
  title: "Kaizen",
  tagline: "Better Every Day.",
  subheadline: "A team built to develop elite performers — not just sell alarms.",
  statValue: "$48,512",
  statLabel: "average rookie earnings"
};

// Ding dong ditch video for Christian and Javier
export const dingDongDitchVideo = "/videos/ding-dong-ditch.mov";
