# Kaizen Recruiting Landing Page - Export Package

This folder contains everything you need to create a standalone recruiting landing page in a new Lovable project.

## Quick Setup Instructions

### 1. Create New Lovable Project
Create a new blank Lovable project

### 2. Copy These Files

**Order matters! Copy in this order:**

1. **`public/images/about-team/`** - All image assets (copy entire folder)
2. **`public/videos/`** - Video assets (copy entire folder)
3. **`src/lib/utils.ts`** - Utility functions (cn helper)
4. **`src/data/aboutTeamData.ts`** - All page data
5. **`src/components/ui/carousel.tsx`** - Carousel component (if not already in project)
6. **`src/components/ui/BlurImage.tsx`** - Blur-up image loading component
7. **`src/hooks/useAboutTeamPrefetch.ts`** - Image preloading hook
8. **`src/components/about/`** - All section components (copy entire folder)
9. **`src/pages/Index.tsx`** - Main page (replaces default Index.tsx)

### 3. Update App.tsx Routes

Replace the default routing with:
```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

### 4. Required Dependencies

These should already be in a fresh Lovable project, but verify:
- `framer-motion`
- `lucide-react`
- `recharts`
- `embla-carousel-react`
- `clsx`
- `tailwind-merge`

## File Structure

```
export-package/
├── README.md (this file)
├── src/
│   ├── lib/
│   │   └── utils.ts (cn utility)
│   ├── pages/
│   │   └── Index.tsx (main entry point)
│   ├── hooks/
│   │   └── useAboutTeamPrefetch.ts (image preloading)
│   ├── components/
│   │   ├── ui/
│   │   │   └── BlurImage.tsx (blur-up image component)
│   │   └── about/
│   │       ├── HeroSection.tsx
│   │       ├── QuickStatsBar.tsx
│   │       ├── SuccessStoriesCarousel.tsx
│   │       ├── SuccessStoryCard.tsx
│   │       ├── SkillsGrid.tsx
│   │       ├── EarningsComparison.tsx
│   │       ├── CultureGallery.tsx
│   │       ├── AlumniSection.tsx
│   │       ├── CompanyCredibility.tsx
│   │       ├── LeaderSection.tsx
│   │       └── FinalCTA.tsx
│   └── data/
│       └── aboutTeamData.ts
└── public/
    ├── images/
    │   └── about-team/ (your images)
    └── videos/
        └── ding-dong-ditch.mov
```

## Performance Features

This export package includes performance optimizations:

- **BlurImage Component**: Shows blur placeholder while images load, then fades in smoothly
- **Image Prefetching**: Critical above-fold images preload first, then remaining images load in background
- **Lazy Loading**: Below-fold images use `loading="lazy"` for faster initial load
- **Eager Loading**: Hero background uses `loading="eager"` for instant display

## Customization

- Edit `src/data/aboutTeamData.ts` to change all content
- Swap images in `public/images/about-team/`
- Modify component styles in individual component files
