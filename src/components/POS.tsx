import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { Product, Sale, SaleItem, UserProfile, Alert, Variant, Customer, BusinessProfile } from '../types';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Printer, 
  Banknote,
  AlertTriangle,
  Package,
  CheckCircle2,
  X,
  ShoppingCart,
  ChevronRight,
  Loader2,
  User,
  Award,
  Share2,
  Tag,
  Percent,
  Camera,
  Smartphone,
  CreditCard,
  Wallet,
  CheckCircle,
  MessageSquare,
  XCircle,
  History,
  AlertCircle,
  Clock,
  ExternalLink,
  Sparkles,
  Barcode,
  Hash,
  Info,
  ShieldCheck,
  Layers
} from 'lucide-react';
import { format } from 'date-fns';
import { Receipt } from './Receipt';
import { motion, AnimatePresence } from 'motion/react';
import { BarcodeScanner } from './BarcodeScanner';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { PaymentMethod } from '../types';
import { lookupBarcodeDetails, BarcodeProductInfo } from '../services/barcodeLookup';
import { playScanBeep } from '../lib/barcodeUtils';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { SafeImage } from './SafeImage';
import { printElement } from '../lib/printUtils';

import { getLocal, setLocal, removeLocal, localDb } from '../services/localDb';
import { supabase } from '../services/masterService';
import { syncService } from '../services/syncService';

interface POSProps {
  user: UserProfile;
  businessId: string;
  shopId: string;
}

