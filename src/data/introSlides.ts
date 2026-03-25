import { successStories } from "./aboutTeamData";
import type { OnboardingSegment } from "@/hooks/useOnboardingSegment";

export type SlideType = 'standard' | 'stat' | 'video' | 'image' | 'carousel' | 'grid' | 'accolades' | 'cta' | 'photo-upload';
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
  // Grid slide props
  gridItems?: Array<{
    photo: string;
    name: string;
    isAreaDirector?: boolean;
  }>;
  // CTA slide props
  ctaText?: string;
  showConfetti?: boolean;
}

// All team leaders for grid display
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
  { name: "Calder Severson", photo: "/images/about-team/calder-severson.png" },
];

// Get the first success story with a video for the testimonial
const featuredTestimonial = successStories.find(s => s.youtubeUrl) || successStories[0];

// Helper to strip emojis from text
export const stripEmojis = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
    .trim();
};

/**
 * Get slides based on the user's onboarding segment:
 * 
 * - outside-org: No team/opportunity slides. Quick welcome → photo → done.
 * - in-org-vet: Quick welcome → photo → done. No opportunity sell.
 * - in-org-rookie-preseason: Full team/opportunity slides → photo → CTA to About Team.
 * - in-org-rookie-summer: Brief opportunity slides → photo → done.
 */
export const getSlidesBySegment = (segment: OnboardingSegment, firstName: string): IntroSlideConfig[] => {
  const cleanName = stripEmojis(firstName) || 'there';

  switch (segment) {
    case 'outside-org':
      return getOutsideOrgSlides(cleanName);
    case 'in-org-vet':
      return getInOrgVetSlides(cleanName);
    case 'in-org-rookie-preseason':
      return getInOrgRookiePreseasonSlides(cleanName);
    case 'in-org-rookie-summer':
      return getInOrgRookieSummerSlides(cleanName);
    default:
      return getOutsideOrgSlides(cleanName);
  }
};

/** Outside org (any year): minimal, straight to business */
const getOutsideOrgSlides = (cleanName: string): IntroSlideConfig[] => [
  {
    id: 'welcome',
    type: 'standard',
    iconName: 'home',
    title: `Welcome, ${cleanName}!`,
    description: "Kaizen helps you track your numbers, set goals, and stay on pace all season long.",
    highlight: "Let's get you set up"
  },
  {
    id: 'add-photo',
    type: 'photo-upload',
    iconName: 'camera',
    title: "Add Your Photo",
    description: "Upload a profile photo so teammates can recognize you on leaderboards.",
  },
  {
    id: 'lets-go',
    type: 'cta',
    iconName: 'sparkles',
    title: "You're All Set!",
    description: "Let's sync your numbers and set your goals.",
    ctaText: "Let's Go!",
    showConfetti: true,
  },
];

/** In-org soph/vet: quick welcome, no opportunity sell */
const getInOrgVetSlides = (cleanName: string): IntroSlideConfig[] => [
  {
    id: 'welcome',
    type: 'standard',
    iconName: 'home',
    title: `Welcome back, ${cleanName}!`,
    description: "Kaizen is your hub for tracking, insights, and team performance. Let's get you set up for the season.",
    highlight: "Let's get started"
  },
  {
    id: 'add-photo',
    type: 'photo-upload',
    iconName: 'camera',
    title: "Add Your Photo",
    description: "Upload a profile photo so teammates can recognize you on leaderboards and your team knows who you are!",
  },
  {
    id: 'lets-go',
    type: 'cta',
    iconName: 'sparkles',
    title: "You're All Set!",
    description: "Let's sync your numbers and set your goals.",
    ctaText: "Let's Go!",
    showConfetti: true,
  },
];

/** In-org rookie (preseason): full opportunity sell → team slides → photo → About Team */
const getInOrgRookiePreseasonSlides = (cleanName: string): IntroSlideConfig[] => [
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
    id: 'team-accolades',
    type: 'accolades',
    title: "Team Accolades",
    description: "A winning culture breeds winners. Here's what our team has accomplished.",
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
    id: 'meet-the-team',
    type: 'grid',
    title: "Meet Your Leaders",
    description: "This group of leaders has your back. They've been in your shoes and are here to help you succeed.",
    gridItems: allLeaders,
  },
  {
    id: 'add-photo',
    type: 'photo-upload',
    iconName: 'camera',
    title: "Add Your Photo",
    description: "Upload a profile photo so teammates can recognize you on leaderboards and your team knows who you are!",
  },
  {
    id: 'lets-go',
    type: 'cta',
    iconName: 'sparkles',
    title: "You're All Set!",
    description: "Learn more about the team, the opportunity, and what makes Kaizen different.",
    ctaText: "Meet the Team",
    showConfetti: true,
  },
];

/** In-org rookie (summer started): brief opportunity slides → photo → sync */
const getInOrgRookieSummerSlides = (cleanName: string): IntroSlideConfig[] => [
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
    id: 'team-accolades',
    type: 'accolades',
    title: "Team Accolades",
    description: "A winning culture breeds winners. Here's what our team has accomplished.",
  },
  {
    id: 'add-photo',
    type: 'photo-upload',
    iconName: 'camera',
    title: "Add Your Photo",
    description: "Upload a profile photo so teammates can recognize you on leaderboards and your team knows who you are!",
  },
  {
    id: 'lets-go',
    type: 'cta',
    iconName: 'sparkles',
    title: "You're All Set!",
    description: "Let's sync your numbers and set your goals.",
    ctaText: "Let's Go!",
    showConfetti: true,
  },
];

// ---- Legacy exports for backward compatibility (Settings replay) ----
export const getPreBlitzRookieSlides = (firstName: string): IntroSlideConfig[] => {
  return getInOrgRookiePreseasonSlides(stripEmojis(firstName) || 'there');
};

export const getKnockingUserSlides = (firstName: string, isLeader: boolean): IntroSlideConfig[] => {
  return getInOrgVetSlides(stripEmojis(firstName) || 'there');
};
