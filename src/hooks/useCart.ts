import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { CartItem, LocalCartItem, Product } from '../types/database.types';

const CART_STORAGE_KEY = 'tech_shop_cart';

interface CartItemWithProduct extends CartItem {
  products: Product;
}

interface UseCartReturn {
  items: CartItemWithProduct[];
  loading: boolean;
  error: string | null;
  addToCart: (productId: string, quantity: number) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  totalItems: number;
  totalPrice: number;
}

export const useCart = (): UseCartReturn => {
  const [items, setItems] = useState<CartItemWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Get cart from localStorage
  const getLocalCart = (): LocalCartItem[] => {
    try {
      const cart = localStorage.getItem(CART_STORAGE_KEY);
      return cart ? JSON.parse(cart) : [];
    } catch (err) {
      console.error('Error reading cart from localStorage:', err);
      return [];
    }
  };

  // Save cart to localStorage
  const saveLocalCart = (cart: LocalCartItem[]) => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (err) {
      console.error('Error saving cart to localStorage:', err);
    }
  };

  // Clear localStorage cart
  const clearLocalCart = () => {
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch (err) {
      console.error('Error clearing cart from localStorage:', err);
    }
  };

  // Fetch cart items from database with product details
  const fetchCartFromDB = async (user_id: string): Promise<CartItemWithProduct[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('cart_items')
        .select(`
          *,
          products (
            id,
            name,
            slug,
            price,
            stock_quantity,
            is_active,
            product_images (
              thumbnail_url,
              display_order
            )
          )
        `)
        .eq('user_id', user_id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching cart from database:', fetchError);
        throw fetchError;
      }

      return (data || []) as CartItemWithProduct[];
    } catch (err) {
      console.error('Error in fetchCartFromDB:', err);
      throw err;
    }
  };

  // Fetch product details for local cart items
  const fetchProductsForLocalCart = async (localCart: LocalCartItem[]): Promise<CartItemWithProduct[]> => {
    if (localCart.length === 0) return [];

    try {
      const productIds = localCart.map(item => item.product_id);
      const { data: products, error: fetchError } = await supabase
        .from('products')
        .select(`
          *,
          product_images (
            thumbnail_url,
            display_order
          )
        `)
        .in('id', productIds)
        .eq('is_active', true);

      if (fetchError) {
        console.error('Error fetching products:', fetchError);
        throw fetchError;
      }

      // Map local cart items with product details
      return localCart
        .map(cartItem => {
          const product = products?.find(p => p.id === cartItem.product_id);
          if (!product) return null;

          return {
            id: '', // Local items don't have DB id
            user_id: undefined,
            session_id: undefined,
            product_id: cartItem.product_id,
            quantity: cartItem.quantity,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            products: product,
          } as CartItemWithProduct;
        })
        .filter((item): item is CartItemWithProduct => item !== null);
    } catch (err) {
      console.error('Error in fetchProductsForLocalCart:', err);
      throw err;
    }
  };

  // Merge localStorage cart with database cart on login
  const mergeCartsOnLogin = async (user_id: string) => {
    try {
      const localCart = getLocalCart();
      if (localCart.length === 0) {
        // No local cart, just fetch from DB
        const dbCart = await fetchCartFromDB(user_id);
        setItems(dbCart);
        return;
      }

      // Fetch existing cart from database
      const dbCart = await fetchCartFromDB(user_id);

      // Merge logic: Sum quantities for same products
      const mergedItems = new Map<string, number>();

      // Add database cart items
      dbCart.forEach(item => {
        mergedItems.set(item.product_id, item.quantity);
      });

      // Add/sum local cart items
      localCart.forEach(item => {
        const existingQuantity = mergedItems.get(item.product_id) || 0;
        mergedItems.set(item.product_id, existingQuantity + item.quantity);
      });

      // Update database with merged cart
      for (const [product_id, quantity] of mergedItems.entries()) {
        const { error: upsertError } = await supabase
          .from('cart_items')
          .upsert({
            user_id,
            product_id,
            quantity,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,product_id',
          });

        if (upsertError) {
          console.error('Error upserting cart item:', upsertError);
        }
      }

      // Clear localStorage after successful merge
      clearLocalCart();

      // Fetch updated cart from database
      const updatedCart = await fetchCartFromDB(user_id);
      setItems(updatedCart);
    } catch (err) {
      console.error('Error in mergeCartsOnLogin:', err);
      setError('Błąd podczas synchronizacji koszyka');
    }
  };

  // Load cart on mount and auth changes
  useEffect(() => {
    let mounted = true;

    const loadCart = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id || null;
        setUserId(currentUserId);

        if (currentUserId) {
          // User is logged in - use database cart
          const dbCart = await fetchCartFromDB(currentUserId);
          if (mounted) {
            setItems(dbCart);
          }
        } else {
          // User is not logged in - use localStorage cart
          const localCart = getLocalCart();
          const cartWithProducts = await fetchProductsForLocalCart(localCart);
          if (mounted) {
            setItems(cartWithProducts);
          }
        }
      } catch (err) {
        console.error('Error loading cart:', err);
        if (mounted) {
          setError('Błąd podczas wczytywania koszyka');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadCart();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const newUserId = session?.user?.id || null;
      
      if (event === 'SIGNED_IN' && newUserId) {
        // User just logged in - merge carts
        setUserId(newUserId);
        await mergeCartsOnLogin(newUserId);
      } else if (event === 'SIGNED_OUT') {
        // User logged out - switch to localStorage cart
        setUserId(null);
        const localCart = getLocalCart();
        const cartWithProducts = await fetchProductsForLocalCart(localCart);
        if (mounted) {
          setItems(cartWithProducts);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Add item to cart (or increase quantity if exists)
  const addToCart = useCallback(async (productId: string, quantity: number) => {
    try {
      setError(null);

      if (quantity <= 0) {
        setError('Ilość musi być większa od 0');
        return;
      }

      if (userId) {
        // User is logged in - update database
        // Check if item already exists in cart
        const { data: existingItem } = await supabase
          .from('cart_items')
          .select('quantity')
          .eq('user_id', userId)
          .eq('product_id', productId)
          .single();

        const newQuantity = existingItem ? existingItem.quantity + quantity : quantity;

        const { error: upsertError } = await supabase
          .from('cart_items')
          .upsert({
            user_id: userId,
            product_id: productId,
            quantity: newQuantity,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,product_id',
          });

        if (upsertError) {
          console.error('Error adding to cart (DB):', upsertError);
          setError('Błąd podczas dodawania do koszyka');
          return;
        }

        // Refresh cart from database
        const updatedCart = await fetchCartFromDB(userId);
        setItems(updatedCart);
      } else {
        // User is not logged in - update localStorage
        const localCart = getLocalCart();
        const existingItemIndex = localCart.findIndex(item => item.product_id === productId);

        if (existingItemIndex >= 0) {
          // Item exists - increase quantity
          localCart[existingItemIndex].quantity += quantity;
        } else {
          // New item - add to cart
          localCart.push({ product_id: productId, quantity });
        }

        saveLocalCart(localCart);

        // Refresh displayed cart
        const cartWithProducts = await fetchProductsForLocalCart(localCart);
        setItems(cartWithProducts);
      }
    } catch (err) {
      console.error('Error in addToCart:', err);
      setError('Błąd podczas dodawania do koszyka');
    }
  }, [userId]);

  // Update item quantity
  const updateQuantity = useCallback(async (productId: string, quantity: number) => {
    try {
      setError(null);

      if (quantity <= 0) {
        // If quantity is 0 or less, remove the item
        await removeFromCart(productId);
        return;
      }

      if (userId) {
        // User is logged in - update database
        const { error: updateError } = await supabase
          .from('cart_items')
          .update({ 
            quantity,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('product_id', productId);

        if (updateError) {
          console.error('Error updating quantity (DB):', updateError);
          setError('Błąd podczas aktualizacji ilości');
          return;
        }

        // Refresh cart from database
        const updatedCart = await fetchCartFromDB(userId);
        setItems(updatedCart);
      } else {
        // User is not logged in - update localStorage
        const localCart = getLocalCart();
        const itemIndex = localCart.findIndex(item => item.product_id === productId);

        if (itemIndex >= 0) {
          localCart[itemIndex].quantity = quantity;
          saveLocalCart(localCart);

          // Refresh displayed cart
          const cartWithProducts = await fetchProductsForLocalCart(localCart);
          setItems(cartWithProducts);
        }
      }
    } catch (err) {
      console.error('Error in updateQuantity:', err);
      setError('Błąd podczas aktualizacji ilości');
    }
  }, [userId]);

  // Remove item from cart
  const removeFromCart = useCallback(async (productId: string) => {
    try {
      setError(null);

      if (userId) {
        // User is logged in - remove from database
        const { error: deleteError } = await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', userId)
          .eq('product_id', productId);

        if (deleteError) {
          console.error('Error removing from cart (DB):', deleteError);
          setError('Błąd podczas usuwania z koszyka');
          return;
        }

        // Refresh cart from database
        const updatedCart = await fetchCartFromDB(userId);
        setItems(updatedCart);
      } else {
        // User is not logged in - remove from localStorage
        const localCart = getLocalCart();
        const filteredCart = localCart.filter(item => item.product_id !== productId);
        saveLocalCart(filteredCart);

        // Refresh displayed cart
        const cartWithProducts = await fetchProductsForLocalCart(filteredCart);
        setItems(cartWithProducts);
      }
    } catch (err) {
      console.error('Error in removeFromCart:', err);
      setError('Błąd podczas usuwania z koszyka');
    }
  }, [userId]);

  // Clear entire cart
  const clearCart = useCallback(async () => {
    try {
      setError(null);

      if (userId) {
        // User is logged in - clear database cart
        const { error: deleteError } = await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', userId);

        if (deleteError) {
          console.error('Error clearing cart (DB):', deleteError);
          setError('Błąd podczas czyszczenia koszyka');
          return;
        }
      } else {
        // User is not logged in - clear localStorage
        clearLocalCart();
      }

      setItems([]);
    } catch (err) {
      console.error('Error in clearCart:', err);
      setError('Błąd podczas czyszczenia koszyka');
    }
  }, [userId]);

  // Calculate total items count
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  // Calculate total price
  const totalPrice = items.reduce((sum, item) => {
    return sum + (item.products?.price || 0) * item.quantity;
  }, 0);

  return {
    items,
    loading,
    error,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    totalItems,
    totalPrice,
  };
};
