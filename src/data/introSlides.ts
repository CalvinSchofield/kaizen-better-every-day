import { earningStats, successStories } from "./aboutTeamData";

export type SlideType = 'standard' | 'stat' | 'video' | 'image' | 'carousel' | 'cta' | 'photo-upload';
export type IconName = 'home' | 'map' | 'book-open' | 'target' | 'calendar' | 'camera' | 'sparkles' | 'users';

export interface IntroSlideConfig {
  id: string;
  type: SlideType;
  // Standard slide props
  iconName?: IconName;
  title: string;
  description: string;
  highlight?: string;
  // Stat slide props
  statValue?: number;
  statPrefix?: string;
  statSuffix?: string;
  statLabel?: string;
  // Video slide props
  videoThumbnail?: string;
  videoUrl?: string;
  // Image slide props
  imageSrc?: string;
  imageAlt?: string;
  overlayPosition?: 'top' | 'bottom' | 'center';
  // Carousel slide props
  carouselItems?: Array<{
    photo: string;
    name: string;
  }>;
  // CTA slide props
  ctaText?: string;
  showConfetti?: boolean;
}

// Team leads for carousel
const teamLeads = [
  { name: "Jose Pineda", photo: "/images/about-team/jose-pineda.jpeg" },
  { name: "John Ramer", photo: "/images/about-team/john-ramer.png" },
  { name: "Jack Mair", photo: "/images/about-team/jack-mair.png" },
  { name: "Henry Condie", photo: "/images/about-team/henry-condie.png" },
  { name: "Hunter Milne", photo: "/images/about-team/hunter-milne.png" },
];

// Get the first success story with a video for the testimonial
const featuredTestimonial = successStories.find(s => s.youtubeUrl) || successStories[0];

// Helper to strip emojis from text
export const stripEmojis = (text: string): string => {
  if (!text) return '';
  // Remove emojis and emoji modifiers
  return text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Symbols & Pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport & Map
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation Selectors
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess symbols
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Extended-A
    .trim();
};

export const getPreBlitzRookieSlides = (firstName: string): IntroSlideConfig[] => {
  const cleanName = stripEmojis(firstName) || 'there';
  
  return [
    // Phase 1: Emotional Buy-In
    {
      id: 'welcome',
      type: 'image',
      title: "Kaizen",
      description: "Better Every Day.\n\nA team built to develop elite performers — not just sell alarms.",
      imageSrc: "/images/about-team/hero-team.jpeg",
      imageAlt: "Kaizen team celebrating",
      overlayPosition: 'center',
      highlight: `Welcome, ${cleanName}!`
    },
    {
      id: 'stat-earnings',
      type: 'stat',
      title: "Rookie Average Earnings",
      description: "Our rookies don't just survive—they thrive. This is what average looks like on Kaizen.",
      statValue: earningStats.teamRookieAverage,
      statPrefix: "$",
      statSuffix: "",
      statLabel: "average rookie earnings"
    },
    {
      id: 'testimonial',
      type: 'video',
      title: featuredTestimonial.hook,
      description: featuredTestimonial.rhetoricalQuestion,
      videoThumbnail: featuredTestimonial.photo,
      videoUrl: featuredTestimonial.youtubeUrl,
    },
    {
      id: 'meet-calvin',
      type: 'image',
      title: "Meet Calvin",
      description: "Your Area Director has your back. He built this team to develop elite performers—not just sell alarms.",
      imageSrc: "/images/about-team/calvin.jpg",
      imageAlt: "Calvin Schofield - Area Director",
      overlayPosition: 'bottom',
    },
    {
      id: 'team-leads',
      type: 'carousel',
      title: "Surrounded by Winners",
      description: "These are your Team Leads. They've been in your shoes and they're here to help you succeed.",
      carouselItems: teamLeads,
    },

    // Phase 2: App Education
    {
      id: 'journey-home',
      type: 'standard',
      iconName: 'map',
      title: "Your Journey Starts Here",
      description: "Home is your roadmap. Follow the steps to get blitz-ready. Each step unlocks as you progress—just focus on what's next.",
      highlight: "Step by step"
    },
    {
      id: 'training-hub',
      type: 'standard',
      iconName: 'book-open',
      title: "Training Hub",
      description: "Study product knowledge, practice pitches, and complete trainings. Everything you need to prepare is right here.",
    },
    {
      id: 'pick-blitz',
      type: 'standard',
      iconName: 'calendar',
      title: "Pick Your Blitz",
      description: "View upcoming blitzes and commit to dates. Your first blitz is where it all starts—pick one that works for you.",
    },
    {
      id: 'set-goals',
      type: 'standard',
      iconName: 'target',
      title: "Dream Big",
      description: "Set your summer earnings goal. We'll help you build a plan to get there and track your progress along the way.",
      highlight: "What's your number?"
    },

    // Phase 3: Action
    {
      id: 'add-photo',
      type: 'standard',
      iconName: 'camera',
      title: "Add Your Photo",
      description: "Upload a profile photo so teammates can recognize you on leaderboards. Tap your name in the menu anytime.",
      highlight: "Stand out!"
    },
    {
      id: 'lets-go',
      type: 'cta',
      iconName: 'sparkles',
      title: "You're All Set!",
      description: "Your journey to becoming a top performer starts now. Let's make this summer legendary.",
      ctaText: "Let's Go!",
      showConfetti: true,
    },
  ];
};

// For vets, post-blitz rookies, and leaders - simpler flow focused on app features
export const getKnockingUserSlides = (firstName: string, isLeader: boolean): IntroSlideConfig[] => {
  const cleanName = stripEmojis(firstName) || 'there';
  
  const baseSlides: IntroSlideConfig[] = [
    {
      id: 'welcome',
      type: 'standard',
      iconName: 'home',
      title: `Welcome back, ${cleanName}!`,
      description: "Kaizen is your hub for tracking, insights, and team performance. Let's show you what's new.",
      highlight: "Let's get started"
    },
    {
      id: 'add-photo',
      type: 'photo-upload',
      iconName: 'camera',
      title: "Add Your Photo",
      description: "Upload a profile photo so teammates can recognize you on leaderboards and your team knows who you are!",
    },
  ];

  if (isLeader) {
    // Add leader-specific slides
    baseSlides.push({
      id: 'my-group',
      type: 'standard',
      iconName: 'users',
      title: "My Group",
      description: "Manage your recruiting pipeline. Track recruits, log contacts, and help them prepare for their first blitz.",
      highlight: "Build your team"
    });
  }

  baseSlides.push({
    id: 'lets-go',
    type: 'cta',
    iconName: 'sparkles',
    title: "You're All Set!",
    description: "Let's have a great season.",
    ctaText: "Let's Go!",
    showConfetti: true,
  });

  return baseSlides;
};
