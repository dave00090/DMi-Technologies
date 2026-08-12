/**
 * Universal Barcode Lookup Service
 * Compares scanned barcodes against https://barcode-list.com/ and Open Food Facts API
 * Returns complete product details: name, brand, category, description, image, and suggested pricing.
 */

export interface BarcodeProductInfo {
  found: boolean;
  barcode: string;
  name?: string;
  brand?: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  matchesList?: string[];
  suggestedPrice?: number;
  source?: string;
  message?: string;
}

export const lookupBarcodeDetails = async (barcode: string): Promise<BarcodeProductInfo> => {
  const cleanBarcode = barcode.trim().replace(/[^0-9A-Za-z]/g, '');
  if (!cleanBarcode || cleanBarcode.length < 3) {
    return { found: false, barcode: cleanBarcode, message: 'Invalid barcode' };
  }

  // 1. Try internal backend route first (/api/barcode/lookup)
  try {
    const res = await fetch(`/api/barcode/lookup?barcode=${encodeURIComponent(cleanBarcode)}`);
    if (res.ok) {
      const data: BarcodeProductInfo = await res.json();
      if (data && data.found) {
        return data;
      }
    }
  } catch (err) {
    // Fallback to client query if backend route is unreachable
  }

  // 2. Client-side Fallback: Open Food Facts API
  try {
    const offRes = await fetch(`https://world.openfoodfacts.org/api/v2/product/${cleanBarcode}.json`);
    if (offRes.ok) {
      const offData = await offRes.json();
      if (offData && offData.status === 1 && offData.product) {
        const p = offData.product;
        const name = p.product_name || p.generic_name || p.product_name_en || '';
        const brand = p.brands || p.brand_owner || '';
        const imageUrl = p.image_front_url || p.image_url || '';
        let category = 'General';
        
        const fullText = `${name} ${brand} ${p.categories || ''}`.toLowerCase();
        if (fullText.includes('coke') || fullText.includes('cola') || fullText.includes('drink') || fullText.includes('water') || fullText.includes('juice') || fullText.includes('beverage')) {
          category = 'Beverages';
        } else if (fullText.includes('chocolate') || fullText.includes('snack') || fullText.includes('candy') || fullText.includes('biscuit') || fullText.includes('cookie') || fullText.includes('nutella')) {
          category = 'Confectionery & Snacks';
        } else if (fullText.includes('grocer') || fullText.includes('bread') || fullText.includes('flour') || fullText.includes('rice') || fullText.includes('sugar')) {
          category = 'Groceries';
        }

        if (name) {
          return {
            found: true,
            barcode: cleanBarcode,
            name,
            brand,
            category,
            description: `Product details retrieved via public barcode repository.\nBrands: ${brand}\nCategories: ${p.categories || 'N/A'}`,
            imageUrl,
            source: 'Open Food Facts'
          };
        }
      }
    }
  } catch (err) {
    // Ignore routine network/404 errors
  }

  return {
    found: false,
    barcode: cleanBarcode,
    message: 'Barcode not found in online barcode catalog'
  };
};
