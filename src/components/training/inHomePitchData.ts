import { PitchSection } from "./PitchGuide";

export const inHomeSections: PitchSection[] = [
  {
    id: 1,
    title: "The Opener",
    emoji: "👋",
    script: `"Is there anything else you want to see before we get it set up?"

Or try:

"Hey, let me show you exactly how this is going to work at YOUR house..."`,
    stageTip: "Start assumptive from the very beginning. You're not asking IF they want it - you're showing them how it works for them specifically.",
  },
  {
    id: 2,
    title: "Where to Start",
    emoji: "🏠",
    script: `"Let me show you how this will work at YOUR house. We'll walk around and I'll point out where everything would go - that way you can actually picture it."

"Let's start with the cameras..."`,
    stageTip: "Physically move with them. Get them standing up and walking through THEIR home. This creates ownership before they even buy.",
  },
  {
    id: 3,
    title: "Camera Positioning",
    emoji: "📹",
    script: `"So right here at your front door - this is where we'd put the doorbell camera. Anyone who comes up, you'll see them on your phone before they even ring..."

"And then out back - see that corner? Perfect spot for the outdoor camera. You'd be able to see the whole backyard, the gate, everything..."`,
    stageTip: "Point to SPECIFIC spots in their home. Use 'your backyard', 'your driveway', 'your front porch' - make it real and personal.",
  },
  {
    id: 4,
    title: "The Panel",
    emoji: "🖥️",
    script: `"This right here is going to act like the brains of the whole system. Everything connects through this panel."

"You'll be able to see all your cameras right here, arm and disarm the system, talk to whoever's at the door - all from one spot."`,
    stageTip: "Keep the panel explanation brief. Most people don't care about technical details - they care about what it DOES for them.",
  },
  {
    id: 5,
    title: "The Doorbell",
    emoji: "🔔",
    script: `"This is the doorbell - watch what happens when someone comes up..."

*Show demo on panel or phone*

"You see their face, you can talk to them, and if you're not home you can make it sound like you are. Pretty cool, right?"`,
    stageTip: "Let them experience it. If you can show a quick demo or video, do it. Seeing is believing.",
  },
  {
    id: 6,
    title: "Phone Control",
    emoji: "📱",
    script: `"Now my favorite part - let me show you this on my phone real quick..."

"You can check your cameras from anywhere. Arm and disarm without being home. Get alerts when someone pulls up..."

"Imagine you're at work and the kids get home from school - you can actually see them walk in."`,
    stageTip: "Use THEIR scenarios. Kids coming home, packages being delivered, checking on pets - whatever fits their life.",
  },
  {
    id: 7,
    title: "The Close",
    emoji: "✅",
    script: `"Does all this make sense? Perfect."

"Let's go fill out some paperwork and get you on the schedule!"

*Start walking toward kitchen table*`,
    stageTip: "Don't pause and wait for objections. Be assumptive - start moving to the paperwork area. Movement creates momentum.",
  },
  {
    id: 8,
    title: "Handling Questions",
    emoji: "❓",
    script: `If they have concerns at this point:

"That's a great question - let me explain..."

Always redirect back to value:

"...and that's exactly why your neighbors went with it. They had the same concern but realized [benefit] was worth it."`,
    stageTip: "Stay calm. Questions mean interest. Answer directly, then redirect to next step. Don't over-explain.",
  },
  {
    id: 9,
    title: "Transition to Table",
    emoji: "📝",
    script: `"You'll just need your ID and we'll get this knocked out real quick..."

"Let's sit right here - this won't take long at all."

*Have them sit down at kitchen table*`,
    stageTip: "Physical transition is key. Getting them seated at the table with ID out = deal is basically done.",
  },
  {
    id: 10,
    title: "Lock It In",
    emoji: "🔐",
    script: `"Alright, you're all set! Here's what happens next..."

"The tech will come out [day/time] and get everything installed. Usually takes about 2-3 hours."

"You're gonna love it - seriously."`,
    stageTip: "End with confidence and excitement. They should feel good about their decision, not anxious.",
  },
];

// Curated closes for BONUS section
export interface CloseItem {
  name: string;
  description: string;
  script: string;
}

export interface CloseCategory {
  title: string;
  emoji: string;
  closes: CloseItem[];
}

export const closesData: CloseCategory[] = [
  {
    title: "Setup Closes",
    emoji: "🎯",
    closes: [
      {
        name: "Set the Stage",
        description: "Pre-frame from the very beginning so closing is natural",
        script: `"What's going to happen is, I'll go through everything and show you how it might benefit you. If it's a good fit, we can start paperwork today. If not, maybe you could point me to some people that would be interested. Sound fair?"`,
      },
      {
        name: "Preempt Objections",
        description: "Beat them to the punch by addressing concerns before they raise them",
        script: `"The reason most people get this from me is because they're on a fixed income and tight with their money - they figured it's better to get it now while it's cheap rather than paying more later."`,
      },
      {
        name: "Assumption Close",
        description: "Talk as if they've already bought - confidence is contagious",
        script: `Use "your cameras", "your panel", "when the installer sets up your system" - speak as if it's already theirs.`,
      },
    ],
  },
  {
    title: "Power Closes",
    emoji: "💪",
    closes: [
      {
        name: "Feel, Felt, Found",
        description: "Validate their concern, show others felt the same, share what they discovered",
        script: `"I totally get where you're coming from. Your neighbor actually felt the same way - worried about [concern]. But what they found was [benefit], and now they recommend it more than anyone."`,
      },
      {
        name: "Bandwagon Close",
        description: "Create the sense that everyone is doing it",
        script: `"The Johnson's down the street, the family on the corner, your neighbor Jerry - they all got set up this week. You'd actually be one of the last ones on this street to get protected."`,
      },
      {
        name: "Just Do It",
        description: "Direct, confident ask - works when rapport is strong",
        script: `"Look, the price is right, the product is right, and you know we're a good company. Let's just do it! And if you don't like it, call me and we'll refund you."`,
      },
      {
        name: "Hot Button Close",
        description: "Tie back to their main motivation",
        script: `"Like you said, being able to check on the kids when they get home from school - that's priceless, right? Let's get you set up."`,
      },
    ],
  },
  {
    title: "Handle Stalls",
    emoji: "⏸️",
    closes: [
      {
        name: "Spouse Close",
        description: "Navigate the 'I need to talk to my spouse' stall",
        script: `"Hypothetically, if your spouse were here right now and said 'honey, it's up to you!' - what would you say?"`,
      },
      {
        name: "Time Frame Close",
        description: "Create urgency around your schedule",
        script: `"Because your time and my time is valuable, I want to make sure we get all your questions answered so you can make an educated decision today - whether that's a yes or a no is up to you."`,
      },
      {
        name: "Price Drop Close",
        description: "Give and take - use manager call or competition angle",
        script: `"Let me call my manager real quick... Hey, I'm with the nicest people and they promised to give us referrals. Is there anything we can do?" Then come back with an offer.`,
      },
    ],
  },
  {
    title: "Last Resort",
    emoji: "🚪",
    closes: [
      {
        name: "Door Knob Close",
        description: "When all else fails, pack up and ask one last question at the door",
        script: `*Pack up everything, grab the door knob, then look back* "Mr. Customer, can I ask you one last question? What was the main reason you didn't move forward today? Just for my learning."`,
      },
      {
        name: "Trial Close",
        description: "Remove risk with a back door",
        script: `"Look, just try it out. You have 3 days to cancel with a full refund. Let me do my portion today, and you can think it over with a safety net."`,
      },
    ],
  },
];
