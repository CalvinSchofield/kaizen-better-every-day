import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export const FinalCTA = () => {
  const navigate = useNavigate();
  
  return (
    <section className="py-16 bg-gradient-to-br from-primary/10 via-background to-primary/5">
      <div className="max-w-lg mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          
          <h2 className="text-3xl font-bold mb-4">
            Ready to Write Your Story?
          </h2>
          
          <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
            Join the team that's helping rookies build real skills, real earnings, and real futures.
          </p>
          
          <Button 
            size="lg"
            className="rounded-full px-8 gap-2"
            onClick={() => navigate('/')}
          >
            Get Started
            <ArrowRight className="w-5 h-5" />
          </Button>
          
          <p className="text-xs text-muted-foreground mt-4">
            Your next steps are waiting.
          </p>
        </motion.div>
      </div>
    </section>
  );
};
