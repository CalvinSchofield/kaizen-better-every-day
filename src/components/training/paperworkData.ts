import { PitchSection } from "./PitchGuide";

export const paperworkSections: PitchSection[] = [
  {
    id: 1,
    title: "Emergency Contacts & Password",
    emoji: "🚨",
    script: `I almost always use this as my close. Once I've presented, explained the trial close, and potentially even looped if needed, I'll look down and ask:

"Awesome. In case of emergency, would you want us to contact you first or your wife?"

When they give me the name, they are giving me the go ahead to move forward throughout the process without me asking, "So do you want to do it? Do you want to get the system?". Never ask that or any version of it.`,
    stageTip: "This IS your close. Getting emergency contact info = they've said yes. Don't ask 'do you want it?' - just move forward.",
  },
  {
    id: 2,
    title: "What's About to Happen",
    emoji: "📱",
    script: `After getting emergency contacts and password, prep customers for next steps and guide them through each one. Ask them to have their debit card and drivers license ready.

"Awesome. There are 4 quick steps, this is super easy. I just sent you a text if you'd grab your phone…" (finger guns to the phone)

"1. First step is scan your drivers license to make sure it's you.
2. Second you'll put in your info and debit card/bank account for the monthly.
3. Third will be the docs.
4. And last will be a preinstall survey to make sure everything looks good!"`,
    stageTip: "Tell them what's coming, then what to do. This builds credibility and keeps them calm.",
  },
  {
    id: 3,
    title: "ID Verification",
    emoji: "🪪",
    script: `"Okay, that text should be sent. Grab your phone and pull that up for me. It should be a text that says 'We're excited about your Vivint Smarthome system…' It's got a link, go ahead and click that and I'll help you fly through this real quick."

Once they have the link pulled up, it will say "let's make sure it's you" and have them put in their first name, last name, and zip code.

"So first step is put in your first name, last name, and zip code. After that it'll have you click number one, ID verification, to make sure it's you. You'll just scan the front, the back and then your face kind of like you're at the airport. If you need any help let me know…"`,
    stageTip: "If scanning gets stuck: check lighting, use a dark background, or try phone flashlight. If it still fails, call Account Creations for a vsign bypass.",
  },
  {
    id: 4,
    title: "Financing Application",
    emoji: "💳",
    script: `"Great, got that done. Click 'go back to dashboard'. Now go ahead and click number two. Here you'll put in some of your personal info like the guesstimate of the household gross and the social — don't guess on your social though."

Keep your tone casual while giving instructions. Since sharing personal info can be uncomfortable, this is a great time to chat about their neighborhood, family, or pets.

"Awesome. On that next page when it loads, you'll see the breakdown of the monthly. There will be 2 bills there that come out at the same time, one from Vivint and the other from our financing provider. We do that so it's easy to make payments. Scroll down and you'll go ahead and put in your bank account or debit card information there. Let me know if you have any issues with that."`,
    stageTip: "Having a friendly conversation helps take their mind off the paperwork. Nobody loves signing up for monthly bills - keep it light!",
  },
  {
    id: 5,
    title: "Credit Card Question",
    emoji: "💬",
    script: `Many customers want to pay with a credit card but we can't do that in this step. It has to be a debit card or bank account. Don't make it a big deal.

Customer: "I can't put a credit card here?"

"No I wish, everyone asks that. It has to be a debit card on sign up but you can change it to a credit card later. You just do that from your app once you have your Vivint account set up, it's super easy."

While they finish putting their card/banking info in, prep them for the next step. There are 4 boxes to check to apply for the loan with Fortiva.

"Wow, you're quick! Okay click 'continue' to save the banking/card info. Now you'll scroll down and see 4 boxes to click. You'll click all 4 and then press submit. The first box will have a pop up and you press 'Accept'. It will take a second to load and then show you 'congrats, you've been approved!' Awesome, looks good! Scroll down and click, 'confirm and continue to documents' — we're almost done!"`,
    stageTip: "Stay casual and nonchalant. It's uncomfortable for anyone to give out personal info - chat about their pets or kids to keep them relaxed.",
  },
  {
    id: 6,
    title: "Documents",
    emoji: "📝",
    script: `"The first one is the esign consent, it just lets us use your signature electronically. Scroll all the way down to the bottom and click the blue 'click here to sign'. Nice, go ahead and click next."

"This one is the PSA, it just goes over everything we already talked about. There are 2 clicks for this one, the first is going to be by your right thumb, just scroll down a little bit. It's not the yellow button, click the blue 'click here to sign'. Awesome, now it'll jump you to the last one here at the top. Sweet! Now just scroll down all the way and click next/submit."

(For the promotional credit addendum page…)
"This is me covering your first month(s)/this is me getting the price low to make it a no brainer. Scroll down and just press 'next'."

"This one is the RIC, it just makes sure you know we don't charge you an equipment or install up front and everything is part of the monthly. Scroll down and click the blue 'click here to sign'."`,
    stageTip: "Give instructions in a nonchalant and carefree way. Get them talking about something pleasant rather than focused on signing in silence.",
  },
  {
    id: 7,
    title: "Preinstall Survey",
    emoji: "✅",
    script: `"Awesome. Just click 'go back to dashboard' and we'll do this last one, the preinstall survey. Quick and easy."

"This is like 6-7 yes or no questions to make sure everything is cool and there are no 'gotchas'. I'll do what I wish my teachers in college would have done for me and give you all the answers to the test, every answer is 'yes'."

"Go ahead and click number 4, and then scroll down and press 'start'. And you'll see it asks the questions making sure it's you, making sure you know I work for Vivint and no other alarm company, it'll talk about the protection plan already included in your price not in addition to it, all that good stuff."`,
    stageTip: "Make them laugh with the 'answers to the test' line. Keeps the mood light as you finish up.",
  },
  {
    id: 8,
    title: "Wrap Up & Referrals",
    emoji: "🎉",
    script: `Once they're done with all the paperwork, send them a text so they have your number which builds credibility and boosts trust even more.

Let them know to reach out to you or Vivint if they have any issues or concerns. Let them know the tech will be by shortly and ask for referrals.

Congrats!`,
    stageTip: "End strong. They should feel good about their decision. A quick text with your contact info goes a long way for referrals later.",
  },
];
