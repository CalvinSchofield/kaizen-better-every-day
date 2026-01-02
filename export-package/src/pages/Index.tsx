import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { HeroSection } from "@/components/about/HeroSection";
import { QuickStatsBar } from "@/components/about/QuickStatsBar";
import { SuccessStoriesCarousel } from "@/components/about/SuccessStoriesCarousel";
import { SkillsGrid } from "@/components/about/SkillsGrid";
import { EarningsComparison } from "@/components/about/EarningsComparison";
import { CultureGallery } from "@/components/about/CultureGallery";
import { AlumniSection } from "@/components/about/AlumniSection";
import { CompanyCredibility } from "@/components/about/CompanyCredibility";
import { LeaderSection } from "@/components/about/LeaderSection";
import { FinalCTA } from "@/components/about/FinalCTA";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Page sections */}
      <HeroSection />
      <QuickStatsBar />
      <SuccessStoriesCarousel />
      <SkillsGrid />
      <EarningsComparison />
      <CultureGallery />
      <AlumniSection />
      <CompanyCredibility />
      <LeaderSection />
      <FinalCTA />
    </div>
  );
};

export default Index;
