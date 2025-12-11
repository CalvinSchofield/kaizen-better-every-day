import { useState, useMemo } from "react";
import { ArrowLeft, Search, X, ChevronDown, Lightbulb, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Objection {
  id: string;
  objection: string;
  proResponse: string;
  otherResponses: string[];
}

const objections: Objection[] = [
  {
    id: "already-have-system",
    objection: "We already have a system",
    proResponse: "That's exactly why I'm here! How long ago did you get it? Awesome. Your neighbors that had the ____ system and loved it as well, the reason why they jumped on board is because of ______, check this out.",
    otherResponses: [
      "I actually do smart homes where it ties into the products you already have",
      "Yeah I noticed that when I knocked your door. Have you had them for 3 or 4 years like _____?",
      "That's exactly why I'm here, I got excited to see you had a system. I knew you would like what we are doing.",
      "Cool. I actually figured that, most the people I'm dealing with already have systems. If you don't mind me asking, who does your service for you?",
    ],
  },
  {
    id: "safe-neighborhood",
    objection: "This is a safe neighborhood",
    proResponse: "Of course it is — it's so nice here. And all of your neighbors are so nice! 😄 That's actually exactly why they send me out here. Nobody is getting the system because they worry someone is going to break in tonight. Everyone is loving _______, check this out.",
    otherResponses: [
      "\"Absolutely, that's why I'm here.\"….tell about how it used to be safe but that now it is evolving with time. Speak through the neighbors.",
      "That's actually why I'm here. We like to work with the safer neighborhoods because people prefer the smart home aspect of our products.",
      "Yeah that's actually a major reason why we are out here. We notice that when people get our signs out front it helps keep the neighborhood safe.",
    ],
  },
  {
    id: "do-research",
    objection: "I want to do some research",
    proResponse: "100%, that makes total sense — we just met 20 mins ago. I'm the same way by the way, I know where all my money goes and am super sure before I make a decision. But ______ was super important to you and the price is affordable like you said. Let's fast forward. What would you google and look up?",
    otherResponses: [
      "Okay and I wouldn't expect anything less. So all I want to do is step inside and show you a couple of things and then I will get out of your way.",
      "Yes I would definitely encourage people to take some time and go through it. That's why I have all these materials and my iPad to go through it.",
      "Okay you must say that for a reason, you've probably maybe even been burned in the past. I promise you I'm not that guy.",
    ],
  },
  {
    id: "talk-to-spouse",
    objection: "I need to talk to my spouse",
    proResponse: "Makes total sense. Like you said before we started though, you were the one that could handle this and make the call! You handle the budget and know they wouldn't be mad at you for setting up the system. With that being said, if I weren't here and they were, what would you talk to them about?",
    otherResponses: [
      "You know that's perfect, I wouldn't want you to actually make a big decision without your spouse here with us. My job isn't to get you to make a decision right this second.",
      "No problem I get that. Do you know Mark? He also wanted to go over it with his spouse. My job is to just get you the information so that you have the things you need.",
    ],
  },
  {
    id: "no-time",
    objection: "I don't have time",
    proResponse: "All good, here's the 12 second pitch… (continue with a shorter pitch and focus on the deal. They're probably not that busy)",
    otherResponses: [
      "That's cool. I'm actually not going to take a lot of your time, I'm pretty slammed out here too. Usually it takes about 2 minutes.",
      "Yeah sorry I don't want to bother you. I know everyone around here is super busy and so I'll be real quick.",
      "Yeah I totally understand that. I'm super busy out here too so let's make this quick. Are you leaving for work or the grocery store?",
      "Yeah sorry about that, is there a better time I could come back to chat with you?",
    ],
  },
  {
    id: "no-contracts",
    objection: "I don't do contracts",
    proResponse: "Of course nobody wants to be locked into something forever. There isn't a service contract so there is some flexibility. But the most important thing for you to know is that our average customer is with us for 10 years. That says a lot about the quality of the product and the customer service.",
    otherResponses: [
      "Yeah, nobody wants to be locked in forever. We guarantee the rate for the time that you are with us, and you can move whenever you need. It's also transferable.",
      "Definitely. Unfortunately, our life is kind of filled with contracts. How long have you been in the home for?",
      "Yeah, I support whatever you decide is best. I would say don't let a good thing hold you back just because of an agreement.",
    ],
  },
  {
    id: "door-to-door",
    objection: "I don't buy from door to door salesmen",
    proResponse: "That's totally fine. This may not be for you. Just so you know,…",
    otherResponses: [
      "Yeah you can imagine what I do for my job I get that all the time. Hopefully you can tell by the way I treat you that I'm not like your typical, pushy sales guy.",
      "Yeah no problem, I appreciate that. So far with the neighbors, they have been pleased with my offer. Just hear me out.",
      "I'm not gonna twist your arm, if this isn't a good fit for you then that's fine I'll go bug somebody else.",
    ],
  },
  {
    id: "have-a-card",
    objection: "Do you have a card? / Could you email me info?",
    proResponse: "Yes totally can get you that information. Just so you know…",
    otherResponses: [
      "Um…I must have forgotten them",
      "Yeah definitely, I will leave all that with you. My job is really simple, and I just wanna explain all the details to you. How long have you been in the house for?",
      "Yeah you bet, I have a card and if you give me two minutes I can show you what this looks like.",
    ],
  },
  {
    id: "have-a-dog",
    objection: "I have a dog",
    proResponse: "Hey trust me I get it. I'm from Dallas — we all have guns and dogs lol. The reason why I'm here…",
    otherResponses: [
      "That's awesome, dogs are really great for security because they let you know when someone is coming around. But dogs can also be mischievous. I like to check on my dog when I'm away through my indoor camera.",
      "I have a dog myself! He's a golden doodle. What kind of dog do you have? I'm a really big dog person. Sounds like you are security minded!",
      "Cool, everyone I do this for has dogs! Do you know the Anderson's? With the big great Dane? We just got them set up.",
    ],
  },
  {
    id: "have-a-gun",
    objection: "I have a gun",
    proResponse: "Hey trust me I get it. I'm from Dallas — we all have guns and dogs lol. The reason why I'm here…",
    otherResponses: [
      "That's awesome, it's super good. And obviously you can take care of business while you're home. The only concern is while you are away — people like to be able to have access to their entire home while they're gone.",
      "Definitely. I know guns for a lot of people make them feel safe. What a lot of people notice though is that when they are not around they want to still protect their home.",
      "I love them! I have a few as well. Give me a high five. The reason why I am here is…",
    ],
  },
  {
    id: "how-much",
    objection: "How much is it?",
    proResponse: "Like a million bucks… Just kidding that's exactly why I'm here. Check this out.",
    otherResponses: [],
  },
];

const Objections = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredObjections = useMemo(() => {
    if (!searchQuery.trim()) return objections;
    const query = searchQuery.toLowerCase();
    return objections.filter(
      (obj) =>
        obj.objection.toLowerCase().includes(query) ||
        obj.proResponse.toLowerCase().includes(query) ||
        obj.otherResponses.some((r) => r.toLowerCase().includes(query))
    );
  }, [searchQuery]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3">
          {/* Back button and search */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/tools")}
              className="shrink-0 -ml-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search objections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-10 bg-muted/50 border-0 rounded-xl"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {/* Intro text */}
        <p className="text-sm text-muted-foreground text-center px-4 pb-2">
          Tap an objection to see what the pros say
        </p>

        {/* Objection Cards */}
        <AnimatePresence mode="popLayout">
          {filteredObjections.map((obj, index) => (
            <motion.div
              key={obj.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: index * 0.03 }}
              layout
            >
              <div
                className={cn(
                  "rounded-2xl border border-border overflow-hidden transition-all duration-300",
                  expandedId === obj.id
                    ? "bg-card shadow-lg border-primary/30"
                    : "bg-card/50 hover:bg-card hover:border-primary/20"
                )}
              >
                {/* Objection Header - Always Visible */}
                <button
                  onClick={() => toggleExpand(obj.id)}
                  className="w-full text-left p-4 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm leading-tight">
                      "{obj.objection}"
                    </h3>
                  </div>
                  <ChevronDown
                    className={cn(
                      "w-5 h-5 text-muted-foreground transition-transform duration-300 shrink-0",
                      expandedId === obj.id && "rotate-180"
                    )}
                  />
                </button>

                {/* Expanded Content */}
                <AnimatePresence>
                  {expandedId === obj.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-4">
                        {/* Pro Response - Highlighted */}
                        <div className="rounded-xl bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 p-4 border border-primary/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Lightbulb className="w-4 h-4 text-primary" />
                            <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                              Pro Response
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed font-medium">
                            "{obj.proResponse}"
                          </p>
                        </div>

                        {/* Other Responses */}
                        {obj.otherResponses.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              Other Responses
                            </span>
                            <div className="space-y-2">
                              {obj.otherResponses.map((response, i) => (
                                <div
                                  key={i}
                                  className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed text-muted-foreground"
                                >
                                  "{response}"
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Empty State */}
        {filteredObjections.length === 0 && (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No objections match your search</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="mt-2"
            >
              Clear search
            </Button>
          </div>
        )}

        {/* Bottom padding for safe area */}
        <div className="h-8" />
      </div>
    </div>
  );
};

export default Objections;
