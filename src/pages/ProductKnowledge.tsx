import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ProductGuide } from "@/components/training/ProductGuide";
import { productKnowledgeData, ProductData } from "@/components/training/productKnowledgeData";

const ProductKnowledge = () => {
  const [selectedProduct, setSelectedProduct] = useState<ProductData | null>(null);

  if (selectedProduct) {
    return (
      <ProductGuide 
        product={selectedProduct} 
        onBack={() => setSelectedProduct(null)} 
      />
    );
  }

  return (
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
  );
};

export default ProductKnowledge;
