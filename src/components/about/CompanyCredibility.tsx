import { motion } from "framer-motion";
import { Building2, TrendingUp, Shield } from "lucide-react";

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
              $5 Billion
            </div>
            <p className="text-white/70 text-sm">
              NRG Energy acquired Vivint — making it one of the largest smart home providers in America
            </p>
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
