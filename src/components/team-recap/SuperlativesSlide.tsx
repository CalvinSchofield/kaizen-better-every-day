import { motion } from 'framer-motion';
import { Moon, Sun, Zap, Target, TrendingUp, DoorOpen, Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Superlative {
  key: string;
  name: string;
  photo?: string;
  value: string;
  stat: string;
}

interface SuperlativesSlideProps {
  superlatives: Superlative[];
}

const superlativeConfig: Record<string, { icon: typeof Moon; emoji: string; title: string; color: string }> = {
  lateNightAssassin: { 
    icon: Moon, 
    emoji: '🌙', 
    title: 'Late Night Assassin',
    color: 'text-purple-400'
  },
  earlyDealsBandit: { 
    icon: Sun, 
    emoji: '🌅', 
    title: 'Early Deals Bandit',
    color: 'text-orange-400'
  },
  theHustler: { 
    icon: Zap, 
    emoji: '💪', 
    title: 'The Hustler',
    color: 'text-yellow-400'
  },
  mostEfficient: { 
    icon: Target, 
    emoji: '⚡', 
    title: 'Most Efficient',
    color: 'text-green-400'
  },
  mostImproved: { 
    icon: TrendingUp, 
    emoji: '📈', 
    title: 'Most Improved',
    color: 'text-blue-400'
  },
  theCloser: { 
    icon: Star, 
    emoji: '🎯', 
    title: 'The Closer',
    color: 'text-red-400'
  },
  doorDestroyer: { 
    icon: DoorOpen, 
    emoji: '🚪', 
    title: 'Door Destroyer',
    color: 'text-cyan-400'
  },
};

function getInitials(name: string) {
  return name
    .replace(/[\p{Emoji}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Emoji_Component}]/gu, '')
    .trim()
    .split(' ')
    .filter(n => n.length > 0)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function SuperlativesSlide({ superlatives }: SuperlativesSlideProps) {
  return (
    <div className="h-full flex flex-col px-4 pt-4 overflow-y-auto pb-8">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-center gap-2 mb-6"
      >
        <Star className="w-6 h-6 text-yellow-400" />
        <h2 className="text-xl font-bold text-yellow-400">SUPERLATIVES</h2>
      </motion.div>

      {/* Superlative cards */}
      <div className="space-y-4">
        {superlatives.map((sup, idx) => {
          const config = superlativeConfig[sup.key] || {
            icon: Star,
            emoji: '🏆',
            title: sup.key,
            color: 'text-primary'
          };
          const Icon = config.icon;

          return (
            <motion.div
              key={sup.key}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ 
                type: 'spring',
                delay: 0.2 * idx,
                duration: 0.5
              }}
              className="bg-card/50 rounded-2xl p-4 border border-border/50"
            >
              <div className="flex items-center gap-4">
                {/* Icon/Emoji */}
                <div className={`w-14 h-14 rounded-xl bg-muted/50 flex items-center justify-center text-3xl`}>
                  {config.emoji}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <p className={`text-sm font-bold ${config.color} uppercase tracking-wide`}>
                    {config.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="w-8 h-8 border border-border">
                      <AvatarImage src={sup.photo} alt={sup.name} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(sup.name)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="font-semibold">{sup.name}</p>
                  </div>
                </div>

                {/* Value */}
                <div className="text-right">
                  <p className="text-2xl font-black">{sup.value}</p>
                  <p className="text-xs text-muted-foreground">{sup.stat}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {superlatives.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">No superlatives this period</p>
        </div>
      )}
    </div>
  );
}
