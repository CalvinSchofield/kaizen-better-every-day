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
import { FinalCTA } from "@/components/about/FinalCTA";

const AboutTeam = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-background">
      {/* Fixed back button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate(-1)}
        className="fixed top-4 left-4 z-50 w-10 h-10 rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-black/50 border border-white/10"
        style={{ marginTop: 'var(--effective-safe-area-top, 0px)' }}
      >
        <ArrowLeft className="w-5 h-5" />
      </Button>
      
      {/* Page sections */}
      <HeroSection />
      <QuickStatsBar />
      <SuccessStoriesCarousel />
      <SkillsGrid />
      <EarningsComparison />
      <CultureGallery />
      <AlumniSection />
      <CompanyCredibility />
      <FinalCTA />
    </div>
  );
};

export default AboutTeam;
