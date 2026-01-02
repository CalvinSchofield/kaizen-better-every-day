# Kaizen Recruiting Landing Page - Export Package

This folder contains everything you need to create a standalone recruiting landing page in a new Lovable project.

## Quick Setup Instructions

### 1. Create New Lovable Project
Create a new blank Lovable project

### 2. Copy These Files

**Order matters! Copy in this order:**

1. **`public/images/about-team/`** - All image assets (copy entire folder)
2. **`public/videos/`** - Video assets (copy entire folder)
3. **`src/data/aboutTeamData.ts`** - All page data
4. **`src/components/ui/carousel.tsx`** - Carousel component (if not already in project)
5. **`src/components/about/`** - All section components (copy entire folder)
6. **`src/pages/Index.tsx`** - Main page (replaces default Index.tsx)

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

## File Structure

```
export-package/
├── README.md (this file)
├── src/
│   ├── pages/
│   │   └── Index.tsx (main entry point)
│   ├── components/
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
    └── images/
        └── about-team/ (your images)
```

## Customization

- Edit `src/data/aboutTeamData.ts` to change all content
- Swap images in `public/images/about-team/`
- Modify component styles in individual component files
