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
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { Receipt } from './Receipt';
import { motion, AnimatePresence } from 'framer-motion';
import { BarcodeScanner } from './BarcodeScanner';
import { useHardwareScanner } from '../hooks/useHardwareScanner';
import { PaymentMethod } from '../types';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { SafeImage } from './SafeImage';

import { getLocal, setLocal, removeLocal } from '../services/localDb';

interface POSProps {
  user: UserProfile;
  businessId: string;
  shopId: string;
}

export const POS: React.FC<POSProps> = ({ user, businessId, shopId }) => {
  const [saleNumber, setSaleNumber] = useState('');

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

  // Poll for M-Pesa transaction status
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    if (checkoutRequestId && mpesaStatus === 'WAITING') {
      const checkStatus = async () => {
        try {
          const apiHost = window.location.origin;
          const response = await fetch(`${apiHost}/api/mpesa/status/${checkoutRequestId}`);
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
    window.addEventListener('business-update', handleBusinessUpdate);
    const interval = setInterval(fetchData, 30000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('business-update', handleBusinessUpdate);
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

  const handleBarcodeScan = (barcode: string) => {
    const product = products.find(p => p.variants.some(v => v.sku === barcode));
    if (product) {
      const variant = product.variants.find(v => v.sku === barcode);
      if (variant) {
        addToCart(product, variant);
        setSearchTerm(''); // Clear search if a scan happens
        setSuccess(`Added to cart: ${product.name}`);
        setTimeout(() => setSuccess(null), 2000);
        
        // Optional: play scan sound if we had an asset, for now just visual feedback
      }
    } else {
      // If we are in POS and a scan happens but no product found
      setError(`No product found for barcode: ${barcode}`);
      setTimeout(() => setError(null), 3000);
    }
  };

  useHardwareScanner({ onScan: handleBarcodeScan });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
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
    window.focus();
    document.body.classList.add('printing-receipt');
    
    setTimeout(() => {
      try {
        window.print();
        document.body.classList.remove('printing-receipt');
        if (autoClose) {
          setTimeout(() => {
            setShowReceipt(false);
            setIsAutoPrinting(false);
          }, 500);
        }
      } catch (err) {
        console.error('Print failed:', err);
        document.body.classList.remove('printing-receipt');
        const printContent = document.getElementById('print-receipt');
        if (printContent) {
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write('<html><head><title>Print Receipt</title>');
            const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
            styles.forEach(style => {
              printWindow.document.write(style.outerHTML);
            });
            printWindow.document.write('</head><body>');
            printWindow.document.write(printContent.innerHTML);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
              printWindow.print();
              printWindow.close();
            }, 250);
          }
        }
      }
    }, 100);
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

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountAmount = discount 
    ? (discount.type === 'percentage' ? (subtotal * discount.value / 100) : discount.value)
    : 0;
  const total = Math.max(0, subtotal - discountAmount);

  const handleCheckout = async () => {
    if (cart.length === 0 || isProcessing) return;
    
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
    <div className="flex flex-col gap-4 h-[calc(100vh-100px)]">
      {/* Main POS View - Full Screen Current Order */}
      <div className="flex-1 flex flex-col bg-[#f8f9fc] rounded-2xl shadow-sm overflow-hidden h-full relative border border-slate-200">
        <div className="p-4 sm:px-6 sm:py-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white">
          <div className="flex items-center gap-6 flex-1">
            <h3 className="text-lg font-black text-slate-800 whitespace-nowrap uppercase tracking-tighter">SALE NO. #{saleNumber}</h3>
            
            {/* Integrated Search bar */}
            <div className="relative flex-1 max-w-2xl group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400 w-5 h-5" />
              <input
                type="text"
                placeholder="SEARCH PRODUCTS OR SCAN..."
                className="w-full pl-12 pr-4 py-3 bg-white border-2 border-indigo-400 text-slate-800 rounded-xl shadow-sm focus:ring-0 transition-all outline-none text-sm font-bold placeholder:text-slate-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchTerm) {
                    handleBarcodeScan(searchTerm);
                  }
                }}
                autoFocus
              />
              
              {/* Search Results Overlay / Product Browser */}
              {(searchTerm || !cart.length) && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-white border-2 border-slate-200 rounded-2xl shadow-2xl z-[100] max-h-[70vh] overflow-y-auto animate-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                      {searchTerm ? `Search Results (${filteredProducts.length})` : 'Quick Add Products'}
                    </p>
                    {searchTerm && (
                      <button onClick={() => setSearchTerm('')} className="text-xs font-bold text-indigo-600 hover:underline">Clear Search</button>
                    )}
                  </div>
                  
                  {filteredProducts.length === 0 ? (
                    <div className="p-12 text-center">
                      <Package className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-400 font-bold">No products found matching "{searchTerm}"</p>
                    </div>
                  ) : (
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredProducts.slice(0, 24).map(product => {
                        const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
                        return (
                          <button
                            key={product.id}
                            onClick={() => {
                              if (product.variants.length === 1) {
                                addToCart(product, product.variants[0]);
                                if (searchTerm) setSearchTerm('');
                              } else {
                                setSelectedProduct(product);
                              }
                            }}
                            className="flex flex-col p-4 bg-white border-2 border-slate-100 hover:border-indigo-500 rounded-2xl transition-all text-left group hover:shadow-lg active:scale-95"
                          >
                            <div className="flex items-center gap-4 mb-3">
                              <div className="w-16 h-16 bg-slate-50 rounded-xl border-2 border-slate-100 flex items-center justify-center overflow-hidden shrink-0 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                                <SafeImage src={product.imageUrl} alt={product.name} className="w-full h-full object-contain" fallback={<Package className="w-8 h-8 text-slate-200" />} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-black text-ink text-base leading-tight truncate">{product.name}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{product.brand || product.category}</p>
                              </div>
                            </div>
                            <div className="mt-auto flex items-center justify-between pt-3 border-t border-slate-50">
                              <p className="font-black text-indigo-600 text-lg">{formatCurrency(product.type === 'SERVICE' ? (product.sellingPrice || product.basePrice || 0) : (product.sellingPrice || product.basePrice || 0))}</p>
                              <div className={`px-2 py-1 rounded text-[9px] font-black uppercase ${product.type === 'SERVICE' ? 'bg-indigo-50 text-indigo-600' : (totalStock <= 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500')}`}>
                                {product.type === 'SERVICE' ? 'Service' : (totalStock <= 0 ? 'Out of Stock' : `Stock: ${totalStock}`)}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <button
              onClick={() => setIsScannerOpen(true)}
              className="px-4 py-2 bg-[#5d44ff] text-white rounded-lg shadow-sm hover:opacity-90 transition-all flex items-center gap-2"
            >
              <Camera className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-widest">SCAN</span>
            </button>
            {lastSale && (
              <button
                onClick={() => setShowReceipt(true)}
                className="px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-widest">LAST RECEIPT</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 mt-4 md:mt-0">
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 text-[10px] text-slate-500 bg-white px-3 py-2 rounded-lg border border-slate-200 font-extrabold uppercase shadow-sm">
                <ShoppingCart className="w-3.5 h-3.5" />
                {cart.reduce((sum, item) => sum + item.quantity, 0)} UNITS
              </button>
              <span className={`flex items-center gap-2 text-[10px] px-3 py-2 rounded-lg border font-extrabold uppercase ${isOnline ? 'bg-[#e7fdf1] text-[#22c55e] border-[#bbf7d0]' : 'bg-rose-50 text-rose-500 border-rose-100'}`}>
                {isOnline ? 'STATION LIVE' : 'STATION OFFLINE'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="p-2 bg-white text-slate-400 rounded-lg transition-all border border-slate-200 hover:border-slate-300"
              >
                <Smartphone className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setIsDeleteModalOpen(true)}
                className="p-2 bg-white text-rose-400 rounded-lg hover:bg-rose-50 transition-all border border-rose-100"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>


        {/* Customer Selection Scaled */}
        <div className="px-4 py-3 bg-[#f8f9fc]">
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-in zoom-in-95">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-indigo-600 border border-slate-100">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-base font-black text-slate-800">{selectedCustomer.name}</p>
                  <div className="flex items-center gap-2 text-xs text-indigo-500 font-black uppercase tracking-wider">
                    <Award className="w-3.5 h-3.5" />
                    <span>{selectedCustomer.loyaltyPoints} REWARDS POINTS</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCustomer(null)}
                className="p-2 hover:bg-slate-50 rounded-lg transition-all text-rose-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowCustomerSearch(!showCustomerSearch)}
                className="w-full flex items-center justify-between px-5 py-3 bg-[#f1f3f9] border border-slate-200 rounded-xl text-xs font-black text-slate-500 hover:border-slate-300 transition-all uppercase tracking-widest"
              >
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4" />
                  <span>ATTACH CUSTOMER TO SALE</span>
                </div>
                <ChevronRight className={`w-4 h-4 transition-transform ${showCustomerSearch ? 'rotate-90' : ''}`} />
              </button>

              <AnimatePresence>
                {showCustomerSearch && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    <div className="p-3 border-b border-slate-100">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search customers..."
                          className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                          value={customerSearchTerm}
                          onChange={(e) => setCustomerSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
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
                            className="w-full px-4 py-3 text-left hover:bg-indigo-50 flex items-center justify-between group transition-colors"
                          >
                            <div>
                              <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600">{customer.name}</p>
                              <p className="text-[10px] text-slate-500">{customer.phone}</p>
                            </div>
                            <Award className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                          </button>
                        ))}
                      {customers.length === 0 && (
                        <div className="p-4 text-center text-xs text-slate-400">
                          No customers found
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4 min-h-[200px]">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 opacity-50">
              <ShoppingCart className="w-16 h-16" />
              <p className="text-sm font-black uppercase tracking-widest text-center">Empty Cart<br/>Select items to begin sale</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 content-start">
              {cart.map((item, index) => (
                <div key={`${item.productId}-${item.variantId}`} className="bg-white rounded-2xl border border-slate-100 p-4 relative group hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className="pr-10">
                      <h4 className="font-bold text-slate-800 text-sm leading-tight">{item.name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">{item.variantName}</p>
                    </div>
                    <button 
                      onClick={() => updateQuantity(index, -item.quantity)}
                      className="text-slate-200 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-lg p-1">
                      <button 
                        onClick={() => updateQuantity(index, -1)}
                        className="w-7 h-7 flex items-center justify-center rounded bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 transition-all font-bold"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <div 
                        className="w-8 text-center font-bold text-slate-800 text-xs cursor-pointer"
                        onClick={() => setEditingQuantity({ index, quantity: item.quantity.toString() })}
                      >
                        {item.quantity}
                      </div>
                      <button 
                        onClick={() => updateQuantity(index, 1)}
                        className="w-7 h-7 flex items-center justify-center rounded bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 transition-all font-bold"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    
                    <div 
                      className="text-right cursor-pointer"
                      onClick={() => setOverridePrice({ index, price: item.price.toString() })}
                    >
                      <p className="font-extrabold text-[#5d44ff] text-base tracking-tight">KSH{item.price.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Checkout Panel Integrated */}
        <div className="p-4 sm:p-6 bg-[#f8f9fc] border-t border-slate-200 mt-auto relative">
          {/* Absolute floating notifications */}
          <AnimatePresence>
            {(success || error) && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={`absolute left-1/2 -translate-x-1/2 -top-12 px-6 py-2.5 rounded-full shadow-xl border backdrop-blur-md flex items-center gap-3 whitespace-nowrap z-50 ${success ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-rose-600 border-rose-400 text-white'}`}
              >
                {success ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                <span className="text-xs font-black uppercase tracking-widest">{success || error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col xl:flex-row gap-6 max-w-full">
            {/* Payment Methods */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 w-full xl:w-auto">
              {[
                { id: 'CASH', icon: <Banknote className="w-6 h-6" />, label: 'CASH' },
                { id: 'MPESA', icon: <Smartphone className="w-6 h-6" />, label: 'MPESA' },
                { id: 'CARD', icon: <CreditCard className="w-6 h-6" />, label: 'CARD' },
                { id: 'DEBT', icon: <Wallet className="w-6 h-6" />, label: 'DEBT' },
                { id: 'DISC', icon: <Tag className="w-6 h-6" />, label: 'DISC.' }
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
                    className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all border-2 h-20 w-full ${
                      isDisc ? 'border-dashed border-slate-300 text-slate-400 bg-white hover:border-indigo-400 hover:text-indigo-400' :
                      isActive ? 'bg-[#5d44ff] text-white border-[#5d44ff] shadow-lg scale-105 z-10' : 
                      'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {method.icon}
                    <span className="text-[10px] font-black mt-2 tracking-widest">{method.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick Amount / RCV */}
            <div className="flex-1 flex flex-col md:flex-row items-center gap-4 bg-[#e9edff] p-3 rounded-2xl border border-indigo-100 flex-wrap lg:flex-nowrap min-h-[100px]">
              {showDiscountInput ? (
                <div className="flex-1 flex items-center gap-3 w-full">
                  <input
                    type="number"
                    placeholder="Discount Value"
                    className="flex-1 px-4 py-3 bg-white border-2 border-indigo-200 rounded-xl text-lg font-black text-indigo-600 outline-none"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    autoFocus
                  />
                  <div className="flex border-2 border-indigo-200 rounded-xl overflow-hidden bg-white">
                    {['percentage', 'fixed'].map((type) => (
                      <button key={type} onClick={() => setDiscountType(type as any)} className={`px-4 py-3 text-xs font-black ${discountType === type ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>{type === 'percentage' ? '%' : 'KSh'}</button>
                    ))}
                  </div>
                  <button onClick={() => {
                    const val = parseFloat(discountValue);
                    if (!isNaN(val) && val > 0) {
                      setDiscount({ type: discountType as any, value: val });
                      setShowDiscountInput(false);
                      setDiscountValue('');
                    }
                  }} className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg">APPLY</button>
                  <button onClick={() => setShowDiscountInput(false)} className="p-3 text-slate-400"><X className="w-5 h-5"/></button>
                </div>
              ) : paymentMethod === 'MPESA' ? (
                <div className="flex-1 flex flex-col md:flex-row items-center gap-3 w-full">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
                    <div className="relative">
                      <div className="absolute left-3 top-2 text-[10px] font-black text-indigo-400 uppercase tracking-tighter">M-Pesa Phone Number</div>
                      <input
                        type="tel"
                        placeholder="07xx xxx xxx"
                        className="w-full bg-white border-2 border-indigo-200 rounded-xl px-3 pt-5 pb-2 text-indigo-600 font-extrabold text-lg outline-none focus:border-indigo-400"
                        value={mpesaPhone}
                        onChange={(e) => setMpesaPhone(e.target.value)}
                        disabled={mpesaStatus === 'WAITING' || isStkLoading}
                      />
                    </div>
                    <div className="relative">
                      <div className="absolute left-3 top-2 text-[10px] font-black text-indigo-400 uppercase tracking-tighter">Transaction Ref (Optional)</div>
                      <input
                        type="text"
                        placeholder="M-Pesa Reference"
                        className="w-full bg-white border-2 border-indigo-200 rounded-xl px-3 pt-5 pb-2 text-indigo-600 font-extrabold text-lg outline-none focus:border-indigo-400"
                        value={mpesaConfirmation || ''}
                        onChange={(e) => setMpesaConfirmation(e.target.value)}
                        disabled={mpesaStatus === 'WAITING' || isStkLoading}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* STK Push Trigger */}
                    <button 
                      onClick={triggerStkPush}
                      disabled={mpesaStatus === 'WAITING' || isStkLoading || mpesaStatus === 'CONFIRMED'}
                      className={`px-8 py-4 rounded-xl text-xs font-black shadow-lg transition-all flex items-center gap-2 ${
                        mpesaStatus === 'CONFIRMED' ? 'bg-emerald-600 text-white' : 
                        mpesaStatus === 'WAITING' ? 'bg-amber-500 text-white' :
                        'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {isStkLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>SENDING PROMPT...</span>
                        </>
                      ) : mpesaStatus === 'WAITING' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>WAITING FOR PIN...</span>
                        </>
                      ) : mpesaStatus === 'CONFIRMED' ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>PAID</span>
                        </>
                      ) : (
                        <>
                          <Smartphone className="w-4 h-4" />
                          <span>SEND PROMPT</span>
                        </>
                      )}
                    </button>

                    {/* Manual Confirm / Fallback */}
                    {mpesaStatus !== 'CONFIRMED' && (
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
                        className="px-4 py-4 bg-white border-2 border-slate-200 rounded-xl text-slate-400 font-black text-xs hover:border-indigo-400 hover:text-indigo-400 transition-all uppercase whitespace-nowrap"
                      >
                        MANUAL
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative w-full md:w-32">
                    <div className="absolute left-2 top-2 text-[10px] font-black text-indigo-400 uppercase tracking-tighter">RCV</div>
                    <input
                      type="number"
                      placeholder="0.00"
                      className="w-full bg-white border-2 border-indigo-200 rounded-xl px-2 pt-5 pb-2 text-indigo-600 font-extrabold text-lg outline-none focus:border-indigo-400 text-center"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                    />
                  </div>
                  
                  {cashAmount && parseFloat(cashAmount) >= total && (
                    <div className="bg-emerald-500 px-4 py-2 rounded-xl border border-emerald-400 text-white flex flex-col items-center justify-center min-w-[120px] animate-in zoom-in-95">
                      <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">CHANGE DUE</p>
                      <p className="text-xl font-black">{formatCurrency(parseFloat(cashAmount) - total)}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {[100, 200, 500, 1000].map(amt => (
                      <button
                        key={amt}
                        onClick={() => setCashAmount((prev) => (parseFloat(prev || '0') + amt).toString())}
                        className="px-4 py-3 bg-white border border-indigo-100 rounded-xl text-indigo-600 font-black text-xs hover:bg-slate-50 transition-all shadow-sm"
                      >
                        + {amt}
                      </button>
                    ))}
                    <button
                      onClick={() => setCashAmount('')}
                      className="px-4 py-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-500 font-black text-xs hover:bg-rose-100 transition-all uppercase tracking-widest"
                    >
                      CLR
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Total & Action */}
            <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm w-full xl:w-auto min-w-[320px]">
              <div className="flex-1 text-right pr-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">PAYABLE TOTAL</p>
                <p className="text-3xl font-black text-[#5d44ff] tracking-tight">{formatCurrency(total)}</p>
              </div>
              <button
                disabled={cart.length === 0 || isProcessing}
                onClick={handleCheckout}
                className="flex flex-col items-center justify-center gap-1 bg-[#5d44ff] text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 h-20 min-w-[160px]"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingCart className="w-5 h-5" />}
                <span className="text-xs">FINISH SALE</span>
              </button>
            </div>
          </div>
        </div>

      </div>

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
    </div>
  );
};
