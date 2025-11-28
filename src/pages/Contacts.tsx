import { useState } from "react";
import { ArrowLeft, Phone, Download, ChevronDown, ChevronUp, MessageSquare, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  role: string;
  phone?: string;
  textPhone?: string;
  email?: string;
  category: string;
  tips?: string[];
  notes?: string;
  vcfUrl?: string;
}

const Contacts = () => {
  const navigate = useNavigate();
  const [expandedContact, setExpandedContact] = useState<string | null>(null);

  const contacts: Contact[] = [
    {
      id: "1stop",
      name: "1Stop / Sales Assets",
      role: "General Support & Equipment",
      phone: "(888) 324-5771",
      textPhone: "(801) 509-9080",
      email: "1stop@vivint.com",
      category: "Important Vivint Contacts",
      tips: [
        "Use for rep promised credits, password reset, rep office changes, onboarding questions",
        "Also handles account funding status, commissions questions, iPads/knocking polos/badge ID",
        "For iPads/jerseys/hats, can also email salesassets@vivint.com",
      ],
      notes: "Hours: Mon-Sat 7 AM-6 PM (MST), Sunday Closed. Phone: Option 1, 3, 1",
    },
    {
      id: "ac",
      name: "Account Creations",
      role: "Account Setup & Scheduling",
      phone: "(888) 324-5771",
      textPhone: "(435) 466-7224",
      email: "acadvocates@vivint.com",
      category: "Important Vivint Contacts",
      tips: [
        "Front line: Pre-install surveys, scheduling technicians, upgrade support",
        "Genie Bar: Finance app troubleshooting, customer pre-qualification, package questions",
        "Advocates: Post Activation Upgrades, Extending ROR, Post Activation Account Fixes, Solar Arbitration",
      ],
      notes: "Hours vary by department. Phone extension: 1,1, AC IVR. For scheduling jobs, use button below.",
    },
    {
      id: "sos",
      name: "SOS",
      role: "Escalated Customer Issues",
      phone: "(800) 236-6808",
      textPhone: "(801) 823-4406",
      email: "sos@vivint.com",
      category: "Important Vivint Contacts",
      tips: [
        "Use for escalated customers with non-troubleshooting issues (charged upfront when shouldn't have been, billing escalations, other concerns)",
        "Also handles ordering and scheduling upgrades/add-ons, processing downgrades, scheduling work orders",
        "Extend ROR period, Schedule Incomplete Installs",
      ],
      notes: "Hours: Mon-Fri 7am-6pm (MST). Phone available M-F: 9 AM-5 PM. Saturday 8:30am-5pm (Text or Email Only). Sunday Closed",
    },
    {
      id: "qrf",
      name: "QRF",
      role: "Equipment Troubleshooting",
      email: "qrfinbox@vivint.com",
      category: "Important Vivint Contacts",
      tips: [
        "Use for equipment troubleshooting only",
      ],
      notes: "Hours: Mon-Fri 7am-6pm (MST), Saturday 8:30am-5pm (Text or Email Only), Sunday Closed",
    },
    {
      id: "buyouts",
      name: "Buyouts",
      role: "Contract Buyouts",
      phone: "(801) 377-9060",
      textPhone: "(435) 222-2010",
      email: "buyout@vivint.com",
      category: "Important Vivint Contacts",
      tips: [
        "Adjust buyout amounts, buyout questions, elite fulfillment questions",
        "Reps can approve buyouts through Street Genie up to $1,500",
        "First $1,000 covered by Vivint, rep pays 100% over $1,000",
        "Buyouts over $2,000 often result in contract cancellation",
      ],
      notes: "Hours: Mon-Fri 7 AM-6 PM (MST), Saturday 9 AM-5 PM (MST)",
    },
    {
      id: "customer-care",
      name: "Customer Care",
      role: "General Customer Support",
      phone: "(800) 678-2635",
      category: "Important Vivint Contacts",
      tips: [
        "General customer service line for basic inquiries",
      ],
    },
    {
      id: "loyalty",
      name: "Customer Loyalty",
      role: "Customer Retention",
      phone: "(877) 275-0177",
      category: "Important Vivint Contacts",
      tips: [
        "Give this number to customers past their ROR period",
        "Let professionals handle their issues and concerns",
      ],
    },
    {
      id: "licensing",
      name: "State Licensing",
      role: "Licensing Support",
      phone: "(888) 324-5771",
      email: "employeelicensing@vivint.com",
      category: "Important Vivint Contacts",
      tips: [
        "Applications, fees, renewals, fingerprints",
      ],
      notes: "Hours: Mon-Fri 9 am-5 pm (MST), Sat-Sun Closed. Phone extension: 1,3,2",
    },
    {
      id: "housing",
      name: "Housing",
      role: "Housing Support",
      phone: "(888) 324-5771",
      email: "housing@vivint.com",
      category: "Important Vivint Contacts",
      tips: [
        "Summer housing, rent & utility deductions",
      ],
      notes: "Hours: Mon-Fri 9 am-5 pm (MST), Sat-Sun Closed. Phone extension: 1,3,4",
    },
    {
      id: "arbitration",
      name: "Arbitration",
      role: "Arbitration Requests",
      email: "accountarbitration@vivint.com",
      category: "Important Vivint Contacts",
      tips: [
        "Arbitration questions, requests",
      ],
      notes: "Hours: Monday-Friday 9 AM-5 PM (MST)",
    },
    {
      id: "compliance",
      name: "Compliance",
      role: "Compliance Questions",
      email: "joshua.powell@vivint.com",
      textPhone: "(385) 250-4896",
      category: "Important Vivint Contacts",
      tips: [
        "Compliance questions (Josh Powell)",
      ],
    },
  ];

  const categories = Array.from(new Set(contacts.map(c => c.category)));

  const handleDownloadAll = () => {
    toast.success("Download feature coming soon! For now, manually save contacts you need.");
  };

  const toggleExpand = (contactId: string) => {
    setExpandedContact(expandedContact === contactId ? null : contactId);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/tools")}
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Useful Contacts</h1>
              <p className="text-sm text-muted-foreground">
                Key contacts and helpful tips
              </p>
            </div>
          </div>

          <Button
            onClick={handleDownloadAll}
            className="w-full"
            variant="outline"
          >
            <Download className="w-4 h-4 mr-2" />
            Download All Contacts
          </Button>
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
                  const hasDetails = contact.tips || contact.notes;

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
                              asChild
                              onClick={(e) => e.stopPropagation()}
                            >
                              <a href={`tel:${contact.phone.replace(/[^0-9]/g, "")}`}>
                                <Phone className="w-3.5 h-3.5 mr-2" />
                                Call: {contact.phone}
                              </a>
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
                              <a href={`sms:${contact.textPhone.replace(/[^0-9]/g, "")}`}>
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
                            {contact.tips && (
                              <div>
                                <h4 className="text-xs font-semibold mb-1.5">Tips & Info</h4>
                                <ul className="space-y-1 text-xs text-muted-foreground">
                                  {contact.tips.map((tip, idx) => (
                                    <li key={idx} className="flex gap-1.5">
                                      <span className="text-primary mt-0.5 flex-shrink-0">•</span>
                                      <span>{tip}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {contact.notes && (
                              <div>
                                <h4 className="text-xs font-semibold mb-1.5">Notes</h4>
                                <p className="text-xs text-muted-foreground mb-2">{contact.notes}</p>
                                {contact.id === "ac" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-xs"
                                    asChild
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <a href={`sms:${contact.textPhone?.replace(/[^0-9]/g, "")}&body=Can you help me schedule this job?%0D%0A%0D%0ADate:%20%0D%0ATime:%20%0D%0AAccount%20number:%20%0D%0ADispatch%20Office:`}>
                                      <MessageSquare className="w-3 h-3 mr-1" />
                                      Send Scheduling Text
                                    </a>
                                  </Button>
                                )}
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
