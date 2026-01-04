import Layout from "@/components/Layout";
import { LeaderboardCard } from "@/components/LeaderboardCard";

const Leaderboard = () => {
  return (
    <Layout>
      <div className="p-4">
        <LeaderboardCard />
      </div>
    </Layout>
  );
};

export default Leaderboard;

