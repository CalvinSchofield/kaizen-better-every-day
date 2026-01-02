import { motion } from "framer-motion";
import { Building2, TrendingUp, Shield } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

// NRG stock price data from Feb 2023 to Jan 2026 (monthly)
const stockData = [
  { month: "Feb '23", price: 32 },
  { month: "May '23", price: 36 },
  { month: "Aug '23", price: 48 },
  { month: "Nov '23", price: 52 },
  { month: "Feb '24", price: 58 },
  { month: "May '24", price: 72 },
  { month: "Aug '24", price: 78 },
  { month: "Nov '24", price: 95 },
  { month: "Jan '26", price: 112 },
];

export const CompanyCredibility = () => {
  return (
    <section className="py-12 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="max-w-lg mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          
          <h2 className="text-2xl font-bold mb-4">Backed by a Giant</h2>
          
          <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm border border-white/10 mb-6">
            <div className="text-4xl font-bold text-primary mb-2">
              $5.2 Billion
            </div>
            <p className="text-white/70 text-sm mb-4">
              NRG Energy acquired Vivint — making it one of the largest smart home providers in America
            </p>
            
            {/* NRG Stock Chart */}
            <div className="bg-black/20 rounded-xl p-4 mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/60 font-medium">NRG (Feb 2023 - Today)</span>
                <span className="text-xs text-green-400 font-medium">+250%</span>
              </div>
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stockData}>
                    <defs>
                      <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }}
                      axisLine={false}
                      tickLine={false}
                      interval={1}
                    />
                    <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="#22c55e"
                      strokeWidth={2}
                      fill="url(#stockGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center gap-6">
            <div className="text-center">
              <TrendingUp className="w-6 h-6 text-green-400 mx-auto mb-2" />
              <p className="text-xs text-white/60">Growing Industry</p>
            </div>
            <div className="text-center">
              <Shield className="w-6 h-6 text-blue-400 mx-auto mb-2" />
              <p className="text-xs text-white/60">Industry Leader</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
