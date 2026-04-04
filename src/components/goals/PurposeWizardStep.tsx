import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, Sparkles, Loader2, Edit3, RefreshCw, Heart, Check } from "lucide-react";
import { PurposeQuestionCard } from "./PurposeQuestionCard";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const PURPOSE_QUESTIONS = [
  "Why did you choose to work here and sell this summer instead of doing something easier?",
  "What problem, frustration, or limitation in your life are you trying to change by having a big summer?",
  "If you hit your goals this summer, what specifically changes in your day-to-day life over the next 12–24 months?",
  "How does winning this summer move you closer to the person you want to be or the life you want in 5 years?",
  "Who benefits if you succeed this summer — and how?",
  "What are you willing to sacrifice or do differently this summer to make these goals non-negotiable?",
];

interface PurposeWizardStepProps {
  initialStatement?: string;
  initialAnswers?: Record<string, string>;
  onComplete: (statement: string, answers: Record<string, string>) => void;
  onSkip?: () => void;
}

type PurposePhase = 'intro' | 'questions' | 'generating' | 'review' | 'editing';

export const PurposeWizardStep = ({
  initialStatement,
  initialAnswers = {},
  onComplete,
  onSkip,
}: PurposeWizardStepProps) => {
  const [phase, setPhase] = useState<PurposePhase>(initialStatement ? 'review' : 'intro');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [generatedStatement, setGeneratedStatement] = useState(initialStatement || '');
  const [editedStatement, setEditedStatement] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnswerChange = (value: string) => {
    setAnswers(prev => ({
      ...prev,
      [PURPOSE_QUESTIONS[currentQuestion]]: value,
    }));
  };

  const handleNextQuestion = () => {
    if (currentQuestion < PURPOSE_QUESTIONS.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      // All questions answered, generate purpose
      generatePurpose();
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    } else {
      setPhase('intro');
    }
  };

  const generatePurpose = async () => {
    setPhase('generating');
    setError(null);
    setIsGenerating(true);

    try {
      const answersArray = PURPOSE_QUESTIONS.map(q => ({
        question: q,
        answer: answers[q] || '',
      })).filter(a => a.answer.trim());

      if (answersArray.length === 0) {
        // No answers provided, create a generic prompt
        setGeneratedStatement("I'm working this summer to build a better future for myself and prove what I'm capable of achieving.");
        setPhase('review');
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke('generate-purpose-statement', {
        body: { answers: answersArray },
      });

      if (fnError) throw fnError;

      if (data?.purpose_statement) {
        setGeneratedStatement(data.purpose_statement);
        setPhase('review');
      } else {
        throw new Error('No purpose statement generated');
      }
    } catch (err) {
      console.error('Error generating purpose:', err);
      setError('Failed to generate purpose statement. Please try again.');
      setPhase('questions');
      setCurrentQuestion(PURPOSE_QUESTIONS.length - 1);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEdit = () => {
    setEditedStatement(generatedStatement);
    setPhase('editing');
  };

  const handleSaveEdit = () => {
    setGeneratedStatement(editedStatement);
    setPhase('review');
  };

  const handleConfirm = () => {
    onComplete(generatedStatement, answers);
  };

  // Intro screen
  if (phase === 'intro') {
    return (
      <div className="space-y-6 text-center">
        <div className="py-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Heart className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Before we set numbers, let's talk purpose</h2>
          <p className="text-muted-foreground">
            Your goals mean more when you know what you're fighting for
          </p>
        </div>

        <div className="space-y-3">
          <Button onClick={() => setPhase('questions')} className="w-full" size="lg">
            <Sparkles className="h-4 w-4 mr-2" />
            Let's Go
          </Button>
          {onSkip && (
            <Button variant="ghost" onClick={onSkip} className="w-full text-muted-foreground">
              Skip for now
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Questions phase
  if (phase === 'questions') {
    const currentAnswer = answers[PURPOSE_QUESTIONS[currentQuestion]] || '';
    
    return (
      <div className="space-y-6">
        {/* Progress bar */}
        <div className="flex gap-1">
          {PURPOSE_QUESTIONS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= currentQuestion ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        <PurposeQuestionCard
          questionNumber={currentQuestion + 1}
          totalQuestions={PURPOSE_QUESTIONS.length}
          question={PURPOSE_QUESTIONS[currentQuestion]}
          value={currentAnswer}
          onChange={handleAnswerChange}
        />

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handlePrevQuestion}
            className="flex-1"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={handleNextQuestion}
            className="flex-1"
          >
            {currentQuestion === PURPOSE_QUESTIONS.length - 1 ? (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Generating phase
  if (phase === 'generating') {
    return (
      <div className="space-y-6 text-center py-12">
        <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
        <div>
          <h3 className="text-lg font-medium mb-1">Crafting your purpose statement...</h3>
          <p className="text-sm text-muted-foreground">
            Distilling your answers into something powerful
          </p>
        </div>
      </div>
    );
  }

  // Editing phase
  if (phase === 'editing') {
    return (
      <div className="space-y-6">
        <div className="text-center mb-4">
          <Edit3 className="h-8 w-8 mx-auto text-primary mb-2" />
          <h3 className="text-lg font-medium">Edit Your Purpose</h3>
          <p className="text-sm text-muted-foreground">
            Make it feel more like you
          </p>
        </div>

        <Textarea
          value={editedStatement}
          onChange={(e) => setEditedStatement(e.target.value)}
          className="min-h-[120px] text-base"
          placeholder="Your purpose statement..."
        />

        <p className="text-xs text-muted-foreground text-center">
          Aim for 1-2 sentences that capture your core motivation
        </p>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setPhase('review')}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveEdit}
            className="flex-1"
            disabled={!editedStatement.trim()}
          >
            Save
          </Button>
        </div>

        <Button
          variant="ghost"
          onClick={generatePurpose}
          className="w-full text-muted-foreground"
          disabled={isGenerating}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isGenerating && "animate-spin")} />
          Regenerate with AI
        </Button>
      </div>
    );
  }

  // Review phase
  return (
    <div className="space-y-6">
      <div className="text-center mb-4">
        <Heart className="h-8 w-8 mx-auto text-primary mb-2" />
        <h3 className="text-lg font-medium">Your Purpose</h3>
      </div>

      {/* Purpose statement display */}
      <div className="rounded-xl bg-primary/5 border border-primary/20 p-6">
        <p className="text-lg font-medium italic text-center leading-relaxed">
          "{generatedStatement}"
        </p>
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={handleEdit}
          className="flex-1"
        >
          <Edit3 className="h-4 w-4 mr-2" />
          Edit
        </Button>
        <Button
          onClick={handleConfirm}
          className="flex-1"
        >
          <Check className="h-4 w-4 mr-2" />
          This is it
        </Button>
      </div>
    </div>
  );
};
