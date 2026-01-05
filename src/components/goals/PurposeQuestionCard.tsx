import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface PurposeQuestionCardProps {
  questionNumber: number;
  totalQuestions: number;
  question: string;
  value: string;
  onChange: (value: string) => void;
}

export const PurposeQuestionCard = ({
  questionNumber,
  totalQuestions,
  question,
  value,
  onChange,
}: PurposeQuestionCardProps) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="space-y-4">
      {/* Question number badge + question */}
      <div className="space-y-2">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-medium">
          {questionNumber}
        </span>
        <p className="text-lg font-medium leading-relaxed">
          {question}
        </p>
      </div>

      {/* Answer input */}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Share your thoughts..."
        className={cn(
          "min-h-[120px] text-base resize-none transition-all duration-200",
          isFocused && "ring-2 ring-primary"
        )}
      />

      {/* Helper text */}
      <p className="text-xs text-muted-foreground">
        {value.trim() ? `${value.trim().split(/\s+/).length} words` : "Optional, but helps personalize your purpose"}
      </p>
    </div>
  );
};
