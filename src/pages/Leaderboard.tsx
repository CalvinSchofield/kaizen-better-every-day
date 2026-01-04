import { useState, useEffect } from "react";
import { useRepData } from "@/hooks/useRepData";
import { useAppMode } from "@/hooks/useAppMode";
import { LeaderboardCard } from "@/components/LeaderboardCard";
import { VetLeaderboardCard } from "@/components/VetLeaderboardCard";
import { RookieLeaderboardCard } from "@/components/RookieLeaderboardCard";
import Layout from "@/components/Layout";

const Leaderboard = () => {
  const { repData } = useRepData();
  const { isOnActiveBlitz } = useAppMode(repData);
  
  const isVetOrSoph = repData?.year === "Vet" || repData?.year === "Sophomore";
  const isRookie = repData?.year === "Rookie";
  
  // Check if rookie has attended a blitz (post-blitz rookie)
  const blitzes = repData?.committed_blitzes 
    ? (Array.isArray(repData.committed_blitzes) ? repData.committed_blitzes : [])
    : [];
  const now = new Date();
  const hasAttendedBlitz = blitzes.some((blitz: any) => {
    if (!blitz.date || !blitz.endDate) return false;
    const endDate = new Date(blitz.endDate + 'T23:59:59');
    return endDate < now;
  });
  
  const isPostBlitzRookie = isRookie && hasAttendedBlitz;

  return (
    <Layout>
      <div className="p-4">
        {/* For leaders/vets/sophs - show the full interactive LeaderboardCard */}
        {isVetOrSoph && (
          <LeaderboardCard />
        )}
        
        {/* For post-blitz rookies - show full LeaderboardCard too */}
        {isPostBlitzRookie && (
          <LeaderboardCard />
        )}
        
        {/* Fallback: shouldn't reach here during knocking mode but just in case */}
        {!isVetOrSoph && !isPostBlitzRookie && (
          <LeaderboardCard />
        )}
      </div>
    </Layout>
  );
};

export default Leaderboard;
