export interface CloseItem {
  name: string;
  description: string;
  script: string;
}

export interface CloseCategory {
  title: string;
  emoji: string;
  description: string;
  closes: CloseItem[];
}

export const closesData: CloseCategory[] = [
  {
    title: "Set the Stage",
    emoji: "🎯",
    description: "Pre-frame from the beginning so closing is natural",
    closes: [
      {
        name: "The 3-Way Frame",
        description: "Set clear yes/no expectations upfront",
        script: `"The hardest part about my job is the constant back and forth nonstop. If I can answer your questions and concerns, and if the deal we give you fits the budget — say yes! If I can't or if it's not a good fit, just say no. I'm cool with either a yes or a no, it's just the 'maybe' or 'let me think about it' that I can't do. Is that fair?"`,
      },
      {
        name: "The Fair Deal Frame",
        description: "Position for referrals regardless of outcome",
        script: `"What's going to happen is, I'll go through everything today and show you what the program is and how it might benefit you, and if it is a good fit, then we can start paperwork today. If not, then I would hope that you could point me to the direction of some people that would be interested. Sound fair?"`,
      },
      {
        name: "The Open Mind Frame",
        description: "Remove pressure, let them judge",
        script: `"I'm just gonna go through why others in your area bought it. I'm not going to try and sell you anything. At the end, I'll let you judge for yourself whether or not this fits your needs or interest. I just ask that you listen with an open mind and at the end let me know if this is a good fit or not."`,
      },
    ],
  },
  {
    title: "Preempt Objections",
    emoji: "🛡️",
    description: "Beat them to the punch before they raise concerns",
    closes: [
      {
        name: "Money is Tight",
        description: "Address budget concerns before they come up",
        script: `"The reason most people get this from me is because they're on a fixed income and tight with their money — they figured it's better to get it now while it's cheap rather than paying more later."`,
      },
      {
        name: "Just Moved In",
        description: "Handle the 'too much going on' objection",
        script: `"Obviously you have a ton going on with the new home, and money feels like it's flying out the windows! Your neighbors that just got their new place got the system with us this week because they figured it would be best to knock it out while it's cheap since we're in the area rather than waiting since it is on the long list of things to do when getting a new home."`,
      },
    ],
  },
  {
    title: "Assumptive Closes",
    emoji: "💪",
    description: "Speak with confidence like they've already decided",
    closes: [
      {
        name: "Assumption Close",
        description: "Talk as if they've already bought",
        script: `Use "your cameras", "your panel", "when the installer sets up your system" — speak as if it's already theirs. Assuming is an art and it needs to come off natural and confident.`,
      },
      {
        name: "Change Places Close",
        description: "Get them to sell themselves",
        script: `"Mr customer, put yourself in my shoes for a second. Let's suppose you're talking to somebody you know could really use and benefit from the product, and they really just won't tell you their main hesitation for not moving forward. What would you do in my situation?"`,
      },
      {
        name: "Bandwagon Close",
        description: "Everyone else is doing it",
        script: `"The Johnsons down the street, the family on the corner, your neighbor Jerry — they all got set up this week. You'd actually be one of the last ones on this street to get protected." Create the sense that everyone is doing it! It validates your offering and helps them decide.`,
      },
    ],
  },
  {
    title: "Emotional Closes",
    emoji: "❤️",
    description: "Connect with feelings and motivations",
    closes: [
      {
        name: "Feel, Felt, Found",
        description: "Validate, relate, resolve",
        script: `"I totally get where you're coming from. Your neighbor actually felt the same way — worried about [concern]. But what they found was [benefit], and now they recommend it more than anyone." Fastest way to calm their nervous system is validation.`,
      },
      {
        name: "Hot Button Close",
        description: "Tie back to their main motivation",
        script: `"Like you said, being able to check on the kids when they get home from school — that's priceless, right? Let's get you set up." Use what THEY told you they care about.`,
      },
      {
        name: "Gratitude Close",
        description: "Appreciate and recap",
        script: `"I appreciate your time and how open you've been with your questions. Before we wrap up — what are the main things you love about what we've talked about?" Get them to sell themselves.`,
      },
    ],
  },
  {
    title: "Direct Closes",
    emoji: "🎯",
    description: "Just ask for the business",
    closes: [
      {
        name: "Just Do It",
        description: "Confident, direct ask",
        script: `"Look, the price is right, the product is right, and you know we're a good company. Let's just do it! And if you don't like it, call me and we'll refund you."`,
      },
      {
        name: "Invitation Close",
        description: "Simply invite them to buy",
        script: `"Why don't we just do this?" "How many do you want?" Sometimes the simplest ask is the most powerful.`,
      },
      {
        name: "High Five Close",
        description: "Celebrate the no-brainer",
        script: `"The best part about this is you don't even pay anything up front! *high five*" Make it a celebration.`,
      },
    ],
  },
  {
    title: "Handle Stalls",
    emoji: "⏸️",
    description: "Navigate the 'I need to think about it'",
    closes: [
      {
        name: "Spouse Close",
        description: "When they need to 'talk to spouse'",
        script: `"Hypothetically, if your spouse were here right now and said 'honey, it's up to you!' — what would you say?" Then: "What if your spouse says no? Would their objection be the money or the product?"`,
      },
      {
        name: "Time Frame Close",
        description: "Respect their time, get a decision",
        script: `"Because your time and my time is valuable, I want to make sure we get all your questions answered so you can make an educated decision today — whether that's a yes or a no is up to you."`,
      },
      {
        name: "Price, Product, Company",
        description: "Identify the real objection",
        script: `"Usually people don't do this right away because they don't have the money, the product doesn't seem like the right fit, or they don't know much about the company. Which one is it?"`,
      },
    ],
  },
  {
    title: "Negotiation Closes",
    emoji: "🤝",
    description: "Give and take to seal the deal",
    closes: [
      {
        name: "Deal Close",
        description: "Trade value for referrals",
        script: `"If one, we can get this thing done today to make the process smooth and simple, and two, you give me 4 names of people in your network, then I could _______. But with those 4 people I need you to introduce me and make a group chat of us 3 together in it. Is that fair?"`,
      },
      {
        name: "Manager Call Close",
        description: "Bring in authority for special pricing",
        script: `"Let me call my manager real quick... Hey, I'm with the nicest people and they promised to give us referrals. Is there anything we can do?" Then come back with an offer.`,
      },
      {
        name: "Inventory Close",
        description: "Offer a smaller package",
        script: `"Would you consider the product right under this and reduce the price X amount a month, or would you rather get exactly what you want and pay a little bit more?"`,
      },
    ],
  },
  {
    title: "Last Resort",
    emoji: "🚪",
    description: "When all else fails",
    closes: [
      {
        name: "Door Knob Close",
        description: "Pack up, then one last question",
        script: `*Pack up everything, grab the door knob, then look back* "Mr. Customer, can I ask you one last question? What was the main reason you didn't move forward today? Just for my learning." Then: "Freak!! Why didn't you say that earlier?!"`,
      },
      {
        name: "Trial Close",
        description: "Remove risk with a safety net",
        script: `"Look, just try it out. You have 3 days to cancel and if you don't like it, then you get all your money back guaranteed. Let me do my portion today, and then I'll give you a couple days to think about it."`,
      },
      {
        name: "Not Interested Close",
        description: "Flip the lack of interest",
        script: `"I know this is something you've never been interested in, because if you were, you would've already had it. Most people don't show interest until they need it — but once you need it, it's too late. We like to take a proactive approach."`,
      },
      {
        name: "Win-Win Close",
        description: "Show you've given everything",
        script: `"We're obviously in the business of a 'win-win or no deal'. At the end of the day, I've given you the farm. If I gave you anymore, it wouldn't be a win for me anymore."`,
      },
    ],
  },
];

export const closesIntro = `It takes a lot of different closes to close a lot of people! Study these and memorize as many as you can.

If someone has let you in their house and let you present, they are interested and are just waiting for someone that can make it happen for them. Be that person!`;
