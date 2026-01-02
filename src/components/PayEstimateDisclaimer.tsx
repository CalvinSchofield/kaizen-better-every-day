import { ExternalLink } from "lucide-react";

const VIVINT_PAYSCALE_URL = "https://signin.vivint.com/app/vivint_curator_1/exki7kdcmw2IqDBrk2p7/sso/saml";

interface PayEstimateDisclaimerProps {
  className?: string;
}

export const PayEstimateDisclaimer = ({ className = "" }: PayEstimateDisclaimerProps) => {
  return (
    <p className={`text-[10px] text-muted-foreground/70 ${className}`}>
      *Estimate only. Not official Vivint figures.{" "}
      <a
        href={VIVINT_PAYSCALE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 text-primary/70 hover:text-primary underline underline-offset-2"
      >
        View official source
        <ExternalLink className="h-2.5 w-2.5" />
      </a>
    </p>
  );
};
