import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Bug } from "lucide-react";

const DebugNotionButton = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDebug = async () => {
    setLoading(true);
    console.log("Fetching debug info for Ring Doorbell...");

    try {
      // Ring Doorbell (Battery) page ID from Notion
      const pageId = "14d070fe3bc28077a2cec20ec80e00c4";
      
      const { data, error } = await supabase.functions.invoke("debug-notion-blocks", {
        body: { pageId }
      });

      if (error) throw error;

      console.log("Debug data:", data);
      console.log("Number of blocks:", data.blockCount);
      
      // Log each block's type and some content
      data.blocks.forEach((block: any, index: number) => {
        console.log(`\n--- Block ${index + 1}: ${block.type} ---`);
        
        if (block.type === 'callout') {
          const calloutText = block.callout?.rich_text?.map((rt: any) => rt.plain_text).join('') || '';
          console.log('Callout text:', calloutText);
          console.log('Has children:', block.has_children);
          console.log('Children array:', block.callout?.children || []);
          
          if (block.callout?.children) {
            console.log('Children count:', block.callout.children.length);
            block.callout.children.forEach((child: any, childIndex: number) => {
              console.log(`  Child ${childIndex + 1}: ${child.type}`);
              if (child.type === 'heading_2') {
                const text = child.heading_2?.rich_text?.map((rt: any) => rt.plain_text).join('') || '';
                console.log(`    Heading text: "${text}"`);
              } else if (child.type === 'paragraph') {
                const text = child.paragraph?.rich_text?.map((rt: any) => rt.plain_text).join('') || '';
                console.log(`    Paragraph text: "${text}"`);
              } else if (child.type === 'bulleted_list_item') {
                const text = child.bulleted_list_item?.rich_text?.map((rt: any) => rt.plain_text).join('') || '';
                console.log(`    List item text: "${text}"`);
              }
            });
          }
        }
      });

      toast({
        title: "Debug Info Logged",
        description: "Check the browser console for detailed block structure",
      });
    } catch (error: any) {
      console.error("Debug error:", error);
      toast({
        title: "Debug Failed",
        description: error.message || "Failed to fetch debug info",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleDebug}
      disabled={loading}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <Bug className="w-4 h-4" />
      Debug Blocks
    </Button>
  );
};

export default DebugNotionButton;
