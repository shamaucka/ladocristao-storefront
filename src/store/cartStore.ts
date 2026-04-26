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

// Promoções por categoria
// CAMISETAS: 1 = R$49,90 | 2 = R$99,80 (sem promo) | 3 = R$97,00 (promo) | 4+ = R$97 + (qtd-3) * R$49,90
// QUADROS: 2 ou mais = R$75 cada

function normalizeCategory(cat?: string): "camisetas" | "quadros" | "almofadas" | "other" {
    const c = (cat || "").toString().toLowerCase();
    if (c.includes("camiseta")) return "camisetas";
    if (c.includes("almofada")) return "almofadas";
    if (c.includes("quadro")) return "quadros";
    return "other";
}

// Calcula subtotal de um grupo de itens aplicando a promo da categoria
function computeGroupSubtotal(groupItems: CartItem[]): { subtotal: number; savings: number } {
    if (groupItems.length === 0) return { subtotal: 0, savings: 0 };
    const category = normalizeCategory(groupItems[0].category);
    const totalQty = groupItems.reduce((s, i) => s + i.quantity, 0);
    // Preco "cheio" (sem promo, sem discount individual)
    const fullPrice = groupItems.reduce((sum, it) => sum + it.price * it.quantity, 0);

    // Aplica discount individual (field discount do item) em cima do fullPrice
    const pricePostDiscount = groupItems.reduce((sum, it) => {
        const p = it.price * (1 - (it.discount || 0) / 100);
        return sum + p * it.quantity;
    }, 0);

    let finalSubtotal = pricePostDiscount;

    if (category === "camisetas") {
        // 1: R$49,90 | 2: R$99,80 (2x49,90) | 3+: R$32,33/un (97/3) sempre
        const UNIT_PRICE = 49.90;
        const PROMO_UNIT = 97.00 / 3;
        if (totalQty >= 3) {
            finalSubtotal = totalQty * PROMO_UNIT;
        } else {
            finalSubtotal = totalQty * UNIT_PRICE;
        }
    } else if (category === "almofadas") {
        // 1: R$49,90 | 2: R$99,80 | 3+: R$32,33/un sempre
        const UNIT_PRICE = 49.90;
        const PROMO_UNIT = 97.00 / 3;
        if (totalQty >= 3) {
            finalSubtotal = totalQty * PROMO_UNIT;
        } else {
            finalSubtotal = totalQty * UNIT_PRICE;
        }
    } else if (category === "quadros") {
        // 2 ou mais = R$75 cada
        const PROMO_PRICE_QUADRO = 75;
        if (totalQty >= 2) {
            finalSubtotal = totalQty * PROMO_PRICE_QUADRO;
        }
    }

    const savings = Math.max(0, fullPrice - finalSubtotal);
    return { subtotal: finalSubtotal, savings };
}

// Preço unitario efetivo para um item, considerando a promo da sua categoria
// NaN-safe (qty = 0 retorna item.price). Nao aplica discount individual — ele fica por conta do caller se quiser.
export function getEffectiveUnitPrice(item: CartItem, allItems: CartItem[]): number {
    const category = normalizeCategory(item.category);
    const sameGroup = allItems.filter(i => normalizeCategory(i.category) === category);
    const totalQty = sameGroup.reduce((s, i) => s + i.quantity, 0);

    if ((category === "camisetas" || category === "almofadas") && totalQty >= 3) {
        // A partir de 3: R$32,33/un (97/3) para qualquer quantidade
        return 97 / 3;
    }
    if (category === "quadros" && totalQty >= 2) {
        return 75;
    }
    return item.price * (1 - (item.discount || 0) / 100);
}

// Ativa promo conforme regra da categoria
export function isPromoActive(items: CartItem[]): boolean {
    const camisetas = items.filter(i => normalizeCategory(i.category) === "camisetas")
        .reduce((s, i) => s + i.quantity, 0);
    const almofadas = items.filter(i => normalizeCategory(i.category) === "almofadas")
        .reduce((s, i) => s + i.quantity, 0);
    const quadros = items.filter(i => normalizeCategory(i.category) === "quadros")
        .reduce((s, i) => s + i.quantity, 0);
    return camisetas >= 3 || almofadas >= 3 || quadros >= 2;
}

export const totalPrice = computed(cartItems, (items) => {
    // Agrupa por categoria normalizada
    const byCategory = new Map<string, CartItem[]>();
    for (const it of items) {
        const k = normalizeCategory(it.category);
        if (!byCategory.has(k)) byCategory.set(k, []);
        byCategory.get(k)!.push(it);
    }
    let total = 0;
    byCategory.forEach((group) => {
        total += computeGroupSubtotal(group).subtotal;
    });
    return total;
});

export const totalSavings = computed(cartItems, (items) => {
    const byCategory = new Map<string, CartItem[]>();
    for (const it of items) {
        const k = normalizeCategory(it.category);
        if (!byCategory.has(k)) byCategory.set(k, []);
        byCategory.get(k)!.push(it);
    }
    let saved = 0;
    byCategory.forEach((group) => {
        saved += computeGroupSubtotal(group).savings;
    });
    return saved;
});

export const totalItems = computed(cartItems, (items) => {
    return items.reduce((total, item) => total + item.quantity, 0);
});
