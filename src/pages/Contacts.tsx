import { useState } from "react";
import { ArrowLeft, Phone, Download, ChevronDown, ChevronUp, MessageSquare, Mail, Copy, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Contact {
  id: string;
  name: string;
  role: string;
  phone?: string;
  textPhone?: string;
  prefilledText?: string;
  email?: string;
  category: string;
  useFor?: string[];
  hours?: string;
}

const Contacts = () => {
  const navigate = useNavigate();
  const [expandedContact, setExpandedContact] = useState<string | null>(null);
  const [aiInput, setAiInput] = useState("");
  const [aiRecommendation, setAiRecommendation] = useState("");
  const [aiAction, setAiAction] = useState<{ type: string; contact: string; prefilledText?: string } | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const contacts: Contact[] = [
    // Vivint Support Contacts
    {
      id: "ac-frontline",
      name: "Account Creation - Front Line",
      role: "Main Scheduling Help",
      phone: "888-324-5771",
      textPhone: "435-466-7224",
      prefilledText: "Hey! Can you help me schedule this job?\n\nAccount Number:\nDate:\nTime:\nInstall office:\n\nThanks!",
      email: "acadvocates@vivint.com",
      category: "Vivint Support Contacts",
      useFor: [
        "Pre-install surveys",
        "Scheduling technicians",
        "Customer pre-qualification",
        "Upgrade support",
        "Package questions before activation",
      ],
    },
    {
      id: "ac-advocates",
      name: "Account Creation - Advocates",
      role: "Post-Activation Support",
      phone: "888-324-5771",
      email: "acadvocates@vivint.com",
      category: "Vivint Support Contacts",
      useFor: [
        "Fixing issues after activation",
        "Extending ROR",
        "Post-activation upgrades",
        "Creating ROR appointments",
        "Solar arbitration and account creation",
      ],
      hours: "Mon-Thur 7AM-11PM MST · Fri-Sat 7AM-12AM MST · Sun 9AM-5:30PM MST",
    },
    {
      id: "1stop",
      name: "1Stop / Assets",
      role: "Passwords, Commissions, Equipment",
      phone: "888-324-5771",
      textPhone: "801-509-9080",
      email: "1stop@vivint.com",
      category: "Vivint Support Contacts",
      useFor: [
        "Password reset",
        "Rep promised credits",
        "Office changes",
        "Onboarding questions",
        "Account funding status",
        "Commissions questions",
        "iPads, knocking polos, badge ID",
      ],
      hours: "Mon-Sat 7AM-6PM MST · Sunday Closed",
    },
    {
      id: "sos",
      name: "SOS",
      role: "Escalated Customer Issues",
      phone: "800-236-6808",
      textPhone: "801-823-4406",
      email: "sos@vivint.com",
      category: "Vivint Support Contacts",
      useFor: [
        "Escalated customers",
        "Billing escalations",
        "Upgrades / add-ons",
        "Processing downgrades",
        "Scheduling incomplete installs",
        "Extending ROR",
        "Work orders",
      ],
      hours: "Mon-Fri 7AM-6PM MST · Saturday 8:30AM-5PM MST · Sunday Closed",
    },
    {
      id: "qrf",
      name: "QRF",
      role: "Equipment Troubleshooting",
      email: "qrfInbox@vivint.com",
      category: "Vivint Support Contacts",
      useFor: [
        "Equipment troubleshooting",
        "Install issues that need fixes",
        "Support before calling SOS",
      ],
      hours: "Mon-Fri 7AM-6PM MST · Saturday 8:30AM-5PM MST · Sunday Closed",
    },
    {
      id: "buyouts",
      name: "Buyouts",
      role: "Buyout Amounts and Questions",
      textPhone: "435-222-2010",
      email: "buyout@vivint.com",
      category: "Vivint Support Contacts",
      useFor: [
        "Buyout amounts",
        "Buyout questions",
        "Elite fulfillment questions",
      ],
      hours: "Mon-Fri 7AM-6PM MST · Saturday 9AM-5PM MST",
    },
    {
      id: "licensing",
      name: "State Licensing",
      role: "Applications, Fees, Renewals",
      phone: "888-324-5771",
      email: "employeelicensing@vivint.com",
      category: "Vivint Support Contacts",
      useFor: [
        "Applications",
        "Fees",
        "Renewals",
        "Fingerprints",
      ],
      hours: "Mon-Fri 9AM-5PM MST",
    },
    {
      id: "housing",
      name: "Housing",
      role: "Summer Housing and Deductions",
      phone: "888-324-5771",
      email: "housing@vivint.com",
      category: "Vivint Support Contacts",
      useFor: [
        "Summer housing",
        "Rent questions",
        "Utility deductions",
      ],
      hours: "Mon-Fri 9AM-5PM MST",
    },
    {
      id: "arbitration",
      name: "Arbitration",
      role: "Arbitration Questions",
      email: "accountarbitration@vivint.com",
      category: "Vivint Support Contacts",
      useFor: [
        "Arbitration questions",
        "Arbitration requests",
      ],
      hours: "Mon-Fri 9AM-5PM MST",
    },
    {
      id: "compliance",
      name: "Compliance - Josh Powell",
      role: "Compliance Questions",
      textPhone: "385-250-4896",
      email: "joshua.powell@vivint.com",
      category: "Vivint Support Contacts",
      useFor: [
        "Compliance questions",
      ],
    },
    // Customer Contacts
    {
      id: "customer-care",
      name: "Customer Care",
      role: "General Customer Support",
      phone: "800-678-2635",
      category: "Customer Contacts (Give to Customers Only)",
    },
    {
      id: "customer-loyalty",
      name: "Customer Loyalty",
      role: "Customer Retention",
      phone: "877-275-0177",
      category: "Customer Contacts (Give to Customers Only)",
    },
    {
      id: "military-support",
      name: "Military Support",
      role: "Military Customer Support",
      phone: "855-368-8568",
      category: "Customer Contacts (Give to Customers Only)",
    },
    {
      id: "customer-buyout",
      name: "Customer Buyout Line",
      role: "Customer Buyout Support",
      phone: "844-856-7254",
      category: "Customer Contacts (Give to Customers Only)",
    },
    {
      id: "citizens",
      name: "Citizens",
      role: "Citizens Support",
      phone: "844-737-6900",
      category: "Customer Contacts (Give to Customers Only)",
    },
    {
      id: "citizens-loans",
      name: "Citizens LOANS",
      role: "Citizens Loan Support",
      phone: "877-545-5691",
      category: "Customer Contacts (Give to Customers Only)",
    },
    {
      id: "equifax",
      name: "Equifax Unfreeze",
      role: "Credit Unfreeze",
      phone: "888-298-0045",
      category: "Customer Contacts (Give to Customers Only)",
    },
    {
      id: "fortiva",
      name: "Fortiva",
      role: "Fortiva Support",
      phone: "800-710-2961",
      category: "Customer Contacts (Give to Customers Only)",
    },
  ];

  const categories = Array.from(new Set(contacts.map(c => c.category)));

  const handleDownloadAll = async () => {
    try {
      // Fetch and download the master VCF file with correct MIME type
      const response = await fetch("/Vivint_Master_Contacts.vcf");
      const vcfContent = await response.text();
      const blob = new Blob([vcfContent], { type: "text/vcard;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Vivint_Contacts.vcf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success("All contacts downloaded! Import the file to your phone's contacts.");
    } catch (error) {
      console.error("Error downloading contacts:", error);
      toast.error("Failed to download contacts. Please try again.");
    }
  };

  const toggleExpand = (contactId: string) => {
    setExpandedContact(expandedContact === contactId ? null : contactId);
  };

  const handleAiRecommendation = async () => {
    if (!aiInput.trim()) return;
    
    setIsLoadingAi(true);
    setAiRecommendation("");
    setAiAction(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('recommend-contact', {
        body: { situation: aiInput }
      });
      
      if (error) throw error;
      
      setAiRecommendation(data.recommendation || "Unable to determine the best contact. Please browse the list below.");
      setAiAction(data.action || null);
    } catch (error) {
      console.error("Error getting AI recommendation:", error);
      toast.error("Failed to get recommendation. Please try again.");
    } finally {
      setIsLoadingAi(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/tools")}
                className="rounded-full"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-2xl font-bold">Useful Contacts</h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownloadAll}
              className="flex flex-col h-auto py-2 px-3 gap-1"
            >
              <Download className="w-4 h-4" />
              <span className="text-[10px]">Download</span>
            </Button>
          </div>

          {/* AI Recommendation */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Describe your situation..."
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAiRecommendation()}
                className="flex-1"
              />
              <Button 
                onClick={handleAiRecommendation}
                disabled={isLoadingAi || !aiInput.trim()}
                size="icon"
              >
                {isLoadingAi ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span className="text-sm">✨</span>
                )}
              </Button>
            </div>
            {aiRecommendation && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-3 pb-3 space-y-3">
                  <p className="text-sm text-foreground">{aiRecommendation}</p>
                  {aiAction && (
                    <div className="flex justify-end">
                      {aiAction.type === "call" && (
                        <a
                          href={`tel:${aiAction.contact}`}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                        >
                          <Phone className="w-4 h-4" />
                          Call {aiAction.contact}
                        </a>
                      )}
                      {aiAction.type === "text" && (
                        <a
                          href={`sms:${aiAction.contact}${aiAction.prefilledText ? `&body=${encodeURIComponent(aiAction.prefilledText)}` : ''}`}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Text {aiAction.contact}
                        </a>
                      )}
                      {aiAction.type === "email" && (
                        <a
                          href={`mailto:${aiAction.contact}${aiAction.prefilledText ? `?body=${encodeURIComponent(aiAction.prefilledText)}` : ''}`}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                        >
                          <Mail className="w-4 h-4" />
                          Email {aiAction.contact}
                        </a>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {categories.map((category) => (
          <div key={category}>
            <h2 className="text-base font-semibold mb-3 text-foreground">{category}</h2>
            <div className="space-y-3">
              {contacts
                .filter((c) => c.category === category)
                .map((contact) => {
                  const isExpanded = expandedContact === contact.id;
                  const hasDetails = contact.useFor || contact.hours;

                  return (
                    <Card
                      key={contact.id}
                      className={`transition-all ${hasDetails ? "cursor-pointer" : ""}`}
                      onClick={() => hasDetails && toggleExpand(contact.id)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm font-semibold truncate">{contact.name}</CardTitle>
                            <CardDescription className="text-xs truncate">
                              {contact.role}
                            </CardDescription>
                          </div>
                          {hasDetails && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full flex-shrink-0 h-7 w-7"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-0">
                        <div className="flex flex-col gap-2">
                          {contact.phone && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-xs justify-start"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (contact.category === "Customer Contacts (Give to Customers Only)") {
                                  copyToClipboard(contact.phone, "Phone number");
                                } else {
                                  window.location.href = `tel:${contact.phone.replace(/[^0-9]/g, "")}`;
                                }
                              }}
                            >
                              {contact.category === "Customer Contacts (Give to Customers Only)" ? (
                                <>
                                  <Copy className="w-3.5 h-3.5 mr-2" />
                                  Copy: {contact.phone}
                                </>
                              ) : (
                                <>
                                  <Phone className="w-3.5 h-3.5 mr-2" />
                                  Call: {contact.phone}
                                </>
                              )}
                            </Button>
                          )}
                          
                          {contact.textPhone && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-xs justify-start"
                              asChild
                              onClick={(e) => e.stopPropagation()}
                            >
                              <a 
                                href={contact.prefilledText 
                                  ? `sms:${contact.textPhone.replace(/[^0-9]/g, "")}&body=${encodeURIComponent(contact.prefilledText)}`
                                  : `sms:${contact.textPhone.replace(/[^0-9]/g, "")}`
                                }
                              >
                                <MessageSquare className="w-3.5 h-3.5 mr-2" />
                                Text: {contact.textPhone}
                              </a>
                            </Button>
                          )}

                          {contact.email && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-xs justify-start"
                              asChild
                              onClick={(e) => e.stopPropagation()}
                            >
                              <a href={`mailto:${contact.email}`}>
                                <Mail className="w-3.5 h-3.5 mr-2" />
                                <span className="truncate">{contact.email}</span>
                              </a>
                            </Button>
                          )}
                        </div>

                        {isExpanded && hasDetails && (
                          <div className="pt-2 border-t border-border space-y-3">
                            {contact.useFor && (
                              <div>
                                <h4 className="text-xs font-semibold mb-1.5">Use For</h4>
                                <ul className="space-y-1 text-xs text-muted-foreground">
                                  {contact.useFor.map((item, idx) => (
                                    <li key={idx} className="flex gap-1.5">
                                      <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {contact.hours && (
                              <div>
                                <h4 className="text-xs font-semibold mb-1.5">Hours</h4>
                                <p className="text-xs text-muted-foreground">{contact.hours}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Contacts;
