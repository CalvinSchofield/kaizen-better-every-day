import { useState } from "react";
import { ArrowLeft, Shield, ChevronRight } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProductGuide } from "@/components/training/ProductGuide";
import { productKnowledgeData, ProductData } from "@/components/training/productKnowledgeData";
import { EdgeSwipeContainer } from "@/components/EdgeSwipeContainer";

const ProductKnowledge = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedProduct, setSelectedProduct] = useState<ProductData | null>(null);

  // Determine where to go back to based on where user came from
  const handleBack = () => {
    const fromRamp = (location.state as { from?: string })?.from === "ramp-to-blitz";
    navigate(fromRamp ? "/ramp-to-blitz" : "/training");
  };

  if (selectedProduct) {
    return (
      <ProductGuide 
        product={selectedProduct} 
        onBack={() => setSelectedProduct(null)} 
      />
    );
  }

  return (
    <EdgeSwipeContainer onBack={handleBack}>
      {/* Header */}
      <div 
        className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b"
        style={{ paddingTop: 'var(--effective-safe-area-top)' }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-lg">Product Knowledge</h1>
            <p className="text-sm text-muted-foreground">Deep dive into Vivint systems</p>
          </div>
        </div>
      </div>

      {/* Product List */}
      <div className="max-w-lg mx-auto px-4 py-4 space-y-2">
        {productKnowledgeData.map((product) => (
          <Card 
            key={product.id}
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setSelectedProduct(product)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  <img 
                    src={product.heroImage} 
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{product.name}</h3>
                  <p className="text-sm text-muted-foreground truncate">{product.tagline}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </EdgeSwipeContainer>
  );
};

export default ProductKnowledge;
