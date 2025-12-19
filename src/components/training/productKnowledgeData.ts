export interface UseCase {
  title: string;
  description: string;
}

export interface Pricing {
  upfront?: string;
  months36?: string;
  months60?: string;
  payIn4?: string;
  monthly?: string;
}

export interface CompetitorComparison {
  feature: string;
  vivint: boolean | string;
  competitors: { [key: string]: boolean | string };
}

export interface ProductData {
  id: string;
  name: string;
  tagline: string;
  description: string;
  heroImage: string;
  pricing?: Pricing;
  tier1Messaging: string[];
  tier2Messaging: string[];
  benefits: string[];
  useCases: UseCase[];
  integrationFeatures: string[];
  competitorComparison?: CompetitorComparison[];
  competitorNames?: string[];
  whatsNew?: string[];
  specsImages?: string[];
}

export const productKnowledgeData: ProductData[] = [
  {
    id: "vivint-app",
    name: "The Vivint App",
    tagline: "Your home on your phone",
    description: "Control your Vivint HomeProtect security system from anywhere using our top-rated smart home app.",
    heroImage: "https://lh7-rt.googleusercontent.com/docsz/AD_4nXfxXhJgyP5dOH1ocgfDat7GbvfY-DQqEc-7R_rJhkMa_WzmFcLR6A-9CJVDSHXMrh94lhG8PDXDdjh5PAGF09b8dteBUCTqn2Kj_qw-cNSgqOyUPFyaF5P36RvEXHBVTJM=s800?key=lcj97jyBoZtMLimLXIkipA",
    tier1Messaging: [
      "Control your entire system from your smartphone from anywhere",
      "View live footage from your Doorbell Camera Pro",
      "Control your security system from your smartphone"
    ],
    tier2Messaging: [
      "View recorded footage from your camera",
      "Get notifications from your system",
      "Lock and Unlock door from your smartphone",
      "Control your thermostat from your smartphone",
      "Create Smart Actions",
      "Review your system activity feed"
    ],
    benefits: [
      "Control your whole system anytime, anywhere from a top-rated smart home app",
      "Two-way talk with anyone at your Vivint Doorbell Camera Pro",
      "Notifications and alerts let you know what's happening in and around your home"
    ],
    useCases: [
      {
        title: "Peace of mind while traveling",
        description: "You're heading out on a weekend getaway and realize halfway to the airport that you forgot to arm your system. With the Vivint App, you can arm HomeProtect from anywhere in seconds."
      },
      {
        title: "Keeping an eye outside",
        description: "It's late in the evening and you get a motion alert on your phone. With the Vivint App, you can instantly see who's at your door through the Doorbell Camera Pro."
      },
      {
        title: "Welcoming family safely",
        description: "Your teenager is getting home from school before you're off work. With HomeProtect, they can use the Vivint wireless keypad to disarm the system. You'll get a notification the moment they arrive safely."
      },
      {
        title: "Weathering the unexpected",
        description: "A storm knocks out your neighborhood's internet. With Vivint HomeProtect, your system stays connected thanks to a backup cellular connection."
      }
    ],
    integrationFeatures: [
      "Arm/disarm your security system",
      "View live and recorded video from your Vivint Doorbell Camera Pro",
      "Lock/unlock your Kwikset Smart Lock",
      "Adjust your Vivint Smart Thermostat",
      "Get notifications and alerts to know what's happening in your home"
    ]
  },
  {
    id: "doorbell-camera-pro",
    name: "Doorbell Camera Pro (Gen 2)",
    tagline: "Don't just record crime. Prevent it.",
    description: "The Doorbell Camera Pro not only notifies you when packages arrive, it is the only video doorbell camera that proactively protects them with Smart Deter technology.",
    heroImage: "https://lh7-rt.googleusercontent.com/docsz/AD_4nXeDbMYlz6UliJWyfQmbNWLKOBthT3VDnQGYfmeFm5MeDUzz1_Tl8hdAZJ3ALqwrtPIYVT1wdAULkE2o44Zcin8Tpd_dflrqHlHFI-HNuYoXs6iKTw_5fGGmWzRleUR_zA=s800?key=lcj97jyBoZtMLimLXIkipA",
    pricing: {
      upfront: "$249.99",
      months36: "$6.94/mo",
      months60: "$4.17/mo"
    },
    whatsNew: [
      "Bigger, brighter LED light ring",
      "Louder sound deterrent",
      "Improved doorstep protection"
    ],
    tier1Messaging: [
      "View your camera's live or recorded footage anywhere, anytime",
      "Know when someone's lurking in your customizable detection zones",
      "Don't just record crime, prevent it with Smart Deter",
      "See clearly day or night with built-in infrared night vision"
    ],
    tier2Messaging: [
      "Keep recording even when your WiFi goes down with onboard recording",
      "See and speak with visitors whether they ring the doorbell or not",
      "Improved doorstep protection with a bigger, brighter LED light ring",
      "See what you want to with customizable detection zones in clear HD"
    ],
    benefits: [
      "Keep packages safe with round-trip package detection and Smart Deter technology",
      "See the faces of tall visitors and packages with the widest 180°x180° field of view",
      "Stream crisp, detailed video up to 1080p, day or night",
      "Answer your door from anywhere with one-way video and two-way talk",
      "Catch all the action with Vivint Smart Clips™ recordings",
      "Built-in storage for Vivint Playback 24/7 recording"
    ],
    useCases: [
      {
        title: "Package protection",
        description: "Smart Deter uses your camera's unique light and sound feature to scare away a porch pirate checking out your daughter's birthday present that was just dropped off at your door."
      },
      {
        title: "Answer from anywhere",
        description: "Answer your door from your phone when your parents arrive early – while you're still at the park. Not only can you answer, but you can disarm the system and let them in."
      },
      {
        title: "Keeping an eye out",
        description: "Use your Vivint App to see if the package delivered this morning is still there. It was left right under the doorbell, but with the 180°x180° lens, you still see it just fine."
      },
      {
        title: "Get the complete picture",
        description: "Check your video clips to see your best friend delivering a birthday present. You see it all, including the minute-long dance she does at the end."
      }
    ],
    integrationFeatures: [
      "Set Smart Actions to record clips when windows and doors are opened",
      "The Vivint Chime Extender broadens the range of your Doorbell Camera Pro",
      "Use your Vivint Smart Hub or Vivint App to see what your camera sees",
      "Re-watch with variable length Vivint Smart Clips and Vivint Playback"
    ],
    competitorNames: ["Nest (ADT)", "Ring Wired Pro", "Arlo Wired", "SimpliSafe Pro", "Wyze Pro"],
    competitorComparison: [
      { feature: "Package Protection", vivint: true, competitors: { "Nest (ADT)": false, "Ring Wired Pro": false, "Arlo Wired": false, "SimpliSafe Pro": false, "Wyze Pro": false } },
      { feature: "180° Field of View", vivint: true, competitors: { "Nest (ADT)": false, "Ring Wired Pro": false, "Arlo Wired": "Partial", "SimpliSafe Pro": false, "Wyze Pro": false } },
      { feature: "Package Delivery Notifications", vivint: true, competitors: { "Nest (ADT)": true, "Ring Wired Pro": true, "Arlo Wired": true, "SimpliSafe Pro": false, "Wyze Pro": true } },
      { feature: "People & Package Detection", vivint: true, competitors: { "Nest (ADT)": true, "Ring Wired Pro": true, "Arlo Wired": true, "SimpliSafe Pro": false, "Wyze Pro": true } },
      { feature: "At least 1080p HDR", vivint: true, competitors: { "Nest (ADT)": true, "Ring Wired Pro": true, "Arlo Wired": true, "SimpliSafe Pro": true, "Wyze Pro": false } }
    ]
  },
  {
    id: "outdoor-camera-pro",
    name: "Outdoor Camera Pro (Gen 3)",
    tagline: "A camera that detects, and reacts",
    description: "Our most advanced AI crime deterrent yet—detects real threats, alerts you instantly, and puts lurkers on notice with RADAR-powered detection.",
    heroImage: "https://lh7-rt.googleusercontent.com/docsz/AD_4nXdcAE8ywN4EiEqcCkXDx_50JhLLnTMqBq2ODm8zFBMOlwGwd9neJYrx_eXdPitmf9lRzA81RRHpzDha2LGytfgjFOXDmmfFVeZLxj3aiBRBN44aCMC4M-kiTit6S_2Esyo=s800?key=lcj97jyBoZtMLimLXIkipA",
    pricing: {
      upfront: "$399.99",
      months36: "$11.11/mo",
      months60: "$6.67/mo"
    },
    whatsNew: [
      "RADAR-powered detection",
      "4K image sensor with 5.3x HD zoom",
      "Vehicle Protection feature",
      "Enhanced night vision",
      "Hybrid Wired Wi-Fi connection"
    ],
    tier1Messaging: [
      "Smarter detection powered by RADAR and next-gen AI",
      "Capture everything with continuous video recording",
      "Capture every detail with the upgraded 4K image sensor",
      "Protect your property with RADAR-powered Vehicle Protection",
      "Know instantly when a person or vehicle is on your property",
      "Check in from anywhere in real time from the Vivint app"
    ],
    tier2Messaging: [
      "Zoom in on details while keeping the big picture with ultra-HD video",
      "Create custom detection zones for your porch or driveway",
      "Built to withstand extreme heat, cold, rain, and snow",
      "Built-in AI processing for faster, smarter detection",
      "Hybrid wired Wi-Fi connection for smooth, fast video experience"
    ],
    benefits: [
      "RADAR + AI precision reduces false alerts and focuses on real threats",
      "Vehicle Protection reacts instantly when someone approaches your car",
      "Improved 4K image sensor with 5.3x HD zoom captures faces and license plates",
      "Enhanced night vision for clear protection around the clock",
      "Next-gen Smart Deter™ with bright LED ring and powerful speaker",
      "24/7 Playback with built-in storage",
      "Onboard AI for faster detection without relying on the cloud"
    ],
    useCases: [
      {
        title: "Protecting Your Vehicle",
        description: "Someone approaches your car overnight. With RADAR-powered Vehicle Protection, the camera instantly detects the intruder, activates Smart Deter with lights and sound, and scares them off."
      },
      {
        title: "Clarity When It Counts",
        description: "You notice someone near your porch and zoom in on the camera feed. Thanks to the 4K sensor with 5.3x HD zoom, you clearly see their face and license plate."
      },
      {
        title: "Peace of Mind After Dark",
        description: "It's past midnight and motion outside wakes you. Thanks to enhanced night vision, you see a crystal-clear view even in near total darkness."
      },
      {
        title: "Always On Guard",
        description: "You're out of town and can rewind continuous video recordings with Vivint Playback to confirm nothing happened on your property."
      }
    ],
    integrationFeatures: [
      "Use your Vivint Smart Hub or Vivint App to see what your camera sees",
      "Re-watch with Vivint Smart Clips and Vivint Playback",
      "Set Smart Actions to record clips when doors are opened or alarms triggered",
      "Connect to the Vivint Spotlight Pro for enhanced Smart Deter features"
    ],
    competitorNames: ["Nest (ADT)", "Ring", "Arlo", "SimpliSafe", "Eufy"],
    competitorComparison: [
      { feature: "Smart Deter", vivint: true, competitors: { "Nest (ADT)": false, "Ring": false, "Arlo": false, "SimpliSafe": false, "Eufy": false } },
      { feature: "5.3x HD Zoom w/ 4K sensor", vivint: true, competitors: { "Nest (ADT)": false, "Ring": false, "Arlo": false, "SimpliSafe": false, "Eufy": false } },
      { feature: "RADAR", vivint: true, competitors: { "Nest (ADT)": false, "Ring": true, "Arlo": false, "SimpliSafe": false, "Eufy": true } },
      { feature: "Two Way Talk", vivint: true, competitors: { "Nest (ADT)": true, "Ring": true, "Arlo": true, "SimpliSafe": true, "Eufy": true } },
      { feature: "Hybrid Wired/WiFi", vivint: true, competitors: { "Nest (ADT)": false, "Ring": false, "Arlo": false, "SimpliSafe": false, "Eufy": false } },
      { feature: "Tracking Spotlight", vivint: true, competitors: { "Nest (ADT)": false, "Ring": false, "Arlo": false, "SimpliSafe": false, "Eufy": false } }
    ]
  },
  {
    id: "indoor-camera-pro",
    name: "Indoor Camera Pro",
    tagline: "Stay connected and protected",
    description: "See what's happening while you're away with built-in person detection and customized detection zones for proactive home protection.",
    heroImage: "https://lh7-rt.googleusercontent.com/docsz/AD_4nXciLRX5OJ1wO-zxfExdGyICfPJNTxSEhPitt-8b1JY11HzBbzNdnYAlLjxfLdcRwPaKRdP4fnyuyuTS9-EPnG9EYq9B3UEOccHZT8x65OxXKmEadEuMA64KcNTs94tQSw=s800?key=lcj97jyBoZtMLimLXIkipA",
    pricing: {
      upfront: "$249.99",
      months36: "$6.94/mo",
      months60: "$4.17/mo"
    },
    whatsNew: [
      "One-touch callout button",
      "Smart Person detection",
      "Privacy mode",
      "150°+ field of view"
    ],
    tier1Messaging: [
      "View your camera's live or recorded footage anywhere, anytime",
      "See clearly day or night with built-in infrared night vision",
      "Keep recording even when your WIFI goes down with onboard recording",
      "Smart Person detection records what matters"
    ],
    tier2Messaging: [
      "Customizable detection zones in clear HD — day or night",
      "Customize camera to turn off when you're home and on when you leave",
      "See and speak with anyone at home with two-way talk"
    ],
    benefits: [
      "Anyone at home can quickly reach you with one-touch button",
      "Check in to see and speak with family or pets using your mobile device",
      "Crystal clear video with HD wide-angle lens",
      "Enhanced in-home security with people detection in custom zones"
    ],
    useCases: [
      {
        title: "No cell phone, no problem",
        description: "Your 10-year-old doesn't have a cell phone yet. The Indoor Camera offers a one-touch callout so she can contact you with the touch of a button."
      },
      {
        title: "Never miss a moment",
        description: "Your 9-month-old takes his first step. By the time your phone's recording, he's back on the ground. Luckily, your Indoor Camera Pro with Vivint Playback caught the action."
      },
      {
        title: "Protected by Vivint",
        description: "At dinner with friends, you get an alert that someone's in your home through a broken window. The monitoring team confirms and calls police for you."
      },
      {
        title: "Monitor sensitive areas",
        description: "You can set up a detection zone around your gun safe and be notified anytime someone approaches it."
      }
    ],
    integrationFeatures: [
      "Talk with a connected user with the press of a button",
      "View and talk with whoever is at home using the Vivint App",
      "Re-watch with Vivint Smart Clips and Vivint Playback",
      "Works with Vivint Custom Action system to trigger other devices",
      "Use as a chime extender for the Doorbell Camera Pro"
    ],
    competitorNames: ["Nest Cam (ADT)", "Ring Indoor 2nd Gen", "Arlo Essential", "SimpliSafe"],
    competitorComparison: [
      { feature: "Push to Talk Button", vivint: true, competitors: { "Nest Cam (ADT)": false, "Ring Indoor 2nd Gen": false, "Arlo Essential": false, "SimpliSafe": false } },
      { feature: "Two Way Talk", vivint: true, competitors: { "Nest Cam (ADT)": true, "Ring Indoor 2nd Gen": true, "Arlo Essential": true, "SimpliSafe": true } },
      { feature: "150°+ Field of View", vivint: true, competitors: { "Nest Cam (ADT)": false, "Ring Indoor 2nd Gen": false, "Arlo Essential": false, "SimpliSafe": false } },
      { feature: "Privacy Mode", vivint: true, competitors: { "Nest Cam (ADT)": false, "Ring Indoor 2nd Gen": "Manual cover", "Arlo Essential": true, "SimpliSafe": true } },
      { feature: "Smart Home Integration", vivint: true, competitors: { "Nest Cam (ADT)": true, "Ring Indoor 2nd Gen": true, "Arlo Essential": false, "SimpliSafe": false } }
    ]
  },
  {
    id: "vivint-playback",
    name: "Vivint Playback",
    tagline: "Never miss a moment",
    description: "Stores every minute of footage from your cameras for up to 10 days with secure DVR recording you can review from the app or Smart Hub.",
    heroImage: "https://lh7-rt.googleusercontent.com/docsz/AD_4nXeQxl9KeCUGnauk6D1GUKvVQnIPWBD500JXrEStNGsAgypNSbEJRQbw5NRG7ax9H0682hS5puKhZLaUmxY2Evc4oryXr04M87omAYY8rkHs6efTG34_lz4HlJ02aZWKDg=s800?key=lcj97jyBoZtMLimLXIkipA",
    pricing: {
      upfront: "$299.99",
      months36: "$8.33/mo",
      months60: "$4.99/mo",
      monthly: "$6.99/month"
    },
    tier1Messaging: [
      "Never miss a moment with 24/7 recording on all eligible cameras",
      "Access and share your recordings from anywhere with the Vivint App",
      "Recording up to 10 days of 24/7 footage with built-in camera storage",
      "Keep recording even when your WiFi goes down"
    ],
    tier2Messaging: [
      "Download and share your recordings quickly and easily",
      "Find footage faster with person detection event markers",
      "Access your favorite Holiday Chimes all year"
    ],
    benefits: [
      "Relive every minute of what's happened over the last 10 days",
      "Video stored directly on cameras saves your Wi-Fi bandwidth",
      "Edit and share video clips of your home's best moments",
      "More reliable than cloud options since recording continues without Wi-Fi"
    ],
    useCases: [
      {
        title: "Easy footage reruns",
        description: "Skip to where the action is with event markers guiding your way—no more watching empty rooms, just the action."
      },
      {
        title: "Reliable and fast",
        description: "With built-in storage, Playback is faster and smoother to scrub through, and always recording even if Wi-Fi goes down."
      },
      {
        title: "Sharing is caring",
        description: "Pick out moments you want to share, save them, and send them within seconds. Grandparents from out of state can see all the cute things your kids do."
      },
      {
        title: "Memories are safe",
        description: "Built-in storage is 100% encrypted and designed for your eyes only."
      }
    ],
    integrationFeatures: [
      "Store up to 10 days from up to 12 next-gen cameras",
      "View continuous video stored locally on your cameras",
      "Review footage quickly with event markers on the Vivint App"
    ]
  },
  {
    id: "smart-lock",
    name: "Kwikset Smart Lock",
    tagline: "Convenient, keyless control",
    description: "Take control of your lock from anywhere and be confident that your home is secure with the Vivint App and one-touch lockup.",
    heroImage: "https://lh7-rt.googleusercontent.com/docsz/AD_4nXc29S_qH8dhY96c7opHNleyg58S6EaUQhPbcyA55trUx_Bo8IYGKNTlOb6Z-D52mPE1zGb3GitqWjk_Hx2j9qQFns_kgzWzpb9yQjwvQ-ylJjr9h76wewBfKtkmGrQouCo=s800?key=lcj97jyBoZtMLimLXIkipA",
    pricing: {
      upfront: "$179.99 (bronze, brass, nickel) / $184.99 (matte black)",
      payIn4: "$44.99/mo or $46.25/mo"
    },
    tier1Messaging: [
      "Lock and unlock your door remotely using the Vivint app",
      "Create unique access codes for family, guests, or service providers",
      "Get real-time alerts whenever someone unlocks your door"
    ],
    tier2Messaging: [
      "Automatically disarm your security system when a valid access code is entered",
      "One-touch lockup: lock the door and arm your security system in one action",
      "Voice control with Alexa or Google Assistant"
    ],
    benefits: [
      "No need to find your keys – your unique access code gives quick entry",
      "One touch locking arms your home and adjusts the thermostat",
      "See visitors with Doorbell Camera and remotely unlock to let them in",
      "Always know who's coming and going with unique access codes"
    ],
    useCases: [
      {
        title: "On your way out",
        description: "With just a push of a button, you can lock up, turn off all the lights, arm your system, and change the temperature at the same time."
      },
      {
        title: "Leave the keys where they are",
        description: "Put in a PIN code to unlock your door. Your smart home will disarm, turn on lights, and adjust temperature as you walk in."
      },
      {
        title: "Safety for your packages",
        description: "See when the deliveryman arrives on your Doorbell Camera and unlock the door from work to let him drop it inside."
      },
      {
        title: "Let them let themselves in",
        description: "Give family their own code so they can let themselves in if they arrive early. No more keeping a spare key out in the open."
      }
    ],
    integrationFeatures: [
      "Unlock or lock your door using the Vivint App",
      "Lock your door using Amazon Echo or Google Home",
      "Let visitors in when you see them on your Doorbell Camera",
      "Create Smart Actions to lock and arm when you press the lock button",
      "Receive notifications when your door is locked or unlocked"
    ]
  },
  {
    id: "smart-thermostat",
    name: "Vivint Smart Thermostat",
    tagline: "Conserve energy and save money",
    description: "Keep your home temperature exactly where you want it. Works with your in-home sensors to auto-adjust based on your preferences.",
    heroImage: "https://lh7-rt.googleusercontent.com/docsz/AD_4nXefcrPoPULzg274y5DpP1yU0RIwVFKg3w2LnqOOqD3G0QBnIKxuTB1Ik9suYmNYMVUkk0uRYI8u03IBz5dUbLmvuCK3wjtTH2UoL_w_mu4AgHNQiiDKpTCPAELhiQzgToU=s800?key=lcj97jyBoZtMLimLXIkipA",
    pricing: {
      upfront: "$199.99",
      payIn4: "$49.99/mo"
    },
    tier1Messaging: [
      "Adjust the thermostat remotely using the Vivint app",
      "Save up to 12% annually on energy bills through Smart Comfort",
      "Automatically adjusts temperature based on whether you're home or away"
    ],
    tier2Messaging: [
      "Display lights up automatically when it senses someone nearby",
      "Sleek, modern design complements a wide range of interior styles"
    ],
    benefits: [
      "Stay comfortable and save money with Smart Comfort",
      "Control temperature using Echo, Google Home, Vivint app, or directly on thermostat",
      "Controls fade after adjusting so thermostat blends into your home's interior"
    ],
    useCases: [
      {
        title: "Conserving, not freezing",
        description: "Your smart home adjusts the temperature so you're comfortable when home and conserving energy when you're not."
      },
      {
        title: "Friend for the forgetful",
        description: "If you forget to adjust your thermostat, your in-home sensors sense no one's home and adjust to conserve energy."
      },
      {
        title: "Rushing out the door",
        description: "Smart Comfort used sensors to determine everyone left and notified you that it changed the temperature, saving money automatically."
      },
      {
        title: "Never too far from home",
        description: "You're out of town but can check in using the top-rated Vivint App. The thermostat is right where you want it."
      }
    ],
    integrationFeatures: [
      "Smart Comfort works with sensors to change temperature based on your location",
      "Change temperature at the thermostat, from Vivint App, Alexa, or Google Assistant"
    ]
  }
];

export const getProductById = (id: string): ProductData | undefined => {
  return productKnowledgeData.find(product => product.id === id);
};
