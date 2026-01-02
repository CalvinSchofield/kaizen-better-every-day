import { motion } from "framer-motion";
import { Building2, TrendingUp, Shield } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

// NRG stock price data (simplified monthly data showing growth)
const stockData = [
  { month: "Jan", price: 32 },
  { month: "Feb", price: 35 },
  { month: "Mar", price: 38 },
  { month: "Apr", price: 42 },
  { month: "May", price: 48 },
  { month: "Jun", price: 52 },
  { month: "Jul", price: 58 },
  { month: "Aug", price: 62 },
  { month: "Sep", price: 68 },
  { month: "Oct", price: 75 },
  { month: "Nov", price: 82 },
  { month: "Dec", price: 88 },
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
                <span className="text-xs text-white/60 font-medium">NRG</span>
                <span className="text-xs text-green-400 font-medium">+175% (1Y)</span>
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
                      tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                      axisLine={false}
                      tickLine={false}
                      interval={2}
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
