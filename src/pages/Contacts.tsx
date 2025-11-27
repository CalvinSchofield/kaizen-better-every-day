import { useState } from "react";
import { ArrowLeft, Phone, Download, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  role: string;
  phone: string;
  category: string;
  tips?: string[];
  notes?: string;
  vcfUrl?: string;
}

const Contacts = () => {
  const navigate = useNavigate();
  const [expandedContact, setExpandedContact] = useState<string | null>(null);

  const contacts: Contact[] = [
    // San Francisco 2025 Office
    {
      id: "calvin",
      name: "Calvin Schofield",
      role: "Area Director",
      phone: "(469) 715-7056",
      category: "San Francisco 2025 Office",
    },
    {
      id: "quinn",
      name: "Quinn Gleed",
      role: "Manager",
      phone: "(206) 422-4462",
      category: "San Francisco 2025 Office",
    },
    {
      id: "misael",
      name: "Misael Sanchez",
      role: "Manager",
      phone: "(484) 664-0518",
      category: "San Francisco 2025 Office",
    },
    {
      id: "stephen",
      name: "Stephen Kastner",
      role: "Team Lead",
      phone: "(707) 337-0408",
      category: "San Francisco 2025 Office",
    },
    {
      id: "adam",
      name: "Adam Schofield",
      role: "Team Lead",
      phone: "(972) 369-6386",
      category: "San Francisco 2025 Office",
    },
    {
      id: "cristian",
      name: "Cristian Rosas",
      role: "OM",
      phone: "(559) 699-7874",
      category: "San Francisco 2025 Office",
      notes: "INV Office: INV Cristian Rosas",
    },
    {
      id: "kelton",
      name: "Kelton Higgins",
      role: "Solar Specialist",
      phone: "Contact Calvin",
      category: "San Francisco 2025 Office",
    },
    // Triumph Leadership
    {
      id: "gunnar",
      name: "Gunnar Bramwell",
      role: "Regional Manager",
      phone: "(801) 616-6301",
      category: "Triumph Leadership",
    },
    {
      id: "josh",
      name: "Josh Gruwell",
      role: "Sr. Regional Manager",
      phone: "(801) 850-2596",
      category: "Triumph Leadership",
    },
    {
      id: "aaron",
      name: "Aaron Doria",
      role: "Partner",
      phone: "(619) 410-2391",
      category: "Triumph Leadership",
    },
    {
      id: "puck",
      name: "Puck Heriford",
      role: "Partner",
      phone: "(801) 318-2919",
      category: "Triumph Leadership",
    },
    // Important Vivint Contacts
    {
      id: "ac",
      name: "Account Creations",
      role: "Vivint Support",
      phone: "(801) 377-9111",
      category: "Important Vivint Contacts",
      tips: [
        "Text first for non-urgent matters. For urgent cases, call and use extension 1,1,1",
        "Call AC if pre-install surveys fail on Street Genie - have account number ready",
        "They can provide key account info: equipment status, payment status, write-off history",
        "Use text number for scheduling jobs with 4-hour window (corporate) or 2-hour (summer techs)",
      ],
      notes: "Template: 'Can you help me schedule this job? Date/time: ___ INV: ___ A#: ___ Customer Name: ___'",
    },
    {
      id: "sos",
      name: "SOS",
      role: "Customer Problems",
      phone: "(801) 377-9750",
      category: "Important Vivint Contacts",
      tips: [
        "Use for customer problems only",
        "Your job isn't customer service - assess, try to upgrade, then hand off",
        "Say 'I'll have the company reach out to solve this!' then text SOS briefly",
      ],
    },
    {
      id: "buyouts",
      name: "Buyouts",
      role: "Contract Buyouts",
      phone: "(801) 377-9060",
      category: "Important Vivint Contacts",
      tips: [
        "Reps can approve buyouts through Street Genie up to $1,500",
        "First $1,000 covered by Vivint, rep pays 100% over $1,000",
        "Buyouts over $2,000 often result in contract cancellation",
        "PI4 Front Door and Outdoor Protect not eligible (need 2 cams)",
        "Try to keep service at $44.99+ to avoid extra deductions",
        "Below $39.99 triggers upfront deduction",
      ],
    },
    {
      id: "1stop",
      name: "1Stop",
      role: "Vivint Support",
      phone: "(801) 377-9001",
      category: "Important Vivint Contacts",
    },
    {
      id: "loyalty",
      name: "Customer Loyalty",
      role: "Customer Support",
      phone: "(800) 216-5232",
      category: "Important Vivint Contacts",
      tips: [
        "Give this number to customers past their ROR period",
        "Let professionals handle their issues and concerns",
      ],
    },
    {
      id: "assets",
      name: "Sales Assets",
      role: "Equipment & Materials",
      phone: "(385) 355-3095",
      category: "Important Vivint Contacts",
      tips: [
        "Email or call for iPads, jerseys, hats, etc.",
        "Contact if you drop and break your iPad",
      ],
      notes: "Email: salesassets@vivint.com",
    },
    {
      id: "licensing",
      name: "State Licensing",
      role: "Licensing Support",
      phone: "(385) 355-3001",
      category: "Important Vivint Contacts",
    },
    {
      id: "housing",
      name: "Housing",
      role: "Housing Support",
      phone: "(801) 765-8398",
      category: "Important Vivint Contacts",
    },
    {
      id: "paybyphone",
      name: "Pay by Phone",
      role: "Payment Support",
      phone: "(800) 216-5232",
      category: "Important Vivint Contacts",
      tips: [
        "Customer must call from their phone to add payment method before install",
        "Have account/service # ready",
        "Call with them if possible",
        "Robot answers first. After 3 attempts between 8am-6pm, reach live agent",
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
      <div className="bg-card border-b border-border">
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
      <div className="max-w-lg mx-auto px-4 py-6 space-y-8">
        {categories.map((category) => (
          <div key={category}>
            <h2 className="text-lg font-semibold mb-3">{category}</h2>
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
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <CardTitle className="text-base">{contact.name}</CardTitle>
                            <CardDescription className="text-sm">
                              {contact.role}
                            </CardDescription>
                          </div>
                          {hasDetails && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full flex-shrink-0"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Button
                          variant="outline"
                          className="w-full"
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a href={`tel:${contact.phone.replace(/[^0-9]/g, "")}`}>
                            <Phone className="w-4 h-4 mr-2" />
                            {contact.phone}
                          </a>
                        </Button>

                        {isExpanded && hasDetails && (
                          <div className="pt-3 border-t border-border space-y-3">
                            {contact.tips && (
                              <div>
                                <h4 className="text-sm font-semibold mb-2">Tips & Info</h4>
                                <ul className="space-y-1.5 text-sm text-muted-foreground">
                                  {contact.tips.map((tip, idx) => (
                                    <li key={idx} className="flex gap-2">
                                      <span className="text-primary mt-0.5">•</span>
                                      <span>{tip}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {contact.notes && (
                              <div>
                                <h4 className="text-sm font-semibold mb-2">Notes</h4>
                                <p className="text-sm text-muted-foreground">{contact.notes}</p>
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
