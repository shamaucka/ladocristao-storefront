import { atom, computed } from 'nanostores';
import { persistentAtom } from '@nanostores/persistent';

export interface CartItem {
    id: string;
    name: string;
    price: number;
    image: string;
    quantity: number;
    category?: string;
    discount?: number;
    stock?: number;
}

export const isCartOpen = atom(false);

// Persist cart items in localStorage
export const cartItems = persistentAtom<CartItem[]>('cart_items', [], {
    encode: JSON.stringify,
    decode: JSON.parse,
});

// Persist stock overrides to simulate stock reduction
export const stockOverrides = persistentAtom<Record<string, number>>('stock_overrides', {}, {
    encode: JSON.stringify,
    decode: JSON.parse,
});

export function getEffectiveStock(productId: string, initialStock: number) {
    const overrides = stockOverrides.get();
    return productId in overrides ? overrides[productId] : initialStock;
}

export function toggleCart() {
    isCartOpen.set(!isCartOpen.get());
}

export function openCart() {
    isCartOpen.set(true);
}

export function closeCart() {
    isCartOpen.set(false);
}

export function addToCart(product: Omit<CartItem, 'quantity'>, qty: number = 1) {
    const items = cartItems.get();
    const currentStock = getEffectiveStock(product.id, product.stock || 0);
    const existingItem = items.find((item) => item.id === product.id);

    if (existingItem) {
        const newQuantity = existingItem.quantity + qty;

        // Stock limit check
        if (newQuantity > currentStock) {
            return { success: false, message: `Apenas ${currentStock} unidades disponiveis` };
        }

        cartItems.set(
            items.map((item) =>
                item.id === product.id
                    ? { ...item, quantity: Math.max(0, newQuantity) }
                    : item
            ).filter(item => item.quantity > 0)
        );
    } else {
        if (qty > 0) {
            // Stock limit check for new item
            if (qty > currentStock) {
                return { success: false, message: `Apenas ${currentStock} unidades disponiveis` };
            }
            cartItems.set([...items, { ...product, quantity: qty, stock: currentStock }]);
        }
    }
    return { success: true, message: `${product.name} adicionado ao carrinho` };
}

export function removeFromCart(productId: string) {
    cartItems.set(cartItems.get().filter((item) => item.id !== productId));
}

export function updateQuantity(productId: string, qty: number) {
    const items = cartItems.get();
    const item = items.find(i => i.id === productId);

    if (item) {
        const currentStock = getEffectiveStock(productId, item.stock || 0);
        if (qty > currentStock) {
            return { success: false, message: `Apenas ${currentStock} unidades disponiveis` };
        }

        cartItems.set(
            items.map((item) =>
                item.id === productId ? { ...item, quantity: Math.max(0, qty) } : item
            ).filter(item => item.quantity > 0)
        );
        return { success: true };
    }
    return { success: false, message: "Item nao encontrado" };
}

export function clearCart() {
    cartItems.set([]);
}

export function completePurchase() {
    const items = cartItems.get();
    const overrides = { ...stockOverrides.get() };

    items.forEach(item => {
        const currentStock = getEffectiveStock(item.id, item.stock || 0);
        overrides[item.id] = Math.max(0, currentStock - item.quantity);
    });

    stockOverrides.set(overrides);
    clearCart();
    return { success: true };
}

// Promoção: 2 ou mais quadros = R$75 cada (ao invés de R$97)
const PROMO_MIN_ITEMS = 2;
const PROMO_PRICE = 75;

export function isPromoActive(items: CartItem[]): boolean {
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);
    return totalQty >= PROMO_MIN_ITEMS;
}

export const totalPrice = computed(cartItems, (items) => {
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);
    const promo = totalQty >= PROMO_MIN_ITEMS;

    return items.reduce((total, item) => {
        const basePrice = promo ? PROMO_PRICE : item.price;
        const itemPrice = basePrice * (1 - (item.discount || 0) / 100);
        return total + itemPrice * item.quantity;
    }, 0);
});

export const totalSavings = computed(cartItems, (items) => {
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);
    const promo = totalQty >= PROMO_MIN_ITEMS;

    return items.reduce((total, item) => {
        // Economia da promoção (diferença entre preço original e promo)
        const promoDiff = promo ? (item.price - PROMO_PRICE) * item.quantity : 0;
        // Economia do desconto individual
        const discountDiff = item.discount ? item.price * (item.discount / 100) * item.quantity : 0;
        return total + promoDiff + discountDiff;
    }, 0);
});

export const totalItems = computed(cartItems, (items) => {
    return items.reduce((total, item) => total + item.quantity, 0);
});
