import { MessageSquare, ExternalLink, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Assistant = () => {
  // This will be replaced with your custom GPT link
  const customGPTUrl = "#";

  const capabilities = [
    "Onboarding questions and guidance",
    "Pay and compensation explanations",
    "Process questions (RIC, ID verification, service tickets)",
    "Sales scripts and objection handling",
    "Training recommendations",
    "General support questions",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
      {/* Header */}
      <div className="bg-card border-b border-border p-6">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">AI Assistant</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Get instant help and answers to your questions
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Main Card */}
        <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Your AI Sales Coach</CardTitle>
            <CardDescription className="text-base">
              Available 24/7 to help you succeed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="default"
              size="lg"
              className="w-full"
              asChild
            >
              <a href={customGPTUrl} target="_blank" rel="noopener noreferrer">
                <MessageSquare className="w-5 h-5 mr-2" />
                Start Chatting
                <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Opens in a new window
            </p>
          </CardContent>
        </Card>

        {/* Capabilities */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How the Assistant Can Help</CardTitle>
            <CardDescription>
              Get answers on a wide range of topics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {capabilities.map((capability, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-success font-semibold text-xs">✓</span>
                  </div>
                  <span className="text-sm leading-relaxed">{capability}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tips for Best Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-primary font-bold text-sm flex-shrink-0">1.</span>
              <p className="text-sm">
                <strong>Be specific:</strong> The more details you provide, the better the answer
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-primary font-bold text-sm flex-shrink-0">2.</span>
              <p className="text-sm">
                <strong>Ask follow-ups:</strong> Continue the conversation to dive deeper
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-primary font-bold text-sm flex-shrink-0">3.</span>
              <p className="text-sm">
                <strong>Use examples:</strong> Share real scenarios you're facing
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Assistant;
