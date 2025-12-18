import { PitchSection } from "./PitchGuide";

export const paperworkSections: PitchSection[] = [
  {
    id: 1,
    title: "Set the Scene",
    emoji: "🪑",
    script: `"Just have a seat right here, this won't take long at all..."

"Perfect spot - good lighting, and we can spread everything out."

*Sit down across from them or next to them*`,
    stageTip: "Kitchen table is ideal. Good lighting, flat surface, feels official but not intimidating. YOU set where they sit.",
  },
  {
    id: 2,
    title: "Collect Info",
    emoji: "🪪",
    script: `"I'll need your ID real quick and a good email for you..."

"And let's double-check this address is exactly right..."

*Type as they give you info - keep pace moving*`,
    stageTip: "Keep it quick and conversational. Don't make them feel like they're at the DMV. Chat while you type.",
  },
  {
    id: 3,
    title: "Walk Through PSA",
    emoji: "📋",
    script: `"This just goes over the basics of what you're getting - the equipment, the monitoring, all that good stuff."

"I'll hit the highlights so you know what you're signing..."

*Point to key sections as you go*`,
    stageTip: "Don't read every word. Hit the main points: equipment, monthly cost, contract length, cancellation policy. Be transparent but efficient.",
  },
  {
    id: 4,
    title: "Payment Setup",
    emoji: "💳",
    script: `"For the monthly monitoring, how would you like to handle that - card or bank account?"

"Most people do card since it's easier to track..."

*Have card reader or form ready*`,
    stageTip: "Ask matter-of-factly, not apologetically. This is a normal part of the process. First payment usually processes after install.",
  },
  {
    id: 5,
    title: "Schedule Install",
    emoji: "📅",
    script: `"Alright, when works best for you guys to have the tech come out?"

"They need about 2-3 hours, so we want to make sure someone's home..."

"How about [specific day/time]?"`,
    stageTip: "Offer specific options rather than leaving it open-ended. 'Tuesday at 2pm or Wednesday morning?' gets faster answers than 'When works for you?'",
  },
  {
    id: 6,
    title: "Wrap Up",
    emoji: "🎉",
    script: `"You're all set! Here's what happens next..."

"The tech will call about an hour before they arrive. They'll walk you through everything and make sure you're comfortable."

"Congrats - you're gonna love it. Seriously."`,
    stageTip: "End on a high note. They should feel excited, not anxious. A firm handshake and genuine enthusiasm goes a long way.",
  },
];
