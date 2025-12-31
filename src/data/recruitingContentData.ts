export type ContentCategory = 'all' | 'long-video' | 'short-video' | 'podcast' | 'website' | 'image';
export type ContentPlatform = 'youtube' | 'vimeo' | 'instagram' | 'spotify' | 'apple-podcasts' | 'web' | 'image';

export interface RecruitingContent {
  id: string;
  title: string;
  description: string;
  url: string;
  category: Exclude<ContentCategory, 'all'>;
  platform: ContentPlatform;
  imagePath?: string;
}

export const CATEGORY_LABELS: Record<ContentCategory, string> = {
  'all': 'All',
  'long-video': 'Long Videos',
  'short-video': 'Short Videos',
  'podcast': 'Podcasts',
  'website': 'Websites',
  'image': 'Images',
};

export const recruitingContent: RecruitingContent[] = [
  // Long Videos
  {
    id: 'long-1',
    title: 'Vivint Overview',
    description: 'Full company overview video',
    url: 'https://www.youtube.com/watch?v=066GXbTOAWA',
    category: 'long-video',
    platform: 'youtube',
  },
  {
    id: 'long-2',
    title: 'Company Story',
    description: 'The Vivint journey and mission',
    url: 'https://vimeo.com/651337313',
    category: 'long-video',
    platform: 'vimeo',
  },
  {
    id: 'long-3',
    title: 'Why Vivint Wins',
    description: 'Nobody is better positioned. Legitimacy, momentum - great for recruiting against other companies',
    url: 'https://vimeo.com/777489575',
    category: 'long-video',
    platform: 'vimeo',
  },
  {
    id: 'long-4',
    title: 'Leadership Vision',
    description: 'Executive perspective on the opportunity',
    url: 'https://vimeo.com/742321231',
    category: 'long-video',
    platform: 'vimeo',
  },
  {
    id: 'long-5',
    title: 'Success Stories',
    description: 'Real reps sharing their journey',
    url: 'https://vimeo.com/805597083',
    category: 'long-video',
    platform: 'vimeo',
  },
  {
    id: 'long-6',
    title: 'The Opportunity',
    description: 'Deep dive into what makes this work',
    url: 'https://vimeo.com/683868546',
    category: 'long-video',
    platform: 'vimeo',
  },
  {
    id: 'long-7',
    title: 'Smart Home Pros Review',
    description: 'Comprehensive look at the SHP program',
    url: 'https://vimeo.com/smarthomepros/review/954872893/98df15448c',
    category: 'long-video',
    platform: 'vimeo',
  },
  {
    id: 'long-8',
    title: 'The Full Picture',
    description: 'Everything you need to know',
    url: 'https://m.youtube.com/watch?v=bFIB05LGtMs',
    category: 'long-video',
    platform: 'youtube',
  },
  {
    id: 'long-9',
    title: 'Passion is Crap',
    description: 'Hard things are good - mindset shift for recruits',
    url: 'https://youtu.be/2jIia7aXins?si=ENG5VQRUlQlx17op',
    category: 'long-video',
    platform: 'youtube',
  },

  // Short Videos
  {
    id: 'short-1',
    title: 'Casey on Sales Skills',
    description: 'How valuable the skillset of sales is - always relevant',
    url: 'https://www.instagram.com/reel/DA7TVj5Nl3m/',
    category: 'short-video',
    platform: 'instagram',
  },
  {
    id: 'short-2',
    title: 'D2D is Personal Development',
    description: 'Door to door sales is personal growth',
    url: 'https://www.instagram.com/case.studies.podcast/reel/DA99WUTPxnh/',
    category: 'short-video',
    platform: 'instagram',
  },
  {
    id: 'short-3',
    title: 'Your "Dream Job"',
    description: 'Jordan Lewis challenges the dream job mentality',
    url: 'https://www.instagram.com/reel/DCR4xs-xnqi/',
    category: 'short-video',
    platform: 'instagram',
  },
  {
    id: 'short-4',
    title: "Cheyenne's Experience",
    description: 'Cheyenne Thatcher shares his story',
    url: 'https://www.instagram.com/reel/C---084SRay/',
    category: 'short-video',
    platform: 'instagram',
  },
  {
    id: 'short-5',
    title: 'For the Doubters',
    description: 'Learn to do hard things - good for skeptics',
    url: 'https://www.instagram.com/reel/C-LM9sVPqIu/',
    category: 'short-video',
    platform: 'instagram',
  },
  {
    id: 'short-6',
    title: 'Huge Opportunity',
    description: "The opportunity is massive but it's really hard",
    url: 'https://www.instagram.com/reel/C2dfnuQP_fM/',
    category: 'short-video',
    platform: 'instagram',
  },
  {
    id: 'short-7',
    title: '2 Million Customers',
    description: 'Scale and legitimacy of Vivint',
    url: 'https://www.instagram.com/reel/CuzzGTXvvaj/',
    category: 'short-video',
    platform: 'instagram',
  },
  {
    id: 'short-8',
    title: 'Embrace Discomfort',
    description: 'Life is meant for discomfort, not comfort',
    url: 'https://www.instagram.com/reel/DBjhO7Gije3/',
    category: 'short-video',
    platform: 'instagram',
  },
  {
    id: 'short-9',
    title: 'Casey on Sales Freedom',
    description: 'Casey Baugh on how sales creates freedom',
    url: 'https://www.instagram.com/reel/DCVdAJyPFBa/',
    category: 'short-video',
    platform: 'instagram',
  },
  {
    id: 'short-10',
    title: 'Helicopter to Owner',
    description: 'Flight school student → buying the school',
    url: 'https://www.instagram.com/reel/DC2FOTxRO8R/',
    category: 'short-video',
    platform: 'instagram',
  },
  {
    id: 'short-11',
    title: 'Todd on D2D to Leader',
    description: 'Door to door company → leading sales org',
    url: 'https://www.instagram.com/reel/DDqpepXxTjS/',
    category: 'short-video',
    platform: 'instagram',
  },
  {
    id: 'short-12',
    title: 'Salary is Riskier',
    description: 'Why commission beats salary for security',
    url: 'https://www.instagram.com/reel/DETA41PJYuB/',
    category: 'short-video',
    platform: 'instagram',
  },
  {
    id: 'short-13',
    title: 'Alex Hormozi on D2D',
    description: 'Alex Hormozi endorses door to door sales',
    url: 'https://youtu.be/nmwe8RmXXcY',
    category: 'short-video',
    platform: 'youtube',
  },
  {
    id: 'short-14',
    title: "Don't Half Ass It",
    description: 'Matthew McConaughey on commitment',
    url: 'https://youtube.com/shorts/gTd9VKc1XPE?si=c4sYH1Vmow27jCS_',
    category: 'short-video',
    platform: 'youtube',
  },

  // Podcasts
  {
    id: 'podcast-1',
    title: 'Case Studies Episode',
    description: 'In-depth conversation on the business',
    url: 'https://podcasts.apple.com/us/podcast/case-studies/id1718854510?i=1000696151243',
    category: 'podcast',
    platform: 'apple-podcasts',
  },
  {
    id: 'podcast-2',
    title: 'Case Studies Classic',
    description: 'Popular episode on sales and growth',
    url: 'https://podcasts.apple.com/us/podcast/case-studies/id1718854510?i=1000650578817',
    category: 'podcast',
    platform: 'apple-podcasts',
  },
  {
    id: 'podcast-3',
    title: 'Spotify Feature',
    description: 'Deep dive episode - starts at key moment',
    url: 'https://open.spotify.com/episode/4bOXrOzeOsnGc9q2snl9wk?si=dgHtNOaWQlaNcfc1U_8Bww&t=2223',
    category: 'podcast',
    platform: 'spotify',
  },

  // Websites
  {
    id: 'website-1',
    title: 'Vivint Insider',
    description: 'Internal resources and news',
    url: 'https://insider.vivint.com/login',
    category: 'website',
    platform: 'web',
  },
  {
    id: 'website-2',
    title: 'Training Portal',
    description: 'DTH Vivint training courses',
    url: 'https://dthvivinttraining.conveyour.com/ui/portal/folders/5fa04bdab06da2445f03ba1c/lessons/5fb54269b06da20e852b86b0',
    category: 'website',
    platform: 'web',
  },
  {
    id: 'website-3',
    title: 'Vivint App',
    description: 'Download the Vivint app',
    url: 'https://apps.apple.com/app/id734547946',
    category: 'website',
    platform: 'web',
  },
  {
    id: 'website-4',
    title: 'Onboarding Tool',
    description: 'New rep onboarding portal',
    url: 'https://onboardingtool.vivint.com/',
    category: 'website',
    platform: 'web',
  },

  // Images
  {
    id: 'image-1',
    title: 'Rookie to Regional',
    description: 'Earnings progression from rookie to regional leader',
    url: '',
    category: 'image',
    platform: 'image',
    imagePath: '/src/assets/recruiting/rookie-to-regional.webp',
  },
  {
    id: 'image-2',
    title: '6 Figures Comparison',
    description: 'Compare Vivint earnings to other 6-figure careers',
    url: '',
    category: 'image',
    platform: 'image',
    imagePath: '/src/assets/recruiting/six-figures-comparison.webp',
  },
  {
    id: 'image-3',
    title: 'NRG vs Sunrun Stock',
    description: 'Stock performance comparison chart',
    url: '',
    category: 'image',
    platform: 'image',
    imagePath: '/src/assets/recruiting/nrg-vs-sunrun.webp',
  },
];

export function getContentByCategory(category: ContentCategory): RecruitingContent[] {
  if (category === 'all') return recruitingContent;
  return recruitingContent.filter(item => item.category === category);
}

export function getCategoryCount(category: ContentCategory): number {
  return getContentByCategory(category).length;
}
