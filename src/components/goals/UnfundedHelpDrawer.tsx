import { useState } from "react";
import { ExternalLink, ChevronRight, CircleDollarSign, Search, RefreshCw, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose } from "@/components/ui/drawer";
import { hapticLight } from "@/utils/haptics";

const CURATOR_EARNINGS_URL = "https://curator.vivint.com/dashboard/source-accountdetailsearnings";

interface UnfundedHelpDrawerProps {
  /** Number shown as the unfunded count */
  unfundedCount?: number;
  /** Render as inline text link vs standalone button */
  variant?: "inline" | "button";
}

export const UnfundedHelpDrawer = ({ unfundedCount, variant = "inline" }: UnfundedHelpDrawerProps) => {
  const [open, setOpen] = useState(false);

  const trigger = variant === "inline" ? (
    <button
      className="inline-flex items-center gap-0.5 text-primary/80 hover:text-primary underline underline-offset-2 decoration-dotted active:scale-[0.97] transition-transform"
      onClick={() => hapticLight()}
    >
      What's this?
    </button>
  ) : (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 text-xs gap-1 text-primary"
      onClick={() => hapticLight()}
    >
      <CircleDollarSign className="w-3.5 h-3.5" />
      Fix unfunded
      <ChevronRight className="w-3 h-3" />
    </Button>
  );

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {trigger}
      </DrawerTrigger>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="flex items-center gap-2">
            <CircleDollarSign className="w-5 h-5 text-primary" />
            Getting Your Money Right
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-5 overflow-y-auto">
          {/* Why it matters - keep it about money */}
          <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4">
            <p className="text-sm font-semibold text-foreground mb-1">
              💰 Why this matters to your paycheck
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              "Unfunded" means that FP hasn't paid you yet. Sometimes a customer's billing just needs a quick fix. 
              Reaching out to help them saves <strong>your sale</strong> and keeps <strong>your money</strong> on track.
            </p>
          </div>

          {/* Step 1 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</div>
              <span className="font-semibold text-sm">Check which accounts are unfunded</span>
            </div>
            <div className="ml-8 space-y-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Go to <strong>Curator → Earnings</strong> and scroll to the <strong>"Funded Category"</strong> filter. 
                Select <strong>"Unfunded"</strong> to see exactly which customers haven't funded yet.
              </p>
              <a
                href={CURATOR_EARNINGS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted text-xs font-medium text-foreground active:scale-[0.97] transition-transform"
              >
                <Search className="w-3.5 h-3.5 text-primary" />
                Open Curator Earnings
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </a>
            </div>
          </div>

          {/* Step 2 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</div>
              <span className="font-semibold text-sm">Update it in your CRM</span>
            </div>
            <div className="ml-8 space-y-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Go to your <strong>Customers</strong> page in the app. Find the customer, open their details, 
                and update their funding status. This keeps your numbers accurate and your projections real.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</div>
              <span className="font-semibold text-sm">Reach out and save the sale</span>
            </div>
            <div className="ml-8 space-y-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                A quick call or text to your customer can often fix billing issues fast. 
                You <strong>already did the hard work</strong> of getting the sale — don't let a billing hiccup cost you the commission.
              </p>
            </div>
          </div>

          {/* Motivational closer */}
          <div className="rounded-2xl bg-muted/50 p-4 flex items-start gap-3">
            <Heart className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Pro tip:</strong> Top reps check their unfunded list weekly. 
              It's the easiest way to protect income you already earned. 
              Every account you save is money back in your pocket — no extra doors needed.
            </p>
          </div>

          <DrawerClose asChild>
            <Button className="w-full" onClick={() => hapticLight()}>
              Got it
            </Button>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
