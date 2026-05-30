import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Product, Variant, UserProfile, BusinessProfile } from '../types';
import { 
  Plus, 
  Minus,
  Edit2, 
  Trash2, 
  Search, 
  Package, 
  Tag, 
  Layers, 
  Hash,
  X,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Settings,
  Camera,
  Upload,
  Image as ImageIcon,
  Calendar,
  ShieldCheck,
  Zap,
  Droplets,
  Book,
  Car,
  ShoppingBag,
  Palette,
  Download,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarcodeScanner } from './BarcodeScanner';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { compressImage } from '../lib/imageUtils';
import { SafeImage } from './SafeImage';

interface InventoryProps {
  user: UserProfile;
  businessId: string;
  shopId: string;
}

export const Inventory: React.FC<InventoryProps> = ({ user, businessId, shopId }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkSizes, setBulkSizes] = useState('');
  const [bulkColors, setBulkColors] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanningForVariantId, setScanningForVariantId] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [p, b] = await Promise.all([
        db.getProducts(businessId, shopId),
        db.getBusinessById(businessId)
      ]);
      setProducts(p);
      setBusinessProfile(b || null);
    };
    
    fetchData();
    const handleBusinessUpdate = (e: any) => {
      if (e.detail?.id === businessId) {
        setBusinessProfile(prev => prev ? { ...prev, ...e.detail.updates } : null);
      }
    };
    
    const handleDataUpdate = (e: any) => {
      if (['dmi_pos_products', 'dmi_pos_businesses'].includes(e.detail?.key)) {
        fetchData();
      }
    };

    const handleSyncComplete = () => {
      fetchData();
    };

    window.addEventListener('business-update', handleBusinessUpdate);
    window.addEventListener('local-db-update', handleDataUpdate);
    window.addEventListener('storage-sync', handleDataUpdate);
    window.addEventListener('sync-completed', handleSyncComplete);
    
    const interval = setInterval(fetchData, 30000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('business-update', handleBusinessUpdate);
      window.removeEventListener('local-db-update', handleDataUpdate);
      window.removeEventListener('storage-sync', handleDataUpdate);
      window.removeEventListener('sync-completed', handleSyncComplete);
    };
  }, [businessId, shopId]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.variants.some(v => v.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = categoryFilter.length === 0 || categoryFilter.includes(p.category);
    
    return matchesSearch && matchesCategory;
  });

  const handleBulkDelete = async () => {
    for (const id of selectedProductIds) {
      await db.deleteProduct(id);
    }
    const freshProducts = await db.getProducts(businessId, shopId);
    setProducts(freshProducts);
    setSelectedProductIds([]);
    setIsBulkDeleteConfirmOpen(false);
    showSuccess(`${selectedProductIds.length} products deleted successfully`);
  };

  const toggleProductSelection = (id: string) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map(p => p.id));
    }
  };
  const handleBarcodeScan = (barcode: string) => {
    if (isModalOpen) {
      if (scanningForVariantId) {
        updateVariant(scanningForVariantId, 'sku', barcode);
        setScanningForVariantId(null);
        setIsScannerOpen(false);
      } else if (formData.variants.length > 0) {
        const lastVariant = formData.variants[formData.variants.length - 1];
        updateVariant(lastVariant.id, 'sku', barcode);
        setIsScannerOpen(false);
      } else {
        const newId = crypto.randomUUID();
        const newVariant: Variant = {
          id: newId,
          size: '',
          color: '',
          stock: 0,
          sku: barcode
        };
        setFormData(prev => ({ ...prev, variants: [newVariant] }));
        setIsScannerOpen(false);
      }
    } else {
      const product = products.find(p => p.variants.some(v => v.sku === barcode));
      if (product) {
        setEditingProduct(product);
        setFormData({
          businessId: product.businessId,
          shopId: product.shopId,
          name: product.name,
          category: product.category,
          buyingPrice: product.buyingPrice,
          sellingPrice: product.sellingPrice,
          basePrice: product.basePrice,
          lowStockThreshold: product.lowStockThreshold,
          variants: product.variants,
          description: product.description,
          imageUrl: product.imageUrl,
          type: product.type || 'PRODUCT',
          expiryDate: product.expiryDate,
          batchNumber: product.batchNumber,
          partNumber: product.partNumber,
          modelCompatibility: product.modelCompatibility,
          alcoholPercentage: product.alcoholPercentage,
          volume: product.volume,
          brand: product.brand,
          warranty: product.warranty,
          unit: product.unit,
          isService: product.isService,
          duration: product.duration,
          roomType: product.roomType,
          fuelType: product.fuelType,
          material: product.material,
          ingredients: product.ingredients
        });
        setIsModalOpen(true);
      } else {
        setSearchTerm(barcode);
      }
    }
  };

  useHardwareScanner({ onScan: handleBarcodeScan });
  
  const [formData, setFormData] = useState<Omit<Product, 'id'>>({
    businessId,
    shopId,
    name: '',
    category: '',
    buyingPrice: 0,
    sellingPrice: 0,
    basePrice: 0,
    lowStockThreshold: 5,
    variants: [],
    description: '',
    imageUrl: '',
    type: 'PRODUCT',
    expiryDate: '',
    batchNumber: '',
    partNumber: '',
    modelCompatibility: '',
    alcoholPercentage: 0,
    volume: '',
    brand: '',
    warranty: '',
    unit: 'pcs',
    isService: false,
    duration: 0,
    roomType: '',
    fuelType: '',
    material: '',
    ingredients: []
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string, 400, 400, 0.7);
        setFormData({ ...formData, imageUrl: compressed });
      };
      reader.readAsDataURL(file);
    }
  };

  const getCategories = () => {
    if (!businessProfile) return ['General', 'Clothes', 'Shoes', 'Accessories'];
    switch (businessProfile.type) {
      case 'PHARMACY': 
        return ['Medicine', 'Supplements', 'Personal Care', 'First Aid', 'Equipment', 'Cosmetics'];
      case 'HARDWARE': 
        return ['Tools', 'Electrical', 'Plumbing', 'Construction', 'Electronics', 'Paints', 'Fasteners'];
      case 'AUTOSPARE': 
        return ['Engine', 'Body', 'Electrical', 'Suspension', 'Brakes', 'Tires', 'Lubricants', 'Accessories'];
      case 'GROCERY': 
        return ['Fruits', 'Vegetables', 'Dairy', 'Bakery', 'Meat', 'Poultry', 'Seafood', 'Frozen Foods'];
      case 'LIQUOR': 
        return ['Gin', 'Whiskey', 'Vodka', 'Spirit', 'Wine', 'Beer', 'Soft Drinks', 'Brandy', 'Rum', 'Tequila', 'Mixers'];
      case 'BOOKSHOP': 
        return ['Books', 'Stationery', 'Art Supplies', 'Office Supplies', 'Educational', 'Magazines'];
      case 'RETAIL':
        return ['Wheat', 'Drinks', 'Cereals', 'Rice', 'Candy', 'Snacks', 'Toiletries', 'Household', 'Electronics', 'Clothing'];
      case 'RESTAURANT':
      case 'FAST_FOOD':
      case 'BAR_RESTAURANT':
        return ['Meals', 'Drinks', 'Snacks', 'Desserts', 'Breakfast', 'Lunch', 'Dinner', 'Alcoholic', 'Soft Drinks'];
      case 'SALON_BARBER':
        return ['Haircut', 'Styling', 'Treatment', 'Massage', 'Manicure', 'Pedicure', 'Products', 'Facial'];
      case 'BOUTIQUE':
        return ['Men', 'Women', 'Kids', 'Shoes', 'Accessories', 'Bags', 'Jewelry'];
      case 'PETROL_STATION':
        return ['Fuel', 'Petrol', 'Diesel', 'Kerosene', 'LPG', 'Lubricants', 'Car Wash', 'Service', 'Shop Items'];
      case 'HOTEL':
        return ['Rooms', 'Services', 'Meals', 'Laundry', 'Events', 'Spa'];
      case 'OTHER':
        return [
          'General', 'Electronics', 'Clothing', 'Food & Drinks', 'Medicine', 
          'Hardware', 'Automotive', 'Books & Stationery', 'Services', 'Furniture',
          'Beauty & Personal Care', 'Household', 'Toys & Games', 'Sports & Outdoors'
        ];
      default: 
        return ['General', 'Clothes', 'Shoes', 'Accessories'];
    }
  };

  const handleDownloadCSV = () => {
    const headers = ['Name', 'Category', 'Buying Price', 'Selling Price', 'Stock', 'Low Stock Threshold'];
    const rows = products.map(p => {
      const stock = p.variants.reduce((sum, v) => sum + v.stock, 0);
      return [
        p.name,
        p.category,
        (p.buyingPrice || 0).toString(),
        (p.sellingPrice || p.basePrice || 0).toString(),
        stock.toString(),
        p.lowStockThreshold.toString()
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalItems = products.reduce((sum, p) => sum + p.variants.reduce((vSum, v) => vSum + v.stock, 0), 0);
  const totalValue = products.reduce((sum, p) => sum + p.variants.reduce((vSum, v) => vSum + v.stock * (p.sellingPrice || p.basePrice || 0), 0), 0);
  const buyingValue = products.reduce((sum, p) => sum + p.variants.reduce((vSum, v) => vSum + v.stock * (p.buyingPrice || 0), 0), 0);
  const lowStockCount = products.filter(p => 
    p.variants.some(v => v.stock <= (v.lowStockThreshold ?? p.lowStockThreshold))
  ).length;

  const categories = getCategories();

  const getVariantLabels = () => {
    const category = formData.category.toLowerCase();
    const isTaxi = category.includes('taxi') || category.includes('transport');
    
    if (isTaxi) {
      return { size: 'Destination', color: 'Trip Type / Details' };
    }

    if (formData.type === 'SERVICE') {
      const isHotel = businessProfile?.type === 'HOTEL';
      return { 
        size: isHotel ? 'Duration (Hrs/Days)' : 'Estimated Duration (Min)', 
        color: isHotel ? 'Service Type / Room' : 'Style Name / Option' 
      };
    }
    if (!businessProfile) return { size: 'Size', color: 'Color' };
    switch (businessProfile.type) {
      case 'PHARMACY':
        return { size: 'Form', color: 'Strength' };
      case 'LIQUOR':
        return { size: 'Volume', color: 'Type' };
      case 'AUTOSPARE':
        return { size: 'Part No.', color: 'Compatibility' };
      case 'HARDWARE':
        return { size: 'Specs', color: 'Material' };
      case 'BOOKSHOP':
        return { size: 'Format', color: 'Edition' };
      case 'RESTAURANT':
      case 'FAST_FOOD':
      case 'BAR_RESTAURANT':
        return { size: 'Portion', color: 'Add-on' };
      case 'SALON_BARBER':
        return { size: 'Duration', color: 'Specialist/Type' };
      case 'BOUTIQUE':
        return { size: 'Size', color: 'Color' };
      case 'PETROL_STATION':
        return { size: 'Volume (L)', color: 'Nozzle' };
      case 'HOTEL':
        return { size: 'Duration (Hrs/Days)', color: 'Room Type / Unit No.' };
      case 'RETAIL':
      case 'GROCERY':
      case 'OTHER':
        return { size: 'Size/Unit/Volume', color: 'Type/Flavor/Color' };
      default:
        return { size: 'Size', color: 'Color' };
    }
  };

  const variantLabels = getVariantLabels();

  const handleDelete = async () => {
    if (productToDelete) {
      await db.deleteProduct(productToDelete);
      const freshProducts = await db.getProducts(businessId, shopId);
      setProducts(freshProducts);
      showSuccess('Product deleted');
      setIsDeleteConfirmOpen(false);
      setProductToDelete(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.variants.length === 0) {
      alert('Please add at least one variant');
      return;
    }

    try {
      if (editingProduct) {
        await db.updateProduct(editingProduct.id, formData);
        showSuccess('Product updated successfully!');
      } else {
        await db.addProduct({ ...formData, businessId, shopId });
        showSuccess('Product added successfully!');
      }
      const freshProducts = await db.getProducts(businessId, shopId);
      setProducts(freshProducts);
      setIsModalOpen(false);
      setEditingProduct(null);
      setFormData({ 
        businessId,
        shopId,
        name: '', 
        category: categories[0] || 'General', 
        buyingPrice: 0,
        sellingPrice: 0,
        basePrice: 0, 
        lowStockThreshold: 5, 
        variants: [], 
        description: '', 
        imageUrl: '',
        type: 'PRODUCT',
        expiryDate: '',
        batchNumber: '',
        partNumber: '',
        modelCompatibility: '',
        alcoholPercentage: 0,
        volume: '',
        brand: '',
        warranty: '',
        unit: 'pcs',
        isService: false,
        duration: 0,
        roomType: '',
        fuelType: '',
        material: '',
        ingredients: []
      });
    } catch (error) {
      console.error("Inventory error:", error);
    }
  };

  const addVariant = () => {
    const newVariant: Variant = {
      id: crypto.randomUUID(),
      size: '',
      color: '',
      stock: 0,
      sku: ''
    };
    setFormData({ ...formData, variants: [...formData.variants, newVariant] });
  };

  const updateVariant = (id: string, field: keyof Variant, value: any) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map(v => v.id === id ? { ...v, [field]: value } : v)
    }));
  };

  const generateBulkVariants = () => {
    const sizes = bulkSizes.split(',').map(s => s.trim()).filter(s => s !== '');
    const colors = bulkColors.split(',').map(c => c.trim()).filter(c => c !== '');
    
    if (sizes.length === 0 && colors.length === 0) return;

    const newVariants: Variant[] = [];
    
    if (sizes.length > 0 && colors.length > 0) {
      sizes.forEach(size => {
        colors.forEach(color => {
          newVariants.push({
            id: crypto.randomUUID(),
            size,
            color,
            stock: 0,
            sku: ''
          });
        });
      });
    } else if (sizes.length > 0) {
      sizes.forEach(size => {
        newVariants.push({
          id: crypto.randomUUID(),
          size,
          color: '',
          stock: 0,
          sku: ''
        });
      });
    } else if (colors.length > 0) {
      colors.forEach(color => {
        newVariants.push({
          id: crypto.randomUUID(),
          size: '',
          color,
          stock: 0,
          sku: ''
        });
      });
    }

    setFormData({
      ...formData,
      variants: [...formData.variants, ...newVariants]
    });
    setBulkSizes('');
    setBulkColors('');
    setShowBulkAdd(false);
  };

  const removeVariant = (id: string) => {
    setFormData({
      ...formData,
      variants: formData.variants.filter(v => v.id !== id)
    });
  };

  const handleQuickStockUpdate = async (product: Product, variantId: string, delta: number) => {
    const updatedVariants = product.variants.map(v => 
      v.id === variantId ? { ...v, stock: Math.max(0, v.stock + delta) } : v
    );
    
    try {
      await db.updateProduct(product.id, { variants: updatedVariants });
      const freshProducts = await db.getProducts(businessId, shopId);
      setProducts(freshProducts);
    } catch (error) {
      console.error("Stock update error:", error);
    }
  };

  const toggleCategory = (cat: string) => {
    setCategoryFilter(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleBootstrap = async () => {
    try {
      const getSamples = () => {
        if (!businessProfile) return [];
        switch (businessProfile.type) {
          case 'LIQUOR':
            return [
              { businessId, shopId, name: 'Gordon\'s Gin', category: 'Gin', basePrice: 25, lowStockThreshold: 5, variants: [{ id: 'v1', name: '750ml', stock: 20, sku: 'GIN-GORD-750' }], description: 'Classic London Dry Gin' },
              { businessId, shopId, name: 'Johnnie Walker Black', category: 'Whiskey', basePrice: 45, lowStockThreshold: 3, variants: [{ id: 'v2', name: '1L', stock: 15, sku: 'WKY-JW-BLK-1' }], description: 'Blended Scotch Whiskey' },
              { businessId, shopId, name: 'Absolut Vodka', category: 'Vodka', basePrice: 30, lowStockThreshold: 5, variants: [{ id: 'v3', name: '750ml', stock: 25, sku: 'VDK-ABS-750' }], description: 'Pure Swedish Vodka' },
              { businessId, shopId, name: 'Gilbey\'s Gin', category: 'Spirit', basePrice: 15, lowStockThreshold: 5, variants: [{ id: 'v4', name: '750ml', stock: 30, sku: 'SPR-GIL-750' }], description: 'Smooth London Dry Gin' }
            ];
          case 'SALON_BARBER':
            return [
              { businessId, shopId, type: 'SERVICE', name: 'Haircut', category: 'Hair', basePrice: 15, duration: 30, variants: [{ id: 'v1', color: 'Fade', size: '30', price: 15, stock: 1000 }, { id: 'v2', color: 'Style & Wash', size: '45', price: 25, stock: 1000 }], description: 'Professional haircut service' },
              { businessId, shopId, type: 'SERVICE', name: 'Manicure', category: 'Nails', basePrice: 20, duration: 40, variants: [{ id: 'v3', color: 'Basic', size: '40', price: 20, stock: 1000 }, { id: 'v4', color: 'Gel', size: '60', price: 35, stock: 1000 }], description: 'Luxury nail care' },
              { businessId, shopId, type: 'PRODUCT', name: 'Argan Hair Oil', category: 'Haircare', basePrice: 12, buyingPrice: 8, sellingPrice: 12, lowStockThreshold: 5, variants: [{ id: 'v5', color: '100ml', size: 'Standard', stock: 20, sku: 'SLN-OIL-100' }], description: 'Nourishing hair oil' }
            ];
          case 'PHARMACY':
            return [
              { businessId, shopId, name: 'Panadol Extra', category: 'Medicine', basePrice: 5, lowStockThreshold: 10, variants: [{ id: 'v1', name: '24 Pack', stock: 50, sku: 'MED-PAN-EXT' }], description: 'Pain relief' },
              { businessId, shopId, name: 'Vitamin C 1000mg', category: 'Supplements', basePrice: 15, lowStockThreshold: 5, variants: [{ id: 'v2', name: '60 Tablets', stock: 30, sku: 'SUP-VIT-C' }], description: 'Immune support' }
            ];
          case 'RETAIL':
            return [
              { businessId, shopId, name: 'Whole Wheat Flour', category: 'Wheat', basePrice: 12, lowStockThreshold: 5, variants: [{ id: 'v1', name: '2kg', stock: 40, sku: 'WHT-FLR-2KG' }], description: 'Premium whole wheat' },
              { businessId, shopId, name: 'Basmati Rice', category: 'Rice', basePrice: 20, lowStockThreshold: 5, variants: [{ id: 'v2', name: '5kg', stock: 25, sku: 'RCE-BAS-5KG' }], description: 'Long grain aromatic rice' },
              { businessId, shopId, name: 'Mixed Fruit Candy', category: 'Candy', basePrice: 2, lowStockThreshold: 20, variants: [{ id: 'v3', name: '100g', stock: 100, sku: 'CND-FRT-100' }], description: 'Assorted fruit flavors' }
            ];
          case 'HARDWARE':
            return [
              { businessId, shopId, name: 'Power Drill', category: 'Tools', basePrice: 120, lowStockThreshold: 2, variants: [{ id: 'v1', name: '18V Cordless', stock: 5, sku: 'HW-DRL-18V' }], description: 'Heavy duty power drill' },
              { businessId, shopId, name: 'LED Bulb 9W', category: 'Electrical', basePrice: 5, lowStockThreshold: 20, variants: [{ id: 'v2', name: 'Cool White', stock: 100, sku: 'HW-LED-9W' }], description: 'Energy efficient LED bulb' }
            ];
          case 'AUTOSPARE':
            return [
              { businessId, shopId, name: 'Brake Pads', category: 'Brakes', basePrice: 45, lowStockThreshold: 5, variants: [{ id: 'v1', name: 'Front Set', stock: 10, sku: 'AS-BRK-FRT' }], description: 'High performance brake pads' },
              { businessId, shopId, name: 'Synthetic Oil 5W-30', category: 'Lubricants', basePrice: 35, lowStockThreshold: 10, variants: [{ id: 'v2', name: '5L', stock: 20, sku: 'AS-OIL-5L' }], description: 'Full synthetic engine oil' }
            ];
          case 'PETROL_STATION':
            return [
              { businessId, shopId, name: 'V-Power Petrol', category: 'Fuel', basePrice: 1.8, lowStockThreshold: 1000, fuelType: 'PETROL', variants: [{ id: 'v1', name: 'Per Litre', stock: 5000, sku: 'FUEL-VPR-001' }], description: 'Premium performance fuel' },
              { businessId, shopId, name: 'Engine Oil', category: 'Lubricants', basePrice: 40, lowStockThreshold: 5, variants: [{ id: 'v2', name: '4L', stock: 15, sku: 'FUEL-OIL-001' }], description: 'Synthetic blend' },
              { businessId, shopId, name: 'Ajab Flour', category: 'Shop Items', basePrice: 1.5, lowStockThreshold: 10, variants: [{ id: 'v3', name: '2kg', stock: 50, sku: 'SHOP-AJB-001' }], description: 'Premium wheat flour' }
            ];
          case 'HOTEL':
            return [
              { businessId, shopId, type: 'SERVICE', name: 'Deluxe Suite', category: 'Rooms', basePrice: 150, duration: 24, variants: [{ id: 'v1', color: 'Room 101 - Pool View', size: '1 Day', price: 150, stock: 1000 }, { id: 'v2', color: 'Room 102 - Garden View', size: '1 Day', price: 135, stock: 1000 }], description: 'Luxury deluxe suite with bed and breakfast.' },
              { businessId, shopId, type: 'SERVICE', name: 'Standard Room', category: 'Rooms', basePrice: 80, duration: 24, variants: [{ id: 'v3', color: 'Room 201', size: '1 Day', price: 80, stock: 1000 }, { id: 'v4', color: 'Room 202', size: '1 Day', price: 80, stock: 1000 }], description: 'Comfortable standard room options.' },
              { businessId, shopId, type: 'SERVICE', name: 'Airport Transfer (Tesla)', category: 'Transport', basePrice: 45, duration: 1, variants: [{ id: 'v5', color: 'One Way', size: '1 Hr', price: 45, stock: 1000 }, { id: 'v6', color: 'Round Trip', size: '2 Hrs', price: 80, stock: 1000 }], description: 'Luxury taxi service to/from airport.' },
              { businessId, shopId, type: 'SERVICE', name: 'Full Board Upgrade', category: 'Meals', basePrice: 30, duration: 24, variants: [{ id: 'v7', color: 'Chef\'s Choice', size: '1 Day', price: 30, stock: 1000 }], description: 'Upgrade from B&B to full board.' },
              { businessId, shopId, type: 'SERVICE', name: 'City Tour', category: 'Activities', basePrice: 60, duration: 4, variants: [{ id: 'v8', color: 'Guided Private', size: '4 Hrs', price: 60, stock: 1000 }], description: 'Explore the city with our expert guides.' }
            ];
          case 'OTHER':
            return [
              { businessId, shopId, name: 'General Item', category: 'General', basePrice: 10, lowStockThreshold: 5, variants: [{ id: 'v1', name: 'Standard', stock: 50, sku: 'OTH-GEN-001' }], description: 'A general inventory item' },
              { businessId, shopId, name: 'Service Item', category: 'Services', basePrice: 50, lowStockThreshold: 0, isService: true, duration: 60, variants: [{ id: 'v2', name: 'Standard', stock: 1000, sku: 'OTH-SRV-001' }], description: 'A general service' }
            ];
          default:
            return [
              { businessId, shopId, name: 'Sample Product', category: 'General', basePrice: 10, lowStockThreshold: 5, variants: [{ id: 'v1', name: 'Standard', stock: 10, sku: 'SMP-001' }], description: 'A sample product' }
            ];
        }
      };
      const samples = getSamples();
      for (const s of samples) {
        await db.addProduct(s as any);
      }
      const freshProducts = await db.getProducts(businessId, shopId);
      setProducts(freshProducts);
      showSuccess('Sample products added!');
    } catch (error) {
      console.error("Bootstrap error:", error);
    }
  };

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 print:hidden border-b border-border/50 pb-6">
        {businessProfile?.type === 'HOTEL' ? (
          <>
            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm hover:ring-1 hover:ring-indigo-500/30 transition-all">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-600">
                  <Package className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-muted uppercase tracking-wider">Lodging Units & Rooms</span>
              </div>
              <p className="text-3xl font-extrabold text-ink">{products.length.toLocaleString()} <span className="text-xs font-normal text-muted">active</span></p>
            </div>
            
            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm hover:ring-1 hover:ring-emerald-500/30 transition-all">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-600">
                  <DollarSign className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-muted uppercase tracking-wider">Est Booking Value</span>
              </div>
              <p className="text-3xl font-extrabold text-ink">
                {businessProfile?.currency || 'KSh'}{totalValue.toLocaleString()}
              </p>
            </div>

            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm hover:ring-1 hover:ring-amber-500/30 transition-all">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-600">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-muted uppercase tracking-wider">Estimated Profit margin</span>
              </div>
              <p className="text-3xl font-extrabold text-ink">
                {businessProfile?.currency || 'KSh'}{(totalValue - buyingValue).toLocaleString()}
              </p>
            </div>

            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm hover:ring-1 hover:ring-rose-500/30 transition-all">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-600">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-muted uppercase tracking-wider">Available bookings</span>
              </div>
              <p className="text-3xl font-extrabold text-ink">
                {products.filter(p => p.variants?.some(v => v.stock > 0)).length} <span className="text-xs font-normal text-muted">units ready</span>
              </p>
            </div>
          </>
        ) : (businessProfile?.type === 'RESTAURANT' || businessProfile?.type === 'FAST_FOOD' || businessProfile?.type === 'BAR_RESTAURANT') ? (
          <>
            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm hover:ring-1 hover:ring-indigo-500/30 transition-all">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-600">
                  <Package className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-muted uppercase tracking-wider">Menu Dishes Count</span>
              </div>
              <p className="text-3xl font-extrabold text-ink">{products.length.toLocaleString()}</p>
            </div>
            
            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm hover:ring-1 hover:ring-emerald-500/30 transition-all">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-600">
                  <DollarSign className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-muted uppercase tracking-wider">Menu Market Value</span>
              </div>
              <p className="text-3xl font-extrabold text-ink">
                {businessProfile?.currency || 'KSh'}{totalValue.toLocaleString()}
              </p>
            </div>

            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm hover:ring-1 hover:ring-amber-500/30 transition-all">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-600">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-muted uppercase tracking-wider">Est Food-Cost Profit</span>
              </div>
              <p className="text-3xl font-extrabold text-ink">
                {businessProfile?.currency || 'KSh'}{(totalValue - buyingValue).toLocaleString()}
              </p>
            </div>

            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm hover:ring-1 hover:ring-rose-500/30 transition-all">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-600">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-muted uppercase tracking-wider">Dishes Low Ingredients</span>
              </div>
              <p className="text-3xl font-extrabold text-ink">{lowStockCount}</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-600">
                  <Package className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-muted uppercase">Total Items</span>
              </div>
              <p className="text-3xl font-bold text-ink">{totalItems.toLocaleString()}</p>
            </div>
            
            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-600">
                  <DollarSign className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-muted uppercase">Stock Value</span>
              </div>
              <p className="text-3xl font-bold text-ink">
                {businessProfile?.currency || 'KSh'}{totalValue.toLocaleString()}
              </p>
            </div>

            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-600">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-muted uppercase">Potential Profit</span>
              </div>
              <p className="text-3xl font-bold text-ink">
                {businessProfile?.currency || 'KSh'}{(totalValue - buyingValue).toLocaleString()}
              </p>
            </div>

            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-600">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-muted uppercase">Low Stock</span>
              </div>
              <p className="text-3xl font-bold text-ink">{lowStockCount}</p>
            </div>
          </>
        )}
      </div>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
        <div className="relative flex-1 max-w-md group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted group-focus-within:text-indigo-600 transition-colors" />
          <input
            type="text"
            placeholder="Search products, categories, or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchTerm) {
                handleBarcodeScan(searchTerm);
              }
            }}
            className="w-full pl-12 pr-4 py-3.5 bg-card border border-border rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium shadow-sm transition-all"
          />
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-6 py-3 bg-card border border-border hover:bg-muted text-ink font-bold rounded-2xl transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          
          <div className="flex bg-card p-1 border border-border rounded-2xl shadow-sm">
            <button
              onClick={() => {
                setEditingProduct(null);
                setFormData({
                  businessId,
                  shopId,
                  name: '',
                  category: categories[0] || 'General',
                  buyingPrice: 0,
                  sellingPrice: 0,
                  basePrice: 0,
                  lowStockThreshold: 5,
                  variants: [],
                  description: '',
                  imageUrl: '',
                  type: 'PRODUCT',
                  expiryDate: '',
                  batchNumber: '',
                  partNumber: '',
                  modelCompatibility: '',
                  alcoholPercentage: 0,
                  volume: '',
                  brand: '',
                  warranty: '',
                  unit: 'pcs',
                  isService: false,
                  duration: 0,
                  roomType: '',
                  fuelType: '',
                  material: '',
                  ingredients: []
                });
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all"
            >
              <ShoppingBag className="w-4 h-4" />
              Add Product
            </button>
            <button
              onClick={() => {
                setEditingProduct(null);
                const defaultCategory = businessProfile?.type === 'HOTEL' ? 'Rooms' : 'Haircut';
                const defaultDuration = businessProfile?.type === 'HOTEL' ? 24 : 30;
                const defaultSize = businessProfile?.type === 'HOTEL' ? '1 Day' : '30';
                
                setFormData({
                  businessId,
                  shopId,
                  name: '',
                  category: defaultCategory,
                  buyingPrice: 0,
                  sellingPrice: 0,
                  basePrice: 0,
                  lowStockThreshold: 0,
                  variants: [{ id: crypto.randomUUID(), size: defaultSize, color: 'Standard', stock: 1000, sku: '', price: 0 }],
                  description: '',
                  imageUrl: '',
                  type: 'SERVICE',
                  expiryDate: '',
                  batchNumber: '',
                  partNumber: '',
                  modelCompatibility: '',
                  alcoholPercentage: 0,
                  volume: '',
                  brand: '',
                  warranty: '',
                  unit: 'service',
                  isService: true,
                  duration: defaultDuration,
                  roomType: '',
                  fuelType: '',
                  material: '',
                  ingredients: []
                });
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 px-6 py-2.5 text-ink font-bold hover:bg-muted rounded-xl transition-all"
            >
              <Zap className="w-4 h-4 text-amber-500" />
              Add Service
            </button>
          </div>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide print:hidden">
        <button
          onClick={() => setCategoryFilter([])}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
            categoryFilter.length === 0 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'bg-card border border-border text-muted hover:border-indigo-500/50'
          }`}
        >
          All Categories
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => toggleCategory(cat)}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
              categoryFilter.includes(cat)
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-card border border-border text-muted hover:border-indigo-500/50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedProductIds.length > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="bg-indigo-600 text-white px-8 py-4 rounded-2xl flex items-center justify-between shadow-xl shadow-indigo-500/20"
          >
            <div className="flex items-center gap-4">
              <span className="font-bold">{selectedProductIds.length} products selected</span>
              <div className="h-4 w-px bg-white/20" />
              <button onClick={toggleSelectAll} className="text-sm font-medium hover:underline">
                {selectedProductIds.length === filteredProducts.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsBulkDeleteConfirmOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all font-bold text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-4">
        {filteredProducts.length === 0 ? (
          <div className="bg-card border border-border rounded-3xl p-20 flex flex-col items-center justify-center text-muted gap-4 shadow-sm">
            <div className="w-24 h-24 bg-bg rounded-full flex items-center justify-center">
              <Package className="w-12 h-12 opacity-20" />
            </div>
            <div className="text-center max-w-xs">
              <p className="text-xl font-bold text-ink mb-2">No products found</p>
              <p className="text-sm text-muted">
                {searchTerm 
                  ? "We couldn't find any products matching your search." 
                  : "Your inventory is currently empty. Start by adding your first product."}
              </p>
            </div>
            {!searchTerm && (
              <div className="flex gap-4 mt-4">
                <button
                  onClick={() => {
                    setEditingProduct(null);
                    setFormData({
                      name: '',
                      category: getCategories()[0],
                      buyingPrice: 0,
                      sellingPrice: 0,
                      basePrice: 0,
                      variants: [{ id: '1', size: '', color: '', stock: 0, sku: '', lowStockThreshold: 5 }],
                      lowStockThreshold: 5,
                      description: '',
                      unit: 'pcs',
                      type: 'PRODUCT',
                      businessId,
                      shopId,
                      imageUrl: '',
                      expiryDate: '',
                      batchNumber: '',
                      partNumber: '',
                      modelCompatibility: '',
                      alcoholPercentage: 0,
                      volume: '',
                      brand: '',
                      warranty: '',
                      isService: false,
                      duration: 0,
                      roomType: '',
                      fuelType: '',
                      material: '',
                      ingredients: []
                    });
                    setIsModalOpen(true);
                  }}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Your First Product
                </button>
                <button
                  onClick={handleBootstrap}
                  className="px-8 py-3 bg-card border border-border text-ink rounded-xl font-bold hover:bg-bg transition-all"
                >
                  Bootstrap Sample Data
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredProducts.map((product) => (
            <motion.div 
              layout
              key={product.id} 
              className={`bg-card border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all ${
                selectedProductIds.includes(product.id) ? 'border-indigo-600 ring-1 ring-indigo-600' : 'border-border'
              }`}
            >
            <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => toggleProductSelection(product.id)}
                  className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                    selectedProductIds.includes(product.id)
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-bg border-border text-transparent hover:border-indigo-500/50'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center overflow-hidden border border-border shrink-0">
                  <SafeImage 
                    src={product.imageUrl} 
                    alt={product.name} 
                    className="w-full h-full object-contain" 
                    fallback={<Package className="w-8 h-8 text-slate-400" />}
                    referrerPolicy="no-referrer" 
                  />
                </div>
                <div>
                  <h3 className="font-bold text-ink text-lg">{product.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded uppercase border border-indigo-100">
                      {product.type === 'SERVICE' ? 'Service' : 'Product'}
                    </span>
                    <span className="px-2 py-0.5 bg-bg text-muted text-[10px] font-bold rounded uppercase">
                      {product.category}
                    </span>
                    {product.brand && (
                      <span className="text-xs text-indigo-600 font-medium">
                        {product.brand}
                      </span>
                    )}
                    {product.partNumber && (
                      <span className="text-[10px] text-muted font-mono">
                        PN: {product.partNumber}
                      </span>
                    )}
                    <span className="text-xs text-muted">
                      {product.variants.length} Variants
                    </span>
                  </div>
                  {product.expiryDate && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-rose-500 font-bold">
                      <Calendar className="w-3 h-3" />
                      Expires: {product.expiryDate}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-8">
                {product.type === 'PRODUCT' && (
                  <>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-muted uppercase mb-1">Buying Price</p>
                      <p className="font-mono text-sm text-muted">${product.buyingPrice?.toFixed(2) || '0.00'}</p>
                    </div>
                  </>
                )}
                <div className="text-right">
                  <p className="text-[10px] font-bold text-muted uppercase mb-1">
                    {product.type === 'SERVICE' ? 'Standard Price' : 'Selling Price'}
                  </p>
                  <p className="font-mono font-bold text-indigo-600">${product.sellingPrice?.toFixed(2) || product.basePrice.toFixed(2)}</p>
                </div>
                {product.type === 'PRODUCT' && (
                  <>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-muted uppercase mb-1">Profit/Unit</p>
                      <p className="font-mono font-bold text-emerald-600">
                        ${((product.sellingPrice || product.basePrice) - (product.buyingPrice || 0)).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-muted uppercase mb-1">Total Stock</p>
                      <p className="font-bold text-ink">
                        {product.variants.reduce((sum, v) => sum + v.stock, 0)}
                      </p>
                    </div>
                  </>
                )}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setEditingProduct(product);
                      setFormData({
                        name: product.name,
                        category: product.category,
                        buyingPrice: product.buyingPrice || 0,
                        sellingPrice: product.sellingPrice || 0,
                        basePrice: product.basePrice,
                        lowStockThreshold: product.lowStockThreshold,
                        variants: product.variants,
                        description: product.description || '',
                        imageUrl: product.imageUrl || '',
                        type: product.type || 'PRODUCT',
                        expiryDate: product.expiryDate || '',
                        batchNumber: product.batchNumber || '',
                        partNumber: product.partNumber || '',
                        modelCompatibility: product.modelCompatibility || '',
                        alcoholPercentage: product.alcoholPercentage || 0,
                        volume: product.volume || '',
                        brand: product.brand || '',
                        warranty: product.warranty || '',
                        unit: product.unit || 'pcs',
                        isService: product.isService || false,
                        duration: product.duration || 0,
                        roomType: product.roomType || '',
                        fuelType: product.fuelType || '',
                        material: product.material || '',
                        ingredients: product.ingredients || [],
                        businessId: product.businessId,
                        shopId: product.shopId
                      });
                      setIsModalOpen(true);
                    }}
                    className="p-2 text-muted hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  {user.role === 'admin' && (
                    <button 
                      onClick={() => {
                        setProductToDelete(product.id);
                        setIsDeleteConfirmOpen(true);
                      }}
                      className="p-2 text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className={`bg-bg/50 border-t border-border p-4 grid grid-cols-2 ${product.type === 'SERVICE' ? 'md:grid-cols-3' : 'md:grid-cols-4 lg:grid-cols-6'} gap-x-4 gap-y-6`}>
              {product.variants.map(variant => {
                const threshold = variant.lowStockThreshold ?? product.lowStockThreshold;
                const isOutOfStock = variant.stock === 0;
                const isLowStock = variant.stock > 0 && variant.stock <= threshold;
                const statusLabel = isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock';
                const statusColor = isOutOfStock ? 'bg-rose-500' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500';
                const badgeColor = isOutOfStock ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : isLowStock ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';

                return (
                  <div key={variant.id} className="bg-card p-4 rounded-xl border border-border shadow-sm group relative overflow-hidden flex flex-col justify-between h-full">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-muted uppercase">
                          {product.type === 'SERVICE' ? 'Style / Variant' : (variant.size ? `${variantLabels.size} ${variant.size}` : variantLabels.size)}
                        </span>
                        {product.type === 'PRODUCT' && (
                          <span className={`w-2 h-2 rounded-full ${statusColor} ${isLowStock ? 'animate-pulse' : ''}`} />
                        )}
                      </div>
                      {variant.color && <p className="text-sm font-bold text-ink mb-1">{variant.color} {variant.size && product.type === 'SERVICE' ? `(${variant.size}m)` : ''}</p>}
                    </div>

                    <div className="mt-auto space-y-2">
                      <div className="flex items-center justify-between">
                        {product.type === 'SERVICE' ? (
                          <p className="text-base font-black text-indigo-600">${(variant.price || product.sellingPrice || product.basePrice || 0).toFixed(2)}</p>
                        ) : (
                          <p className="text-sm font-bold text-ink">{variant.stock} in stock</p>
                        )}
                        {product.type === 'PRODUCT' && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleQuickStockUpdate(product, variant.id, -1)}
                              className="p-1 hover:bg-bg rounded text-muted hover:text-red-600 transition-colors"
                              title="Decrease stock"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={() => handleQuickStockUpdate(product, variant.id, 1)}
                              className="p-1 hover:bg-bg rounded text-muted hover:text-emerald-600 transition-colors"
                              title="Increase stock"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      {product.type === 'PRODUCT' && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-muted font-medium">Min: {threshold}</span>
                          </div>
                          <div className={`px-2 py-1 rounded text-[9px] font-black uppercase border text-center ${badgeColor}`}>
                            {statusLabel}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))
      )}
      </div>

      {/* Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border border-border rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="px-8 py-6 bg-bg border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-bold text-ink">
                  {editingProduct ? 'Edit' : 'Add New'} {formData.type === 'SERVICE' ? 'Service' : 'Product'}
                </h3>
                {!editingProduct && (
                  <div className="flex bg-muted p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'PRODUCT', isService: false, unit: 'pcs' })}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        formData.type === 'PRODUCT' 
                          ? 'bg-card text-indigo-600 shadow-sm' 
                          : 'text-muted hover:text-ink'
                      }`}
                    >
                      Product
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'SERVICE', isService: true, unit: 'service' })}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        formData.type === 'SERVICE' 
                          ? 'bg-card text-amber-600 shadow-sm' 
                          : 'text-muted hover:text-ink'
                      }`}
                    >
                      Service
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-bg rounded-lg transition-colors">
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-3xl bg-white/50 hover:bg-white transition-all group relative overflow-hidden">
                  {formData.imageUrl ? (
                    <>
                      <img src={formData.imageUrl} alt="Preview" className="absolute inset-0 w-full h-full object-contain opacity-20 group-hover:opacity-40 transition-opacity" referrerPolicy="no-referrer" />
                      <div className="relative z-10 flex flex-col items-center gap-3">
                        <div className="w-20 h-20 rounded-2xl overflow-hidden border-4 border-white shadow-xl bg-white">
                          <SafeImage src={formData.imageUrl} alt="Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                        <label className="cursor-pointer px-4 py-2 bg-card text-ink text-xs font-bold rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-2">
                          <Camera className="w-4 h-4" />
                          Change Photo
                          <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </label>
                      </div>
                    </>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-card rounded-2xl flex items-center justify-center text-muted shadow-sm group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-ink">Upload Product Image</p>
                        <p className="text-xs text-muted">PNG, JPG up to 2MB</p>
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                  )}
                </div>

                <div className="col-span-2 space-y-2">
                  <label className="text-xs font-bold text-muted uppercase">
                    {formData.type === 'SERVICE' ? 'Service Name' : 'Product Name'}
                  </label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder=""
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted uppercase">Category</label>
                  <select
                    className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {formData.type === 'SERVICE' ? (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted uppercase">
                      Base Duration ({businessProfile?.type === 'HOTEL' ? 'Hrs/Days' : 'Minutes'})
                    </label>
                    <input
                      type="number"
                      className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={formData.duration || 0}
                      onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setFormData(prev => ({ ...prev, duration: isNaN(val) ? 0 : val }));
                    }}
                    />
                  </div>
                ) : (
                  <>
                    {(businessProfile?.type === 'PHARMACY' || businessProfile?.type === 'GROCERY' || businessProfile?.type === 'OTHER') && (
                      <>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-muted uppercase">Expiry Date</label>
                          <input
                            type="date"
                            className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            value={formData.expiryDate || ''}
                            onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-muted uppercase">Batch Number</label>
                          <input
                            type="text"
                            className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            value={formData.batchNumber || ''}
                            onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                          />
                        </div>
                      </>
                    )}
                  </>
                )}

                {(businessProfile?.type === 'HARDWARE' || businessProfile?.type === 'AUTOSPARE' || businessProfile?.type === 'OTHER') && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted uppercase">Brand / Manufacturer</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={formData.brand || ''}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted uppercase">Warranty Info</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={formData.warranty || ''}
                        onChange={(e) => setFormData({ ...formData, warranty: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {(businessProfile?.type === 'AUTOSPARE' || businessProfile?.type === 'OTHER') && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted uppercase">Part Number</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={formData.partNumber || ''}
                        onChange={(e) => setFormData({ ...formData, partNumber: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted uppercase">Model Compatibility</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={formData.modelCompatibility || ''}
                        onChange={(e) => setFormData({ ...formData, modelCompatibility: e.target.value })}
                        placeholder="e.g. Toyota Corolla 2015-2020"
                      />
                    </div>
                  </>
                )}

                {(businessProfile?.type === 'RESTAURANT' || businessProfile?.type === 'FAST_FOOD' || businessProfile?.type === 'BAR_RESTAURANT' || businessProfile?.type === 'HOTEL' || businessProfile?.type === 'OTHER') && (
                  <div className="col-span-2 space-y-2">
                    <label className="text-xs font-bold text-muted uppercase">Ingredients / Description</label>
                    <textarea
                      className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all min-h-[80px]"
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder={businessProfile?.type === 'HOTEL' ? "e.g. Inclusive of Bed & Breakfast, private balcony" : "e.g. Served with chips and salad"}
                    />
                  </div>
                )}

                {(businessProfile?.type === 'SALON_BARBER' || businessProfile?.type === 'HOTEL' || businessProfile?.type === 'OTHER') && (
                  <>
                    <div className="flex items-center gap-3 p-4 bg-bg border border-border rounded-2xl col-span-2">
                      <input
                        type="checkbox"
                        id="isService"
                        className="w-5 h-5 rounded-lg border-border text-indigo-600 focus:ring-indigo-500"
                        checked={formData.isService}
                        onChange={(e) => setFormData({ ...formData, isService: e.target.checked })}
                      />
                      <label htmlFor="isService" className="text-sm font-bold text-ink cursor-pointer">This is a Service (not a physical product)</label>
                    </div>
                    {formData.isService && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted uppercase">
                          Duration ({businessProfile?.type === 'HOTEL' ? 'Hrs/Days' : 'Minutes'})
                        </label>
                        <input
                          type="number"
                          className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                          value={formData.duration || 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setFormData({ ...formData, duration: isNaN(val) ? 0 : val });
                          }}
                        />
                      </div>
                    )}
                    {(businessProfile?.type === 'HOTEL' || businessProfile?.type === 'OTHER') && (
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-muted uppercase">Room / Service Type</label>
                            <select
                              className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                              value={formData.roomType}
                              onChange={(e) => setFormData({ ...formData, roomType: e.target.value })}
                            >
                              <option value="">Select Type</option>
                              <option value="STANDARD_BB">Standard Room (B&B)</option>
                              <option value="DELUXE_BB">Deluxe Room (B&B)</option>
                              <option value="SUITE_BB">Executive Suite (B&B)</option>
                              <option value="APARTMENT_AIRBNB">Entire Apartment (Airbnb)</option>
                              <option value="STUDIO_AIRBNB">Studio Apartment (Airbnb)</option>
                              <option value="SPA_WELLNESS">SPA & Wellness Service</option>
                              <option value="GYM_MEMBERSHIP">Gym & Fitness Access</option>
                              <option value="TAXI_TRANSFER">Taxi / Airport Transfer</option>
                              <option value="LAUNDRY_SERVICE">Laundry / Dry Cleaning</option>
                              <option value="TOUR_GUIDE">Guided Tour Service</option>
                            </select>
                          </div>
                    )}
                  </>
                )}

                {(businessProfile?.type === 'PETROL_STATION' || businessProfile?.type === 'OTHER') && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted uppercase">Fuel Type</label>
                    <select
                      className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={formData.fuelType || ''}
                      onChange={(e) => setFormData({ ...formData, fuelType: e.target.value as any })}
                    >
                      <option value="">Select Fuel Type</option>
                      <option value="PETROL">Super Petrol</option>
                      <option value="DIESEL">Diesel</option>
                      <option value="KEROSENE">Kerosene</option>
                      <option value="GAS">LPG Gas</option>
                    </select>
                  </div>
                )}

                {(businessProfile?.type === 'BOUTIQUE' || businessProfile?.type === 'OTHER') && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted uppercase">Material / Fabric</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={formData.material}
                      onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                      placeholder="e.g. Cotton, Silk"
                    />
                  </div>
                )}

                {(businessProfile?.type === 'LIQUOR' || businessProfile?.type === 'OTHER') && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted uppercase">Alcohol %</label>
                      <input
                        type="number"
                        step="0.1"
                        className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={formData.alcoholPercentage || 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setFormData({ ...formData, alcoholPercentage: isNaN(val) ? 0 : val });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted uppercase">Volume (ml/L)</label>
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={formData.volume || ''}
                        onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                        placeholder="e.g. 750ml"
                      />
                    </div>
                  </>
                )}

                {(businessProfile?.type === 'GROCERY' || businessProfile?.type === 'LIQUOR' || businessProfile?.type === 'OTHER') && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted uppercase">Unit of Measure</label>
                    <select
                      className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    >
                      <option value="pcs">Pieces (pcs)</option>
                      <option value="kg">Kilograms (kg)</option>
                      <option value="g">Grams (g)</option>
                      <option value="l">Liters (l)</option>
                      <option value="ml">Milliliters (ml)</option>
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted uppercase">
                    {formData.type === 'SERVICE' ? 'Standard Price ($)' : 'Selling Price ($)'}
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={formData.sellingPrice === 0 ? '0' : (formData.sellingPrice || '')}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      setFormData(prev => ({ ...prev, sellingPrice: isNaN(val) ? 0 : val, basePrice: isNaN(val) ? 0 : val }));
                    }}
                  />
                </div>

                {formData.type === 'PRODUCT' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted uppercase">Buying Price ($)</label>
                      <input
                        required
                        type="number"
                        step="0.01"
                        className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={formData.buyingPrice === 0 ? '0' : (formData.buyingPrice || '')}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          setFormData(prev => ({ ...prev, buyingPrice: isNaN(val) ? 0 : val }));
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted uppercase flex items-center gap-2">
                        Low Stock Threshold
                        <Settings className="w-3 h-3 text-muted" />
                      </label>
                      <input
                        required
                        type="number"
                        className="w-full px-4 py-2.5 bg-bg border border-border text-ink rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={formData.lowStockThreshold || 0}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setFormData(prev => ({ ...prev, lowStockThreshold: isNaN(val) ? 0 : val }));
                        }}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-ink uppercase tracking-wider">
                    {formData.type === 'SERVICE' ? 'Service Styles / Options' : 'Product Variants'}
                  </h4>
                  <div className="flex items-center gap-4">
                    {formData.type === 'PRODUCT' && (
                      <button
                        type="button"
                        onClick={() => setShowBulkAdd(!showBulkAdd)}
                        className="flex items-center gap-2 text-xs font-bold text-muted hover:text-ink transition-colors"
                      >
                        <Zap className="w-4 h-4" />
                        Bulk Add
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={addVariant}
                      className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                    >
                      <Plus className="w-4 h-4" />
                      Add {formData.type === 'SERVICE' ? 'Style' : 'Variant'}
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {showBulkAdd && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-6 bg-indigo-500/5 border border-indigo-500/20 rounded-3xl space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="w-4 h-4 text-indigo-500" />
                          <h5 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Bulk Variant Generator</h5>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                              {variantLabels.size}s (comma separated)
                            </label>
                            <input
                              type="text"
                              className="w-full px-4 py-2.5 bg-card border border-border text-ink rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                              value={bulkSizes}
                              onChange={(e) => setBulkSizes(e.target.value)}
                              placeholder="e.g. S, M, L, XL"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                              {variantLabels.color}s (comma separated)
                            </label>
                            <input
                              type="text"
                              className="w-full px-4 py-2.5 bg-card border border-border text-ink rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                              value={bulkColors}
                              onChange={(e) => setBulkColors(e.target.value)}
                              placeholder="e.g. Red, Blue, Green"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => setShowBulkAdd(false)}
                            className="px-4 py-2 text-xs font-bold text-muted hover:text-ink transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={generateBulkVariants}
                            className="px-6 py-2 bg-indigo-500 text-white rounded-xl text-xs font-bold hover:bg-indigo-600 transition-all shadow-sm"
                          >
                            Generate Combinations
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-4">
                  {formData.variants.map((variant, idx) => {
                    const threshold = variant.lowStockThreshold ?? formData.lowStockThreshold;
                    const isOutOfStock = variant.stock === 0;
                    const isLowStock = variant.stock > 0 && variant.stock <= threshold;
                    const statusColor = isOutOfStock ? 'text-rose-500' : isLowStock ? 'text-amber-500' : 'text-emerald-500';
                    const isRetail = businessProfile?.type === 'RETAIL' || businessProfile?.type === 'GROCERY';

                    return (
                      <div key={variant.id} className="p-6 bg-bg border border-border rounded-3xl space-y-4 relative group">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 bg-indigo-500/10 text-indigo-600 rounded-lg flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </span>
                            <h5 className="text-xs font-bold text-ink uppercase tracking-wider">Variant Details</h5>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeVariant(variant.id)}
                            className="p-2 text-muted hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className={`grid grid-cols-1 ${formData.type === 'SERVICE' ? 'md:grid-cols-3' : 'md:grid-cols-5'} gap-4`}>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">
                              <Layers className="w-3 h-3" />
                              {variantLabels.size}
                            </label>
                            <input
                              required
                              type="text"
                              className="w-full px-4 py-2.5 bg-card border border-border text-ink rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                              value={variant.size}
                              onChange={(e) => updateVariant(variant.id, 'size', e.target.value)}
                              placeholder={formData.category.toLowerCase().includes('taxi') || formData.category.toLowerCase().includes('transport') ? 
                                'e.g. Airport' : 
                                (formData.type === 'SERVICE' ? 
                                  (businessProfile?.type === 'HOTEL' ? 'e.g. 1 Day / 1 Hr' : 'e.g. 30') : 
                                  'e.g. Large')}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">
                              <Palette className="w-3 h-3" />
                              {variantLabels.color}
                            </label>
                            <input
                              required={!isRetail || formData.type === 'SERVICE'}
                              type="text"
                              className="w-full px-4 py-2.5 bg-card border border-border text-ink rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                              value={variant.color}
                              onChange={(e) => updateVariant(variant.id, 'color', e.target.value)}
                              placeholder={formData.category.toLowerCase().includes('taxi') || formData.category.toLowerCase().includes('transport') ? 
                                'e.g. One Way' : 
                                (formData.type === 'SERVICE' ? 
                                  (businessProfile?.type === 'HOTEL' ? 'e.g. Room 101 / Sea View' : 'e.g. Standard') : 
                                  (isRetail ? "Optional" : "e.g. Red"))}
                            />
                          </div>

                          <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">
                                <Tag className="w-3 h-3" />
                                {formData.type === 'SERVICE' ? 
                                  (formData.category.toLowerCase().includes('taxi') ? 'Trip Fee ($)' : 'Service Fee ($)') 
                                  : 'Price Override'}
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                required={formData.type === 'SERVICE'}
                                className="w-full px-4 py-2.5 bg-card border border-border text-ink rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono font-bold"
                                value={variant.price === 0 ? '0' : (variant.price || '')}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                  const priceVal = isNaN(val as number) ? undefined : val;
                                  
                                  setFormData(prev => ({
                                    ...prev,
                                    variants: prev.variants.map(v => v.id === variant.id ? { 
                                      ...v, 
                                      price: priceVal,
                                      stock: prev.type === 'SERVICE' ? 1000 : v.stock
                                    } : v)
                                  }));
                                }}
                                placeholder=""
                              />
                          </div>

                          {formData.type === 'PRODUCT' && (
                            <>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">
                                  <Package className="w-3 h-3" />
                                  Stock Level
                                  <span className={`ml-auto text-[8px] font-bold uppercase ${statusColor}`}>
                                    {isOutOfStock ? 'Out' : isLowStock ? 'Low' : 'Good'}
                                  </span>
                                </label>
                                <div className="relative">
                                  <input
                                    required
                                    type="number"
                                    className={`w-full px-4 py-2.5 bg-card border ${isLowStock || isOutOfStock ? 'border-amber-500/50' : 'border-border'} text-ink rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all`}
                                    value={variant.stock || 0}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value);
                                      updateVariant(variant.id, 'stock', isNaN(val) ? 0 : val);
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">
                                  <AlertCircle className="w-3 h-3" />
                                  Min Stock
                                </label>
                                <input
                                  type="number"
                                  placeholder={formData.lowStockThreshold.toString()}
                                  className="w-full px-4 py-2.5 bg-card border border-border text-ink rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                  value={variant.lowStockThreshold || ''}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    updateVariant(variant.id, 'lowStockThreshold', isNaN(val) ? undefined : val);
                                  }}
                                />
                              </div>
                            </>
                          )}
                        </div>

                        {formData.type === 'PRODUCT' && (
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">
                              <Hash className="w-3 h-3" />
                              SKU / Barcode
                            </label>
                            <div className="relative group/sku flex gap-2">
                            <div className="relative flex-1">
                              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within/sku:text-indigo-500 transition-colors">
                                <Hash className="w-4 h-4" />
                              </div>
                              <input
                                type="text"
                                className="w-full pl-11 pr-12 py-3 bg-card border border-border text-ink rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono tracking-wider"
                                value={variant.sku}
                                onChange={(e) => updateVariant(variant.id, 'sku', e.target.value)}
                                placeholder="Scan or enter SKU"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setScanningForVariantId(variant.id);
                                  setIsScannerOpen(true);
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-muted hover:text-indigo-500 transition-colors"
                                title="Scan with Camera"
                              >
                                <Camera className="w-4 h-4" />
                              </button>
                            </div>
                            {!variant.sku && (
                              <button
                                type="button"
                                onClick={() => {
                                  const randomSku = Math.random().toString(36).substring(2, 10).toUpperCase();
                                  updateVariant(variant.id, 'sku', randomSku);
                                }}
                                className="px-4 py-2 bg-muted hover:bg-border text-ink rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                              >
                                <Zap className="w-3 h-3" />
                                Generate
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                  {formData.variants.length === 0 && (
                    <div className="p-12 text-center border-2 border-dashed border-border rounded-[32px] text-muted bg-bg/50">
                      <Layers className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p className="font-bold">No variants added yet</p>
                      <p className="text-xs mt-1">Click "Add Variant" to define product sizes, colors, or types.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-4 sticky bottom-0 bg-card py-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 border border-border text-muted font-bold rounded-xl hover:bg-bg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                >
                  {editingProduct ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => {
          setIsScannerOpen(false);
          setScanningForVariantId(null);
        }}
        onScan={handleBarcodeScan}
      />
      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setProductToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Delete Product?"
        message="Are you sure you want to delete this product? This will remove all variants and associated stock records."
        itemName={products.find(p => p.id === productToDelete)?.name}
      />

      {/* Bulk Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isBulkDeleteConfirmOpen}
        onClose={() => setIsBulkDeleteConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        title="Delete Multiple Products?"
        message={`Are you sure you want to delete ${selectedProductIds.length} products? This will remove all variants and associated stock records for the selected items.`}
        itemName={`${selectedProductIds.length} items`}
      />
    </div>
  );
};
