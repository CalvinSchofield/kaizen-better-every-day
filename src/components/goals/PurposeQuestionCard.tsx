import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Question {questionNumber} of {totalQuestions}
        </span>
      </div>

      {/* Question */}
      <Label className="text-lg font-medium leading-relaxed block">
        {question}
      </Label>

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
        {value.trim() ? `${value.trim().split(/\s+/).length} words` : "Optional, but your answers help create a more personal purpose statement"}
      </p>
    </div>
  );
};