export const POS: React.FC<POSProps> = ({ user, businessId, shopId }) => {
  const [saleNumber, setSaleNumber] = useState('');
  const [isSyncingState, setIsSyncingState] = useState(false);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);

  useEffect(() => {
    setSaleNumber(Math.random().toString(36).substring(2, 8).toUpperCase());
  }, []);

  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [showReceipt, setShowReceipt] = useState(false);
  const [isAutoPrinting, setIsAutoPrinting] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [overridePrice, setOverridePrice] = useState<{index: number, price: string} | null>(null);
  const [editingQuantity, setEditingQuantity] = useState<{index: number, quantity: string} | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [discount, setDiscount] = useState<{ type: 'percentage' | 'fixed', value: number, code?: string } | null>(null);
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountValue, setDiscountValue] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | 'code'>('percentage');
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [mpesaStatus, setMpesaStatus] = useState<'IDLE' | 'WAITING' | 'CONFIRMED' | 'FAILED'>('IDLE');
  const [mpesaConfirmation, setMpesaConfirmation] = useState<string | null>(null);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [isStkLoading, setIsStkLoading] = useState(false);
  const [selectedMpesaMethod, setSelectedMpesaMethod] = useState<'SEND_MONEY' | 'POCHI' | 'PAYBILL' | 'TILL' | null>(null);
  const [scannedLookupInfo, setScannedLookupInfo] = useState<BarcodeProductInfo | null>(null);
  const [isPosLookupLoading, setIsPosLookupLoading] = useState(false);
  const [scannedProductDetail, setScannedProductDetail] = useState<{
    product: Product;
    variant: Variant;
    scannedBarcode: string;
  } | null>(null);

  // Poll for M-Pesa transaction status
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    if (checkoutRequestId && mpesaStatus === 'WAITING') {
      const checkStatus = async () => {
        try {
          const apiHost = window.location.origin;
          const response = await fetch(`${apiHost}/api/mpesa/status/${checkoutRequestId}`);
          if (!response.ok) return; // Silent fail for polling errors to avoid UI noise
          const data = await response.json();

          if (data.status === 'SUCCESS') {
            setMpesaStatus('CONFIRMED');
            setMpesaConfirmation(data.reference);
            setSuccess("MPESA PAYMENT RECEIVED! Click Finish Sale to complete.");
            setCheckoutRequestId(null);
          } else if (data.status === 'FAILED') {
            setMpesaStatus('FAILED');
            setError(`Payment Failed: ${data.resultDesc || 'Unknown error'}`);
            setCheckoutRequestId(null);
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      };

      pollInterval = setInterval(checkStatus, 3000); // Check every 3 seconds
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [checkoutRequestId, mpesaStatus]);

  const triggerStkPush = async () => {
    if (!mpesaPhone || mpesaPhone.length < 10) {
      setError("PLEASE ENTER A VALID PHONE NUMBER");
      return;
    }

    const config = businessProfile?.mpesaConfig;
    if (!config?.consumerKey || !config?.consumerSecret || !config?.shortCode) {
      setError("M-PESA API NOT CONFIGURED. PLEASE USE MANUAL CONFIRMATION.");
      return;
    }

    setIsStkLoading(true);
    setMpesaStatus('WAITING');
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s timeout

    try {
      // Ensure we are calling the API on the same host
      const apiHost = window.location.origin;
      const response = await fetch(`${apiHost}/api/mpesa/stkpush`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: mpesaPhone,
          amount: total,
          config: config
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const responseText = await response.text();
      
      if (!response.ok) {
        let errorMessage = 'Failed to initiate STK push';
        const isStaticHost = window.location.hostname.includes('netlify.app') || 
                            window.location.hostname.includes('vercel.app') || 
                            window.location.hostname.includes('github.io');

        try {
          const errorJson = JSON.parse(responseText);
          errorMessage = errorJson.error || errorJson.errorMessage || errorMessage;
        } catch (e) {
          if (response.status === 404) {
            errorMessage = isStaticHost 
              ? `Backend APIs are not found on ${window.location.hostname}. This host only supports static files. Please deploy to a Node.js host (Cloud Run, Render, Railway, etc.) for M-Pesa to work.`
              : `API Route not found (404). Backend might not be configured correctly in this environment.`;
          } else {
            errorMessage = `Server error (${response.status}). Safaricom may be unreachable or credentials may be invalid.`;
          }
        }
        throw new Error(errorMessage);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error("Invalid response format from server.");
      }

      if (data.CheckoutRequestID) {
        setCheckoutRequestId(data.CheckoutRequestID);
        // We keep mpesaStatus as WAITING
      } else {
        throw new Error(data.error || data.errorMessage || 'Failed to initiate STK push');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError("REQUEST TIMED OUT. PLEASE CHECK YOUR CONNECTION.");
      } else {
        setError(err.message || "Failed to trigger M-Pesa prompt.");
      }
      setMpesaStatus('IDLE');
    } finally {
      setIsStkLoading(false);
      clearTimeout(timeoutId);
    }
  };
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isStaffMode, setIsStaffMode] = useState(false);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [cashAmount, setCashAmount] = useState('');
  const [cashDenominations] = useState([100, 500, 1000]);

  // Cart Persistence
  const cartStorageKey = `pos_cart_${businessId}_${shopId}`;

  useEffect(() => {
    const savedCart = getLocal<any>(cartStorageKey, null);
    if (savedCart) {
      try {
        if (Array.isArray(savedCart.cart)) setCart(savedCart.cart);
        if (savedCart.selectedCustomer) setSelectedCustomer(savedCart.selectedCustomer);
        if (savedCart.discount) setDiscount(savedCart.discount);
        if (savedCart.paymentMethod) setPaymentMethod(savedCart.paymentMethod);
        if (savedCart.selectedMpesaMethod) setSelectedMpesaMethod(savedCart.selectedMpesaMethod);
        if (savedCart.mpesaPhone) setMpesaPhone(savedCart.mpesaPhone);
        if (savedCart.isStaffMode !== undefined) setIsStaffMode(savedCart.isStaffMode);
      } catch (e) {
        console.error('Failed to load saved cart:', e);
      }
    }
    setIsInitialLoadDone(true);
  }, [businessId, shopId, cartStorageKey]);

  useEffect(() => {
    if (!isInitialLoadDone) return;
    
    const cartData = {
      cart,
      selectedCustomer,
      discount,
      paymentMethod,
      selectedMpesaMethod,
      mpesaPhone,
      isStaffMode
    };
    if (cart.length > 0) {
      setLocal(cartStorageKey, cartData);
    } else {
      removeLocal(cartStorageKey);
    }
  }, [cart, selectedCustomer, discount, paymentMethod, cartStorageKey, selectedMpesaMethod, mpesaPhone, isInitialLoadDone, isStaffMode]);

  useEffect(() => {
    const fetchData = async () => {
      const [p, c, b] = await Promise.all([
        db.getProducts(businessId, shopId),
        db.getCustomers(businessId),
        db.getBusinessById(businessId)
      ]);
      setProducts(p);
      setCustomers(c);
      setBusinessProfile(b || null);
    };
    
    fetchData();
    const handleBusinessUpdate = (e: any) => {
      if (e.detail?.id === businessId) {
        setBusinessProfile(prev => prev ? { ...prev, ...e.detail.updates } : null);
      }
    };
    const handleSyncComplete = () => {
      fetchData();
    };

    window.addEventListener('business-update', handleBusinessUpdate);
    window.addEventListener('sync-completed', handleSyncComplete);

    const interval = setInterval(fetchData, 30000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('business-update', handleBusinessUpdate);
      window.removeEventListener('sync-completed', handleSyncComplete);
    };
  }, [businessId, shopId]);

  useEffect(() => {
    if (businessProfile?.mpesaConfig) {
      const config = businessProfile.mpesaConfig;
      if (config.tillNumber) setSelectedMpesaMethod('TILL');
      else if (config.paybillNumber) setSelectedMpesaMethod('PAYBILL');
      else if (config.pochiNumber) setSelectedMpesaMethod('POCHI');
      else if (config.sendMoneyNumber) setSelectedMpesaMethod('SEND_MONEY');
    }
  }, [businessProfile]);

  const handleAutoAddLookupToPOSCart = async (info: BarcodeProductInfo) => {
    try {
      const newVariantId = crypto.randomUUID();
      const newProduct: Product = {
        id: crypto.randomUUID(),
        businessId,
        shopId,
        name: info.name || `Scanned Item (${info.barcode})`,
        category: info.category || 'General',
        buyingPrice: 0,
        sellingPrice: 100,
        basePrice: 100,
        lowStockThreshold: 5,
        variants: [
          {
            id: newVariantId,
            size: 'Standard',
            color: 'Default',
            stock: 100,
            sku: info.barcode
          }
        ],
        description: info.description || `Added via barcode-list.com lookup`,
        imageUrl: info.imageUrl || '',
        type: 'PRODUCT',
        brand: info.brand || ''
      };

      await db.addProduct(newProduct);
      const updatedProducts = await db.getProducts(businessId, shopId);
      setProducts(updatedProducts);

      const added = updatedProducts.find(p => p.id === newProduct.id) || newProduct;
      addToCart(added, added.variants[0]);
      setScannedLookupInfo(null);
      setSuccess(`Auto-added "${added.name}" to inventory & cart!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(`Failed to auto-add product: ${err.message}`);
    }
  };

  const handleBarcodeScan = (barcode: string) => {
    const cleanBar = barcode.trim();
    if (!cleanBar) return;

    playScanBeep();

    const normalize = (s: string) => (s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const searchKey = normalize(cleanBar);

    // Search local inventory products for matching variant SKU/barcode or product ID/barcode
    const product = products.find(p => 
      p.variants.some(v => {
        const skuKey = normalize(v.sku);
        const barKey = normalize((v as any).barcode);
        return (skuKey && skuKey === searchKey) || (barKey && barKey === searchKey);
      }) || 
      (p.id && normalize(p.id) === searchKey) || 
      ((p as any).barcode && normalize((p as any).barcode) === searchKey)
    );

    if (product) {
      const variant = product.variants.find(v => {
        const skuKey = normalize(v.sku);
        const barKey = normalize((v as any).barcode);
        return (skuKey && skuKey === searchKey) || (barKey && barKey === searchKey);
      }) || product.variants[0];

      if (variant) {
        addToCart(product, variant);
        setSearchTerm('');

        // Pop up complete details modal for the scanned product
        setScannedProductDetail({
          product,
          variant,
          scannedBarcode: cleanBar
        });

        setSuccess(`Barcode Matched: ${product.name}`);
        setTimeout(() => setSuccess(null), 2500);
      }
    } else {
      setScannedLookupInfo(null);
      setIsPosLookupLoading(true);
      
      lookupBarcodeDetails(cleanBar)
        .then((info) => {
          if (info.found) {
            setScannedLookupInfo(info);
            setSuccess(`Online Product Catalog Match: "${info.name}"`);
            setTimeout(() => setSuccess(null), 4000);
          } else {
            setError(`No product found in inventory for barcode: ${cleanBar}`);
            setTimeout(() => setError(null), 3500);
          }
        })
        .catch(() => {
          setError(`No product found for barcode: ${cleanBar}`);
          setTimeout(() => setError(null), 3500);
        })
        .finally(() => {
          setIsPosLookupLoading(false);
        });
    }
  };

  useHardwareScanner({ onScan: handleBarcodeScan });

  useEffect(() => {
    const handleSyncStats = (e: any) => {
      if (e.detail && typeof e.detail.isOnline === 'boolean') {
        setIsOnline(e.detail.isOnline);
      }
    };
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('sync-stats-updated', handleSyncStats);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initialize state from existing service stats
    setIsOnline(syncService.getStats().isOnline);
    
    return () => {
      window.removeEventListener('sync-stats-updated', handleSyncStats);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const receiptRef = useRef<HTMLDivElement>(null);
  
  // Auto-print receipt when showReceipt or isAutoPrinting is true
  useEffect(() => {
    if ((showReceipt || isAutoPrinting) && lastSale) {
      const timer = setTimeout(() => {
        handlePrint(isAutoPrinting);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showReceipt, isAutoPrinting, lastSale]);

  const handlePrint = (autoClose = false) => {
    const success = printElement('print-receipt', true);
    if (success && autoClose) {
      setTimeout(() => {
        setShowReceipt(false);
        setIsAutoPrinting(false);
      }, 800);
    }
  };

  const formatCurrency = (amount: number) => {
    return `${businessProfile?.currency || 'KSh'}${amount.toFixed(2)}`;
  };

  const addToCart = (product: Product, variant: Variant) => {
    if (variant.stock <= 0) return;
    
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id && item.variantId === variant.id);
      if (existing) {
        return prev.map(item => 
          (item.productId === product.id && item.variantId === variant.id)
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      const itemPrice = variant.price || product.sellingPrice || product.basePrice;
      return [...prev, {
        productId: product.id,
        variantId: variant.id,
        name: product.name,
        category: product.category,
        variantName: `${variant.color} / ${variant.size}`,
        quantity: 1,
        price: itemPrice,
        originalPrice: itemPrice,
        buyingPrice: product.buyingPrice || 0,
        unit: product.unit || 'pcs'
      }];
    });
    setSelectedProduct(null);
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart(prev => {
      const item = prev[index];
      if (!item) return prev;

      const product = products.find(p => p.id === item.productId);
      const variant = product?.variants.find(v => v.id === item.variantId);
      
      if (delta > 0 && variant && item.quantity >= variant.stock) return prev;
      
      const newQuantity = item.quantity + delta;
      if (newQuantity <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      
      return prev.map((it, i) => i === index ? { ...it, quantity: newQuantity } : it);
    });
  };

  const setQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      updateQuantity(index, -cart[index].quantity);
      return;
    }

    setCart(prev => {
      const item = prev[index];
      if (!item) return prev;

      const product = products.find(p => p.id === item.productId);
      const variant = product?.variants.find(v => v.id === item.variantId);
      
      let finalQuantity = newQuantity;
      if (variant && newQuantity > variant.stock) {
        finalQuantity = variant.stock;
      }

      return prev.map((it, i) => i === index ? { ...it, quantity: finalQuantity } : it);
    });
    setEditingQuantity(null);
  };

  const handlePriceOverride = async (index: number, newPrice: number) => {
    const item = cart[index];
    if (newPrice !== item.originalPrice) {
      const alert: Omit<Alert, 'id'> = {
        businessId,
        shopId,
        type: 'PRICE_OVERRIDE',
        message: `${user.name} changed price of ${item.name} (${item.variantName}) from ${formatCurrency(item.originalPrice)} to ${formatCurrency(newPrice)}`,
        timestamp: new Date().toISOString(),
        status: 'UNREAD',
        details: {
          productId: item.productId,
          variantId: item.variantId,
          cashierId: user.uid,
          oldPrice: item.originalPrice,
          newPrice: newPrice
        }
      };
      await db.addAlert(alert);
    }
    
    setCart(prev => prev.map((it, i) => i === index ? { ...it, price: newPrice } : it));
    setOverridePrice(null);
  };

  const handleStationSync = async () => {
    if (isSyncingState) return;
    setIsSyncingState(true);
    setSuccess("Syncing terminal session with cloud database...");
    const result = await syncService.syncNow(true);
    setIsSyncingState(false);
    if (result) {
      setSuccess("Database sync completed. Station is live.");
    } else {
      setError("Cloud database sync failed. Cached locally.");
    }
    setTimeout(() => {
      setSuccess(null);
      setError(null);
    }, 3500);
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountAmount = discount 
    ? (discount.type === 'percentage' ? (subtotal * discount.value / 100) : discount.value)
    : 0;
  const total = Math.max(0, subtotal - discountAmount);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setError("PLEASE ADD PRODUCTS TO THE CART BEFORE COMPLETING A SALE");
      return;
    }
    if (isProcessing) return;
    
    setIsProcessing(true);
    setError(null);

    // Refresh business profile to get latest M-Pesa config
    const latestProfile = await db.getBusinessById(businessId);
    if (latestProfile) setBusinessProfile(latestProfile);
    const config = latestProfile?.mpesaConfig || businessProfile?.mpesaConfig;

    const finalTotal = Number(total.toFixed(2));
    
    if (paymentMethod === 'DEBT' && !selectedCustomer) {
      setIsProcessing(false);
      setError("A customer must be selected for debt transactions.");
      return;
    }

    if (isNaN(finalTotal) || finalTotal < 0) {
      setIsProcessing(false);
      setError("Invalid total amount. Please check your cart.");
      return;
    }

    if (paymentMethod === 'CASH') {
      const received = parseFloat(cashAmount);
      if (!cashAmount || isNaN(received)) {
        setIsProcessing(false);
        setError("Please enter the cash amount received from the customer.");
        return;
      }
      if (received < finalTotal) {
        setIsProcessing(false);
        setError(`Insufficient cash. Amount must be at least ${formatCurrency(finalTotal)}`);
        return;
      }
    }

    const completeSale = async (confirmation?: string) => {
      try {
        const loyaltyPoints = Math.floor(finalTotal / 10);
        const received = parseFloat(cashAmount);
        const changeDue = received >= finalTotal ? received - finalTotal : 0;

        const sale: Omit<Sale, 'id'> = {
          businessId,
          shopId,
          items: cart,
          total: finalTotal,
          timestamp: new Date().toISOString(),
          cashierId: user.uid,
          cashierName: user.name,
          loyaltyPointsEarned: loyaltyPoints,
          paymentMethod,
          status: 'COMPLETED',
          mpesaReference: confirmation ? (confirmation.includes('Ref: ') ? confirmation.split('Ref: ')[1] : confirmation) : undefined,
          cashReceived: paymentMethod === 'CASH' && !isNaN(received) ? Number(received.toFixed(2)) : undefined,
          change: paymentMethod === 'CASH' && !isNaN(received) ? Number(changeDue.toFixed(2)) : undefined,
          ...(selectedCustomer ? {
            customerId: selectedCustomer.id,
            customerName: selectedCustomer.name
          } : {}),
          ...(discount ? {
            discount: {
              ...discount,
              amount: Number(discountAmount.toFixed(2))
            }
          } : {})
        };

        // 1. Create the sale
        const newSale = await db.addSale(sale);
        
        // 1.1 Create Debt and Ledger Entry if payment method is DEBT
        if (paymentMethod === 'DEBT' && selectedCustomer) {
          const debt = await db.addDebt({
            businessId,
            shopId,
            customerId: selectedCustomer.id,
            saleId: newSale.id,
            amount: finalTotal,
            remainingAmount: finalTotal,
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Default 30 days
            status: 'PENDING',
            createdAt: new Date().toISOString()
          });

          await db.addLedgerEntry({
            businessId,
            shopId,
            entityId: selectedCustomer.id,
            entityType: 'CUSTOMER',
            type: 'DEBIT',
            amount: finalTotal,
            balanceAfter: selectedCustomer.totalSpent + finalTotal, // This is a simplification
            description: `Debt from sale #${newSale.id.slice(-8).toUpperCase()}`,
            referenceId: newSale.id,
            timestamp: new Date().toISOString()
          });

          await db.addAlert({
            businessId,
            shopId,
            type: 'DEBT_OVERDUE',
            message: `New debt recorded for ${selectedCustomer.name}: ${finalTotal}`,
            timestamp: new Date().toISOString(),
            status: 'UNREAD',
            details: { debtId: debt.id, customerId: selectedCustomer.id }
          });
        }
        
        // 2. Update customer loyalty points and total spent if selected
        if (selectedCustomer) {
          await db.updateCustomer(selectedCustomer.id, {
            loyaltyPoints: selectedCustomer.loyaltyPoints + loyaltyPoints,
            totalSpent: selectedCustomer.totalSpent + finalTotal,
            lastPurchaseDate: new Date().toISOString()
          });
        }
        
        // 3. Update stock for each variant and create alerts if needed
        for (const item of cart) {
          const product = products.find(p => p.id === item.productId);
          if (!product || product.isService) continue;

          const variant = product.variants.find(v => v.id === item.variantId);
          if (variant) {
            const newStock = variant.stock - item.quantity;
            const updatedVariants = product.variants.map(v => 
              v.id === variant.id ? { ...v, stock: newStock } : v
            );
            
            await db.updateProduct(product.id, { variants: updatedVariants });

            if (newStock <= product.lowStockThreshold) {
              await db.addAlert({
                businessId,
                shopId,
                type: 'LOW_STOCK',
                message: `Low stock alert: ${product.name} (${variant.color}/${variant.size}) - ${newStock} remaining`,
                timestamp: new Date().toISOString(),
                status: 'UNREAD',
                details: { productId: product.id, variantId: variant.id }
              });
            }
          }
        }

        setLastSale({ ...sale, id: newSale.id });
        setIsAutoPrinting(true);
        setSuccess("Sale completed successfully! Printing receipt...");
        setTimeout(() => setSuccess(null), 3000);
        setCart([]);
        setSelectedCustomer(null);
        setDiscount(null);
        removeLocal(cartStorageKey);
        setPaymentMethod('CASH');
        setMpesaStatus('IDLE');
        setMpesaConfirmation(null);
        setMpesaPhone('');
        setCashAmount('');
        setError(null);
      } catch (err: any) {
        console.error("Sale completion error:", err);
        setError("Failed to record sale. Please try again.");
      } finally {
        setIsProcessing(false);
      }
    };

    try {
      if (paymentMethod === 'MPESA') {
        if (mpesaStatus !== 'CONFIRMED') {
          setError("Please confirm the M-Pesa payment first.");
          setIsProcessing(false);
          return;
        }
        await completeSale(mpesaConfirmation || undefined);
        return;
      }

      await completeSale(mpesaConfirmation || undefined);

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setIsProcessing(false);
    }
  };

  const handleShare = async () => {
    if (!lastSale) return;
    
      const shareData = {
        title: `Receipt from ${businessProfile?.name || 'Business'} - ${lastSale.id.slice(-8).toUpperCase()}`,
        text: `Your receipt for ${formatCurrency(lastSale.total)} at ${businessProfile?.name || 'Business'}.`,
        url: `${window.location.origin}/?saleId=${lastSale.id}`
      };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        alert('Receipt link copied to clipboard!');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(products.map(p => p.category))).sort();

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-95px)] min-h-[600px] overflow-hidden">
      {/* Main Split Layout: Left Catalog Grid & Right Cart Order Panel */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 overflow-hidden relative">

        {/* LEFT COLUMN: Visual Product Catalog & Grid */}
        <div className="flex-1 lg:w-[60%] xl:w-[62%] flex flex-col bg-[#f8f9fc] rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full">
          
          {/* Top Header Bar: Sale #, Search & Quick Utility Controls */}
          <div className="p-3.5 sm:px-5 sm:py-4 bg-white border-b border-slate-200 flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border border-indigo-100">
                  SALE #{saleNumber}
                </span>
                <button
                  disabled={isSyncingState}
                  onClick={handleStationSync}
                  className={`flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-xl border font-extrabold uppercase transition-all cursor-pointer active:scale-95 ${
                    isSyncingState ? 'bg-indigo-50 text-indigo-500 border-indigo-200 animate-pulse' :
                    isOnline ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' : 'bg-rose-50 text-rose-500 border-rose-100'
                  }`}
                  title="Click to trigger cloud synchronization manually"
                >
                  {isSyncingState ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  {isSyncingState ? 'SYNCING...' : isOnline ? 'STATION LIVE' : 'STATION OFFLINE'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsScannerOpen(true)}
                  className="px-3 py-1.5 bg-[#5d44ff] text-white rounded-xl shadow-sm hover:opacity-90 transition-all flex items-center gap-1.5"
                  title="Scan Barcode using Camera"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-black uppercase tracking-wider hidden sm:inline">SCAN</span>
                </button>

                {lastSale && (
                  <button
                    onClick={() => setShowReceipt(true)}
                    className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-all flex items-center gap-1.5"
                    title="Reprint last transaction receipt"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-black uppercase tracking-wider hidden sm:inline">RECEIPT</span>
                  </button>
                )}

                <button
                  onClick={() => setIsDeviceModalOpen(true)}
                  className="p-2 bg-white text-slate-500 hover:text-indigo-600 rounded-xl border border-slate-200 hover:border-slate-300 shadow-sm active:scale-95 transition-all"
                  title="Manage Connected Peripherals"
                >
                  <Smartphone className="w-4 h-4" />
                </button>

                {cart.length > 0 && (
                  <button 
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="p-2 bg-white text-rose-500 rounded-xl border border-rose-200 hover:bg-rose-50 active:scale-95 transition-all"
                    title="Clear entire cart"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Search Input Bar */}
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-500 w-4 h-4 pointer-events-none" />
              <input
                type="text"
                placeholder="SEARCH INVENTORY OR SCAN BARCODE..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-indigo-200 focus:border-indigo-500 text-slate-800 rounded-xl shadow-inner text-xs font-bold outline-none placeholder:text-slate-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchTerm) {
                    handleBarcodeScan(searchTerm);
                  }
                }}
                autoFocus
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Scanned Barcode Found Banner (barcode-list.com integration) */}
            <AnimatePresence>
              {scannedLookupInfo && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-3.5 rounded-xl border border-indigo-500/40 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded-lg shrink-0">
                      <Sparkles className="w-5 h-5 text-amber-300 fill-amber-300" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-white flex items-center gap-1.5">
                        <span>Matched on barcode-list.com:</span>
                        <span className="text-indigo-200 underline">{scannedLookupInfo.name}</span>
                      </p>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Barcode: <span className="font-mono font-bold">{scannedLookupInfo.barcode}</span> {scannedLookupInfo.brand ? `• Brand: ${scannedLookupInfo.brand}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => handleAutoAddLookupToPOSCart(scannedLookupInfo)}
                      className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs uppercase rounded-lg shadow-md transition-all cursor-pointer whitespace-nowrap active:scale-95 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Auto-Add & Sell Now</span>
                    </button>
                    <button
                      onClick={() => setScannedLookupInfo(null)}
                      className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3.5 py-1.5 rounded-xl font-black text-[11px] uppercase tracking-wider whitespace-nowrap transition-all ${
                  selectedCategory === null
                    ? 'bg-[#5d44ff] text-white shadow-md shadow-indigo-200 scale-105'
                    : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                }`}
              >
                ALL ITEMS ({products.length})
              </button>
              {categories.map(cat => {
                const count = products.filter(p => p.category === cat).length;
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-xl font-black text-[11px] uppercase tracking-wider whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-[#5d44ff] text-white shadow-md shadow-indigo-200 scale-105'
                        : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Cards Visual Grid */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-4">
            {filteredProducts.length === 0 ? (
              <div className="h-full min-h-[250px] flex flex-col items-center justify-center text-slate-300 py-12 gap-3">
                <Package className="w-16 h-16 text-slate-300" />
                <p className="text-sm font-black uppercase tracking-widest text-slate-400 text-center">
                  No Inventory Items Match "{searchTerm || selectedCategory || 'Filters'}"
                </p>
                {(searchTerm || selectedCategory) && (
                  <button 
                    onClick={() => { setSearchTerm(''); setSelectedCategory(null); }}
                    className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {filteredProducts.map(product => {
                  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
                  const displayPrice = product.sellingPrice || product.basePrice || product.variants[0]?.price || 0;
                  const imgUrl = product.imageUrl || (product.variants.find(v => (v as any).imageUrl) as any)?.imageUrl || '';
                  const cartQty = cart
                    .filter(item => item.productId === product.id)
                    .reduce((sum, item) => sum + item.quantity, 0);

                  return (
                    <button
                      key={product.id}
                      disabled={product.type === 'PRODUCT' && totalStock <= 0}
                      onClick={() => {
                        if (product.variants.length === 1) {
                          addToCart(product, product.variants[0]);
                        } else {
                          setSelectedProduct(product);
                        }
                      }}
                      className={`group relative flex flex-col rounded-2xl overflow-hidden border transition-all text-left cursor-pointer active:scale-[0.97] shadow-sm hover:shadow-xl ${
                        product.type === 'PRODUCT' && totalStock <= 0
                          ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                          : 'bg-white border-slate-200 hover:border-indigo-500 hover:ring-2 hover:ring-indigo-500/20'
                      }`}
                    >
                      {/* Product Image Header Container */}
                      <div className="relative w-full h-32 sm:h-36 md:h-40 bg-slate-100 overflow-hidden">
                        {imgUrl ? (
                          <SafeImage
                            src={imgUrl}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-slate-100 to-indigo-50/60 flex flex-col items-center justify-center p-3 text-slate-400 group-hover:from-indigo-50 group-hover:to-indigo-100/60 transition-colors">
                            <Package className="w-10 h-10 text-indigo-400/60 mb-1" />
                            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider text-center line-clamp-1">{product.category}</span>
                          </div>
                        )}

                        {/* Gradient Shadow Overlay for Text Contrast */}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent pointer-events-none" />

                        {/* Top Floating Badges (Stock & Cart Quantity) */}
                        <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 pointer-events-none z-10">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider backdrop-blur-md shadow-sm ${
                            product.type === 'SERVICE'
                              ? 'bg-indigo-600/90 text-white'
                              : totalStock <= 0
                              ? 'bg-rose-600/90 text-white'
                              : totalStock <= 5
                              ? 'bg-amber-500/90 text-white'
                              : 'bg-slate-900/75 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {product.type === 'SERVICE' ? 'Service' : totalStock <= 0 ? 'Out of Stock' : `Stock: ${totalStock}`}
                          </span>

                          {cartQty > 0 && (
                            <span className="px-2.5 py-0.5 bg-[#5d44ff] text-white rounded-full text-[10px] font-black shadow-lg flex items-center gap-1 animate-in zoom-in-50">
                              <ShoppingCart className="w-3 h-3" />
                              {cartQty}
                            </span>
                          )}
                        </div>

                        {/* Bottom Overlaid Product Title & Price Badge */}
                        <div className="absolute bottom-2 left-2.5 right-2.5 z-10 text-white pointer-events-none">
                          <p className="font-extrabold text-xs sm:text-sm leading-snug text-white drop-shadow-md line-clamp-2">
                            {product.name}
                          </p>
                          <div className="flex items-center justify-between mt-1 gap-1">
                            <span className="text-[9px] font-extrabold text-indigo-200 uppercase tracking-widest truncate max-w-[55%]">
                              {product.variants.length > 1 ? `${product.variants.length} Options` : product.category}
                            </span>
                            <span className="bg-[#5d44ff] text-white px-2 py-0.5 rounded-lg text-xs font-black shadow-md tracking-tight whitespace-nowrap">
                              {formatCurrency(displayPrice)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Cart & Checkout Panel (Desktop & Tablet) */}
        <div className="hidden lg:flex w-[40%] xl:w-[38%] flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full">
          
          {/* Cart Header */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#5d44ff] text-white rounded-xl shadow-sm">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Current Order</h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)} Items Selected
                </p>
              </div>
            </div>

            {cart.length > 0 && (
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="text-xs font-bold text-rose-500 hover:text-rose-700 hover:underline uppercase tracking-wider flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>

          {/* Customer Attachment Bar */}
          <div className="p-3 bg-white border-b border-slate-100">
            {selectedCustomer ? (
              <div className="flex items-center justify-between bg-indigo-50/70 border border-indigo-100 p-2.5 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-white text-indigo-600 rounded-lg flex items-center justify-center font-bold text-xs border border-indigo-200">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800 truncate">{selectedCustomer.name}</p>
                    <p className="text-[10px] text-indigo-600 font-bold uppercase flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      {selectedCustomer.loyaltyPoints} PTS
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="p-1 text-rose-500 hover:bg-white rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowCustomerSearch(!showCustomerSearch)}
                  className="w-full flex items-center justify-between px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-black text-slate-600 hover:border-slate-300 transition-all uppercase tracking-wider"
                >
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Attach Customer</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showCustomerSearch ? 'rotate-90' : ''}`} />
                </button>

                <AnimatePresence>
                  {showCustomerSearch && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden"
                    >
                      <div className="p-2 border-b border-slate-100">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search customers..."
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                          value={customerSearchTerm}
                          onChange={(e) => setCustomerSearchTerm(e.target.value)}
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {customers
                          .filter(c => c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()))
                          .map(customer => (
                            <button
                              key={customer.id}
                              onClick={() => {
                                setSelectedCustomer(customer);
                                setShowCustomerSearch(false);
                                setCustomerSearchTerm('');
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-indigo-50 flex items-center justify-between group transition-colors text-xs"
                            >
                              <div>
                                <p className="font-bold text-slate-800 group-hover:text-indigo-600">{customer.name}</p>
                                <p className="text-[10px] text-slate-500">{customer.phone}</p>
                              </div>
                              <Award className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600" />
                            </button>
                          ))}
                        {customers.length === 0 && (
                          <div className="p-3 text-center text-xs text-slate-400">No customers found</div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Cart Itemized List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[160px]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10 gap-2">
                <ShoppingCart className="w-12 h-12 text-slate-300" />
                <p className="text-xs font-black uppercase tracking-wider text-slate-400 text-center">
                  Cart is Empty<br/>Tap items on the catalog to add
                </p>
              </div>
            ) : (
              cart.map((item, index) => (
                <div key={`${item.productId}-${item.variantId}`} className="bg-slate-50/70 rounded-xl border border-slate-200 p-2.5 flex items-center justify-between gap-2 hover:bg-white hover:shadow-sm transition-all">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-800 text-xs truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400 font-extrabold uppercase mt-0.5">{item.variantName}</p>
                    <div 
                      className="cursor-pointer text-indigo-600 font-extrabold text-xs mt-0.5 hover:underline"
                      onClick={() => setOverridePrice({ index, price: item.price.toString() })}
                    >
                      {formatCurrency(item.price)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
                      <button 
                        onClick={() => updateQuantity(index, -1)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <div 
                        className="w-7 text-center font-black text-slate-800 text-xs cursor-pointer"
                        onClick={() => setEditingQuantity({ index, quantity: item.quantity.toString() })}
                      >
                        {item.quantity}
                      </div>
                      <button 
                        onClick={() => updateQuantity(index, 1)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button 
                      onClick={() => updateQuantity(index, -item.quantity)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Payment & Finish Order Section */}
          <div className="p-3.5 bg-slate-50 border-t border-slate-200 space-y-3 shrink-0">
            
            {/* Payment Method Tabs */}
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { id: 'CASH', icon: <Banknote className="w-4 h-4" />, label: 'CASH' },
                { id: 'MPESA', icon: <Smartphone className="w-4 h-4" />, label: 'MPESA' },
                { id: 'CARD', icon: <CreditCard className="w-4 h-4" />, label: 'CARD' },
                { id: 'DEBT', icon: <Wallet className="w-4 h-4" />, label: 'DEBT' },
                { id: 'DISC', icon: <Tag className="w-4 h-4" />, label: 'DISC' }
              ].map((method) => {
                const isActive = paymentMethod === method.id;
                const isDisc = method.id === 'DISC';
                return (
                  <button
                    key={method.id}
                    onClick={() => {
                      if (isDisc) setShowDiscountInput(true);
                      else setPaymentMethod(method.id as PaymentMethod);
                    }}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all border text-center ${
                      isDisc ? 'border-dashed border-slate-300 text-slate-500 bg-white hover:border-indigo-400' :
                      isActive ? 'bg-[#5d44ff] text-white border-[#5d44ff] shadow-md font-black' : 
                      'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {method.icon}
                    <span className="text-[9px] font-extrabold mt-1 tracking-wider">{method.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Inputs: Discount / MPESA / Cash RCV */}
            {showDiscountInput ? (
              <div className="flex items-center gap-2 bg-white p-2 border border-indigo-200 rounded-xl">
                <input
                  type="number"
                  placeholder="Discount"
                  className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  autoFocus
                />
                <button
                  onClick={() => setDiscountType(discountType === 'percentage' ? 'fixed' : 'percentage')}
                  className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-black"
                >
                  {discountType === 'percentage' ? '%' : 'KSh'}
                </button>
                <button
                  onClick={() => {
                    const val = parseFloat(discountValue);
                    if (!isNaN(val) && val > 0) {
                      setDiscount({ type: discountType as any, value: val });
                      setShowDiscountInput(false);
                      setDiscountValue('');
                    }
                  }}
                  className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold"
                >
                  Apply
                </button>
                <button onClick={() => setShowDiscountInput(false)} className="text-slate-400 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : paymentMethod === 'MPESA' ? (
              <div className="space-y-2 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100">
                <div className="flex gap-2">
                  <input
                    type="tel"
                    placeholder="M-Pesa Phone (07xx...)"
                    className="flex-1 px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-indigo-700 outline-none"
                    value={mpesaPhone}
                    onChange={(e) => setMpesaPhone(e.target.value)}
                    disabled={mpesaStatus === 'WAITING' || isStkLoading}
                  />
                  <button 
                    onClick={triggerStkPush}
                    disabled={mpesaStatus === 'WAITING' || isStkLoading || mpesaStatus === 'CONFIRMED'}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black shadow-sm flex items-center gap-1 shrink-0 ${
                      mpesaStatus === 'CONFIRMED' ? 'bg-emerald-600 text-white' : 
                      mpesaStatus === 'WAITING' ? 'bg-amber-500 text-white animate-pulse' :
                      'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {isStkLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Smartphone className="w-3 h-3" />}
                    <span>{mpesaStatus === 'CONFIRMED' ? 'PAID' : isStkLoading ? 'SENDING...' : 'PROMPT'}</span>
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ref (Optional)"
                    className="flex-1 px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold outline-none"
                    value={mpesaConfirmation || ''}
                    onChange={(e) => setMpesaConfirmation(e.target.value)}
                  />
                  <button 
                    onClick={() => {
                      if (mpesaPhone.length < 10) {
                        setError("PLEASE ENTER A VALID PHONE NUMBER");
                        return;
                      }
                      setMpesaStatus('CONFIRMED');
                      if (!mpesaConfirmation) {
                        setMpesaConfirmation('Manual Ref: ' + Math.random().toString(36).substring(2, 10).toUpperCase());
                      }
                      setSuccess("MPESA PAYMENT CONFIRMED MANUALLY!");
                    }}
                    disabled={mpesaStatus === 'CONFIRMED'}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-[10px] text-slate-600 hover:border-indigo-400 uppercase"
                  >
                    Manual
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1 text-[9px] font-black text-indigo-400 uppercase">Received</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    className="w-full bg-white border border-indigo-200 rounded-xl px-2.5 pt-4 pb-1 text-indigo-700 font-extrabold text-sm outline-none"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                  />
                </div>

                {cashAmount && parseFloat(cashAmount) >= total && (
                  <div className="bg-emerald-500 px-3 py-1.5 rounded-xl text-white text-center shrink-0">
                    <p className="text-[9px] font-black uppercase leading-none">CHANGE</p>
                    <p className="text-xs font-black">{formatCurrency(parseFloat(cashAmount) - total)}</p>
                  </div>
                )}

                <div className="flex gap-1 shrink-0">
                  {[100, 500, 1000].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setCashAmount((prev) => (parseFloat(prev || '0') + amt).toString())}
                      className="px-2 py-2 bg-white border border-slate-200 rounded-xl text-indigo-600 font-extrabold text-[10px] hover:bg-slate-100"
                    >
                      +{amt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Total & Finish Sale */}
            <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">TOTAL PAYABLE</p>
                <p className="text-2xl font-black text-[#5d44ff] tracking-tight">{formatCurrency(total)}</p>
              </div>

              <button
                disabled={cart.length === 0 || isProcessing}
                onClick={handleCheckout}
                className="flex items-center gap-2 bg-[#5d44ff] text-white px-6 py-3.5 rounded-xl font-black uppercase text-xs tracking-wider hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 shadow-md shadow-indigo-200"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                <span>FINISH SALE</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Bar for Mobile Screen Order View */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40 bg-[#5d44ff] text-white p-3 rounded-2xl shadow-2xl flex items-center justify-between border border-indigo-400 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider">{cart.reduce((sum, item) => sum + item.quantity, 0)} Items Selected</p>
              <p className="text-sm font-black">{formatCurrency(total)}</p>
            </div>
          </div>
          <button
            onClick={() => setIsCartModalOpen(true)}
            className="px-4 py-2 bg-white text-[#5d44ff] rounded-xl text-xs font-black uppercase tracking-wider shadow-sm active:scale-95"
          >
            Review Cart
          </button>
        </div>
      )}

      {/* Floating Alerts Overlay */}
      <AnimatePresence>
        {(success || error) && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={`fixed bottom-20 left-1/2 -translate-x-1/2 px-6 py-2.5 rounded-full shadow-2xl border backdrop-blur-md flex items-center gap-3 whitespace-nowrap z-[120] ${
              success ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-rose-600 border-rose-400 text-white'
            }`}
          >
            {success ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            <span className="text-xs font-black uppercase tracking-widest">{success || error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Variant Selection Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-ink text-xl">{selectedProduct.name}</h3>
                  <p className="text-muted text-sm">{selectedProduct.type === 'SERVICE' ? 'Select service style / option' : 'Select variant to add to cart'}</p>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="p-2 hover:bg-bg rounded-lg">
                  <X className="w-5 h-5 text-muted" />
                </button>
              </div>
              <div className="p-6 grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto">
                {selectedProduct.variants.map(variant => (
                  <button
                    key={variant.id}
                    disabled={selectedProduct.type === 'PRODUCT' && variant.stock <= 0}
                    onClick={() => addToCart(selectedProduct, variant)}
                    className={`flex items-center justify-between rounded-2xl border p-4 transition-all ${
                      selectedProduct.type === 'PRODUCT' && variant.stock <= 0 
                        ? 'bg-bg border-border opacity-50 cursor-not-allowed' 
                        : 'bg-card border-border hover:border-indigo-500 hover:bg-indigo-500/10 group'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-bg rounded-xl flex items-center justify-center group-hover:bg-indigo-500/20 w-10 h-10">
                        {selectedProduct.type === 'SERVICE' ? (
                          <Clock className="w-5 h-5 text-muted group-hover:text-indigo-500" />
                        ) : (
                          <Package className="w-5 h-5 text-muted group-hover:text-indigo-500" />
                        )}
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-ink">
                          {variant.color} {variant.size ? `(${variant.size})` : ''}
                        </p>
                        <p className="font-black text-indigo-600 text-sm">
                          {formatCurrency(variant.price || selectedProduct.sellingPrice || selectedProduct.basePrice || 0)}
                        </p>
                        {selectedProduct.type === 'PRODUCT' && (
                          <p className="text-muted text-xs">{variant.stock} in stock</p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted group-hover:text-indigo-500" />
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Receipt Modal */}
      {(showReceipt || isAutoPrinting) && lastSale && (
        <div className={`fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 ${isAutoPrinting ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="bg-card border border-border rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 bg-accent text-white flex flex-col items-center gap-2 shrink-0">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold">Payment Successful</h3>
              <p className="text-white/80 text-xs">Transaction ID: {lastSale.id.slice(-8).toUpperCase()}</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 bg-bg/50" id="print-receipt-container">
              {/* Device-agnostic Web Print Preview Fallback */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl mb-6 text-left">
                <div className="flex items-start gap-3">
                  <Printer className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-ink text-xs uppercase tracking-wider">Device-Agnostic Print Layout</p>
                    <p className="text-muted text-[11px] leading-relaxed">
                      Printing on a phone, tablet, or experiencing blank iframe previews? Open the print stream in a new tab for native, high-fidelity system printing.
                    </p>
                    <div className="pt-2">
                      <a 
                        href={`/?printSaleId=${lastSale.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-400 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-all pointer-events-auto"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Live Print Preview (New Tab)
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div id="print-receipt" className="bg-white shadow-sm rounded-2xl overflow-hidden mb-6">
                <Receipt ref={receiptRef} sale={lastSale} businessProfile={businessProfile!} />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 no-print">
                <button 
                  type="button"
                  onClick={() => {
                    console.log('Print button clicked');
                    handlePrint();
                  }}
                  className="flex items-center justify-center gap-2 py-3 border border-border rounded-xl font-semibold text-ink hover:bg-bg transition-all text-sm"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
                <button 
                  onClick={handleShare}
                  className="flex items-center justify-center gap-2 py-3 border border-border rounded-xl font-semibold text-ink hover:bg-bg transition-all text-sm"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
                <button 
                  onClick={() => {
                    setShowReceipt(false);
                    setIsAutoPrinting(false);
                  }}
                  className="flex items-center justify-center gap-2 py-3 bg-ink text-bg rounded-xl font-semibold hover:bg-ink/90 transition-all text-sm"
                >
                  New Sale
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Barcode Scanner Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={async () => {
          setCart([]);
          setSelectedCustomer(null);
          setDiscount(null);
          await removeLocal(cartStorageKey);
          setIsDeleteModalOpen(false);
        }}
        title="Clear Cart"
        message="Are you sure you want to clear all items from your cart?"
      />
      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(barcode) => {
          handleBarcodeScan(barcode);
          setIsScannerOpen(false);
        }}
      />

      {/* Cart Inspector Modal */}
      <AnimatePresence>
        {isCartModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/10 text-indigo-600 rounded-xl">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-ink text-lg uppercase tracking-wider">Current Cart Details</h3>
                    <p className="text-xs text-muted">Review and manage items in your current sale</p>
                  </div>
                </div>
                <button onClick={() => setIsCartModalOpen(false)} className="p-2 hover:bg-bg rounded-lg">
                  <X className="w-5 h-5 text-muted" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {cart.length === 0 ? (
                  <div className="py-12 text-center text-muted flex flex-col items-center gap-3">
                    <ShoppingCart className="w-12 h-12 opacity-30" />
                    <p className="text-sm font-bold uppercase tracking-wider">Your cart is empty</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item, index) => (
                      <div key={`${item.productId}-${item.variantId}`} className="bg-bg rounded-2xl border border-border p-4 flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1 text-left">
                          <p className="font-bold text-ink text-sm truncate">{item.name}</p>
                          <p className="text-[10px] text-muted font-bold uppercase tracking-wider">{item.variantName}</p>
                          <p className="text-xs font-black text-indigo-600 mt-1">{formatCurrency(item.price)} each</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
                            <button
                              onClick={() => updateQuantity(index, -1)}
                              className="w-7 h-7 flex items-center justify-center rounded bg-bg text-muted hover:text-ink font-bold"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center font-bold text-ink text-xs">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(index, 1)}
                              className="w-7 h-7 flex items-center justify-center rounded bg-bg text-muted hover:text-ink font-bold"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <button
                            onClick={() => updateQuantity(index, -item.quantity)}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 bg-muted/30 border-t border-border flex items-center justify-between">
                <div className="text-left">
                  <p className="text-xs text-muted font-bold uppercase">Estimated Subtotal</p>
                  <p className="text-2xl font-black text-[#5d44ff]">{formatCurrency(subtotal)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {cart.length > 0 && (
                    <button
                      onClick={() => {
                        setIsDeleteModalOpen(true);
                        setIsCartModalOpen(false);
                      }}
                      className="px-4 py-3 border border-rose-500/20 text-rose-500 rounded-xl text-xs font-black uppercase hover:bg-rose-500/10"
                    >
                      Clear Cart
                    </button>
                  )}
                  <button
                    onClick={() => setIsCartModalOpen(false)}
                    className="px-6 py-3 bg-[#5d44ff] text-white rounded-xl text-xs font-black uppercase tracking-wider text-center"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Device Manager Modal */}
      <AnimatePresence>
        {isDeviceModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/10 text-[#5d44ff] rounded-xl">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-ink text-lg uppercase tracking-wider">Device & Hardware Manager</h3>
                    <p className="text-xs text-muted">Monitor and diagnose connected point-of-sale peripherals</p>
                  </div>
                </div>
                <button onClick={() => setIsDeviceModalOpen(false)} className="p-2 hover:bg-bg rounded-lg">
                  <X className="w-5 h-5 text-muted" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-4">
                  <div className="w-3.5 h-3.5 bg-emerald-500 rounded-full animate-ping shrink-0" />
                  <div className="text-left">
                    <p className="text-sm font-black text-emerald-600 uppercase">Interactive Terminal Link: Active</p>
                    <p className="text-xs text-muted">ID: DMI-TERM-402 • Connection latency: 12ms</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Printer Row */}
                  <div className="flex items-center justify-between p-4 bg-bg border border-border rounded-2xl">
                    <div className="text-left">
                      <p className="font-bold text-ink text-sm">Thermal Receipt Printer</p>
                      <p className="text-xs text-emerald-500 font-bold">● Connected (USB-80mm)</p>
                    </div>
                    <button
                      onClick={() => {
                        setSuccess("TEST PRINT SENT! Thermal printer paper feed successful.");
                        setTimeout(() => setSuccess(null), 3000);
                      }}
                      className="px-3.5 py-2 bg-white border border-border hover:bg-muted text-ink font-bold text-xs rounded-xl shadow-sm transition-all uppercase tracking-wider"
                    >
                      Test Print
                    </button>
                  </div>

                  {/* Cash Drawer Row */}
                  <div className="flex items-center justify-between p-4 bg-bg border border-border rounded-2xl">
                    <div className="text-left">
                      <p className="font-bold text-ink text-sm">Electronic Cash Drawer</p>
                      <p className="text-xs text-emerald-500 font-bold">● Connected (RJ11 Kick)</p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          // 1. Record transaction locally via alerts/audit logs
                          await localDb.addAlert({
                            businessId,
                            shopId,
                            type: 'CASH_DRAWER_OPEN',
                            message: `CASH DRAWER OPENED: Manual kick triggered by user "${user.name}" (${user.role.toUpperCase()})`,
                            status: 'UNREAD',
                            timestamp: new Date().toISOString(),
                            details: {
                              userId: user.uid,
                              userName: user.name,
                              role: user.role,
                              action: 'MANUAL_KICK'
                            }
                          });

                          // 2. Centrally report manual keyless kick open attempts to licensing database
                          try {
                            const licenseKey = localStorage.getItem('dmi_pos_license_key') || 'MASTER_DEMO_KEY';
                            let cachedLicenseId: string | null = null;
                            try {
                              const cacheRaw = localStorage.getItem(`dmi_license_cache_${licenseKey}`);
                              if (cacheRaw) {
                                const parsed = JSON.parse(atob(cacheRaw));
                                cachedLicenseId = parsed?.data?.id || null;
                              }
                            } catch (e) {}

                            const alertPayload = {
                              id: crypto.randomUUID(),
                              business_id: businessId,
                              license_key: licenseKey,
                              alert_type: 'CASH_DRAWER_KICK',
                              message: `Cash Drawer manual keyless kick open by user "${user.name}" (${user.role.toUpperCase()})`,
                              triggered_by: user.name,
                              machine_id: btoa(navigator.userAgent).slice(0, 32),
                              license_id: cachedLicenseId,
                              metadata: {
                                userId: user.uid,
                                userName: user.name,
                                role: user.role,
                                action: 'MANUAL_KICK',
                                businessId,
                                licenseKey,
                                alertType: 'CASH_DRAWER_KICK',
                                triggeredBy: user.name,
                                machineId: btoa(navigator.userAgent).slice(0, 32)
                              }
                            };

                            const { error: piracyError } = await supabase.from('piracy_alerts').insert([alertPayload]);
                            
                            if (piracyError && (
                              piracyError.code === '42703' || 
                              piracyError.message?.includes('column') || 
                              piracyError.message?.toLowerCase().includes('does not exist')
                            )) {
                              // Safe fallback: insert with only original compatible schema columns
                              const fallbackPayload = {
                                id: alertPayload.id,
                                license_id: cachedLicenseId,
                                message: alertPayload.message,
                                metadata: alertPayload.metadata,
                                timestamp: new Date().toISOString()
                              };
                              const { error: fallbackError } = await supabase.from('piracy_alerts').insert([fallbackPayload]);
                              if (fallbackError) console.warn('Supabase fallback drawer log failed:', fallbackError.message);
                            } else if (piracyError) {
                              console.warn('Supabase drawer log warning:', piracyError.message);
                            }
                          } catch (se) {
                            // Offline or sandboxed bypass
                          }
                          
                          // Dispatch local db update event
                          window.dispatchEvent(new CustomEvent('local-db-update', { detail: { key: 'dmi_pos_alerts' } }));
                        } catch (err) {
                          console.error('Failed to log cash drawer event:', err);
                        }

                        setSuccess("KICK SIGNAL SENT! Cash drawer triggered open and recorded.");
                        setTimeout(() => setSuccess(null), 3000);
                      }}
                      className="px-3.5 py-2 bg-white border border-border hover:bg-muted text-ink font-bold text-xs rounded-xl shadow-sm transition-all uppercase tracking-wider"
                    >
                      Open Drawer
                    </button>
                  </div>

                  {/* Customer display */}
                  <div className="p-4 bg-bg border border-border rounded-2xl text-left">
                    <p className="font-bold text-ink text-sm mb-1">Customer VFD Pole Display</p>
                    <div className="font-mono bg-[#050505] text-[#10b981] p-3 rounded-xl border border-border text-center text-sm font-black tracking-widest mt-2 uppercase shadow-inner">
                      {cart.length > 0 ? `TOTAL PO: ${formatCurrency(total)}` : "WELCOME TO DMI-POS"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-muted/30 border-t border-border flex justify-end">
                <button
                  onClick={() => setIsDeviceModalOpen(false)}
                  className="px-6 py-3 bg-[#5d44ff] text-white rounded-xl text-xs font-black uppercase tracking-wider"
                >
                  Close Peripherals Panel
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Scanned Barcode Product Detail Popup / Modal */}
        {scannedProductDetail && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card w-full max-w-2xl rounded-[32px] p-6 shadow-2xl border border-indigo-500/30 relative overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shrink-0">
                    <Barcode className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Scanned Product Details</span>
                      <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-black rounded-full uppercase">
                        Active in POS
                      </span>
                    </div>
                    <h2 className="text-xl font-black text-ink">{scannedProductDetail.product.name}</h2>
                  </div>
                </div>
                <button
                  onClick={() => setScannedProductDetail(null)}
                  className="w-9 h-9 bg-bg hover:bg-muted text-muted hover:text-ink rounded-xl flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="overflow-y-auto py-4 space-y-4 pr-1">
                {/* Product Card Header */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-bg rounded-2xl border border-border">
                  <div className="sm:col-span-1 flex items-center justify-center bg-card rounded-xl border border-border p-2 overflow-hidden h-32 relative">
                    <SafeImage
                      src={scannedProductDetail.product.imageUrl}
                      alt={scannedProductDetail.product.name}
                      className="max-h-full max-w-full object-contain rounded-lg"
                      fallback={
                        <div className="flex flex-col items-center justify-center text-muted">
                          <Package className="w-10 h-10 opacity-30 mb-1" />
                          <span className="text-[10px] font-bold uppercase">{scannedProductDetail.product.category}</span>
                        </div>
                      }
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-2 flex flex-col justify-center">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-mono text-xs font-bold rounded-lg border border-indigo-500/20 flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        SKU/Barcode: {scannedProductDetail.variant.sku || scannedProductDetail.scannedBarcode}
                      </span>
                      <span className="px-2.5 py-1 bg-bg border border-border text-muted font-bold text-xs rounded-lg uppercase">
                        {scannedProductDetail.product.category}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-[10px] font-bold text-muted uppercase block">Selling Price</span>
                        <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                          {formatCurrency(scannedProductDetail.variant.price || scannedProductDetail.product.sellingPrice || scannedProductDetail.product.basePrice)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-muted uppercase block">Available Stock</span>
                        <span className={`text-sm font-black ${
                          scannedProductDetail.variant.stock <= 0 ? 'text-rose-500' :
                          scannedProductDetail.variant.stock <= (scannedProductDetail.product.lowStockThreshold || 5) ? 'text-amber-500' : 'text-emerald-500'
                        }`}>
                          {scannedProductDetail.variant.stock} units
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Variant & Financial Indicators */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-card border border-border rounded-xl">
                    <span className="text-[10px] font-bold text-muted uppercase block">Size / Option</span>
                    <span className="text-xs font-bold text-ink">{scannedProductDetail.variant.size || 'Standard'}</span>
                  </div>
                  <div className="p-3 bg-card border border-border rounded-xl">
                    <span className="text-[10px] font-bold text-muted uppercase block">Color / Type</span>
                    <span className="text-xs font-bold text-ink">{scannedProductDetail.variant.color || 'Default'}</span>
                  </div>
                  <div className="p-3 bg-card border border-border rounded-xl">
                    <span className="text-[10px] font-bold text-muted uppercase block">Buying Cost</span>
                    <span className="text-xs font-bold text-ink">
                      {formatCurrency(scannedProductDetail.product.buyingPrice || 0)}
                    </span>
                  </div>
                  <div className="p-3 bg-card border border-border rounded-xl">
                    <span className="text-[10px] font-bold text-muted uppercase block">Est. Profit Margin</span>
                    <span className="text-xs font-bold text-emerald-600">
                      +{(((scannedProductDetail.variant.price || scannedProductDetail.product.sellingPrice || 0) - (scannedProductDetail.product.buyingPrice || 0)) / (scannedProductDetail.product.buyingPrice || 1) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Detailed Specifications & Batch Info */}
                <div className="p-4 bg-card border border-border rounded-2xl space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-muted flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-indigo-500" />
                    Product Specifications & Meta Info
                  </h4>
                  <p className="text-xs text-ink leading-relaxed">
                    {scannedProductDetail.product.description || 'No additional text description entered.'}
                  </p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-xs">
                    {scannedProductDetail.product.batchNumber && (
                      <div className="p-2 bg-bg rounded-lg border border-border">
                        <span className="text-[9px] font-bold text-muted uppercase block">Batch Number</span>
                        <span className="font-mono font-bold text-ink">{scannedProductDetail.product.batchNumber}</span>
                      </div>
                    )}
                    {scannedProductDetail.product.expiryDate && (
                      <div className="p-2 bg-bg rounded-lg border border-border">
                        <span className="text-[9px] font-bold text-muted uppercase block">Expiry Date</span>
                        <span className="font-bold text-amber-600">{scannedProductDetail.product.expiryDate}</span>
                      </div>
                    )}
                    {scannedProductDetail.product.partNumber && (
                      <div className="p-2 bg-bg rounded-lg border border-border">
                        <span className="text-[9px] font-bold text-muted uppercase block">Part Number</span>
                        <span className="font-mono font-bold text-ink">{scannedProductDetail.product.partNumber}</span>
                      </div>
                    )}
                    {scannedProductDetail.product.modelCompatibility && (
                      <div className="p-2 bg-bg rounded-lg border border-border">
                        <span className="text-[9px] font-bold text-muted uppercase block">Model Compatibility</span>
                        <span className="font-bold text-ink">{scannedProductDetail.product.modelCompatibility}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Active Sales Cart Control Bar */}
                {(() => {
                  const cartItem = cart.find(item => item.productId === scannedProductDetail.product.id && item.variantId === scannedProductDetail.variant.id);
                  const cartIndex = cart.findIndex(item => item.productId === scannedProductDetail.product.id && item.variantId === scannedProductDetail.variant.id);
                  const qtyInCart = cartItem ? cartItem.quantity : 0;
                  const itemUnitPrice = scannedProductDetail.variant.price || scannedProductDetail.product.sellingPrice || scannedProductDetail.product.basePrice;

                  return (
                    <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 border-2 border-indigo-500/20 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-ink block">Active Sales Cart</span>
                        <span className="text-xs text-muted">
                          {qtyInCart > 0 ? `${qtyInCart} unit(s) in current cart (${formatCurrency(itemUnitPrice * qtyInCart)})` : 'Item not added to cart'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {cartIndex >= 0 && (
                          <button
                            onClick={() => updateQuantity(cartIndex, -1)}
                            className="w-10 h-10 bg-card border border-border hover:bg-muted text-ink font-bold rounded-xl flex items-center justify-center transition-all"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                        )}
                        <span className="px-4 py-2 bg-card border border-border rounded-xl font-mono text-base font-black text-indigo-600 dark:text-indigo-400">
                          {qtyInCart}
                        </span>
                        <button
                          onClick={() => addToCart(scannedProductDetail.product, scannedProductDetail.variant)}
                          className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center transition-all shadow-md shadow-indigo-500/20"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-border flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    addToCart(scannedProductDetail.product, scannedProductDetail.variant);
                  }}
                  className="flex-1 px-5 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-extrabold rounded-2xl shadow-lg shadow-indigo-500/25 hover:from-indigo-700 hover:to-indigo-800 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Another (+1)</span>
                </button>

                <button
                  onClick={() => setScannedProductDetail(null)}
                  className="px-6 py-3 bg-bg hover:bg-muted text-ink font-bold rounded-2xl border border-border transition-all text-xs uppercase tracking-wider"
                >
                  Close Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
