// Hashing utility (SHA-256 via Web Crypto API)
async function sha256(str: string): Promise<string> {
  if (!str) return "";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str.trim().toLowerCase()));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Generate unique event ID for deduplication (client+server)
export function genEventId(): string {
  return `ev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Get persistent visitor ID for external_id consistency
export function getVisitorId(): string {
  try { return (window as any)._tessVid || localStorage.getItem('tess_vid') || ''; } catch { return ''; }
}

// Save user data for Advanced Matching (hashed never stored)
export function saveUserData(data: { email?: string; phone?: string; name?: string }) {
  try {
    const parts = (data.name || "").trim().split(" ");
    const ud: any = {};
    if (data.email) ud.em = data.email.trim().toLowerCase();
    if (data.phone) ud.ph = data.phone.replace(/\D/g, "");
    if (parts[0]) ud.fn = parts[0].toLowerCase();
    if (parts[1]) ud.ln = parts.slice(1).join(" ").toLowerCase();
    localStorage.setItem("tess_user_data", JSON.stringify(ud));
  } catch {}
}

// Read fbp/fbc cookies
function getFbCookies(): { fbp?: string; fbc?: string } {
  if (typeof document === "undefined") return {};
  const cookies: Record<string, string> = {};
  document.cookie.split(";").forEach(c => {
    const [k, v] = c.trim().split("=");
    if (k === "_fbp") cookies.fbp = v;
    if (k === "_fbc") cookies.fbc = v;
  });
  // Fallback localStorage
  try {
    if (!cookies.fbp) cookies.fbp = localStorage.getItem("_fbp") || "";
    if (!cookies.fbc) cookies.fbc = localStorage.getItem("_fbc") || "";
  } catch {}
  return cookies;
}

// Envia evento server-side (CAPI) para deduplicação com Pixel
const TRACK_API = typeof window !== "undefined" && window.location.hostname === "localhost"
  ? "http://localhost:4000/api/store/track"
  : "https://api.ladocristao.com.br/api/store/track";

function sendServerEvent(data: Record<string, any>) {
  if (typeof window === "undefined") return;
  const fb = getFbCookies();
  fetch(TRACK_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...data,
      fbp: fb.fbp || undefined,
      fbc: fb.fbc || undefined,
      externalId: getVisitorId() || undefined,
      sourceUrl: window.location.href,
    }),
    keepalive: true, // garante envio mesmo se página fechar
  }).catch(() => {}); // fire-and-forget
}

// Read ttclid cookie
function getTtclid(): string {
  if (typeof document === "undefined") return "";
  return document.cookie.split(";").find(c => c.trim().startsWith("ttclid="))?.split("=")?.[1] || "";
}

// ── Meta Pixel events ──
export function trackMetaViewContent(product: { id: string; name: string; price: number }) {
  if (typeof window === "undefined" || !(window as any).fbq) return;
  const eventId = genEventId();
  (window as any).fbq("track", "ViewContent", {
    content_ids: [product.id],
    content_name: product.name,
    content_type: "product",
    value: product.price,
    currency: "BRL",
  }, { eventID: eventId });
  sendServerEvent({ event: "ViewContent", eventId, value: product.price, currency: "BRL", contentIds: [product.id], contentName: product.name });
}

export function trackMetaAddToCart(product: { id: string; name: string; price: number; quantity: number }) {
  if (typeof window === "undefined" || !(window as any).fbq) return;
  const eventId = genEventId();
  (window as any).fbq("track", "AddToCart", {
    content_ids: [product.id],
    content_name: product.name,
    content_type: "product",
    value: product.price * product.quantity,
    currency: "BRL",
    num_items: product.quantity,
  }, { eventID: eventId });
  sendServerEvent({ event: "AddToCart", eventId, value: product.price * product.quantity, currency: "BRL", contentIds: [product.id], contentName: product.name, numItems: product.quantity });
  return eventId;
}

export function trackMetaInitiateCheckout(value: number, numItems: number) {
  if (typeof window === "undefined" || !(window as any).fbq) return;
  const eventId = genEventId();
  (window as any).fbq("track", "InitiateCheckout", {
    value,
    currency: "BRL",
    num_items: numItems,
  }, { eventID: eventId });
  sendServerEvent({ event: "InitiateCheckout", eventId, value, currency: "BRL", numItems });
  return eventId;
}

export function trackMetaAddPaymentInfo(value: number, paymentMethod: string) {
  if (typeof window === "undefined" || !(window as any).fbq) return;
  const eventId = genEventId();
  (window as any).fbq("track", "AddPaymentInfo", {
    value,
    currency: "BRL",
    payment_type: paymentMethod,
  }, { eventID: eventId });
  sendServerEvent({ event: "AddPaymentInfo", eventId, value, currency: "BRL" });
}

export function trackMetaPurchase(params: {
  orderId: string; value: number; items: Array<{ id: string; name: string; quantity: number; price: number }>;
  eventId?: string;
}) {
  if (typeof window === "undefined" || !(window as any).fbq) return;
  const eventId = params.eventId || genEventId();
  (window as any).fbq("track", "Purchase", {
    value: params.value,
    currency: "BRL",
    content_ids: params.items.map(i => i.id),
    content_type: "product",
    num_items: params.items.reduce((s, i) => s + i.quantity, 0),
    order_id: params.orderId,
  }, { eventID: eventId });
  return eventId;
}

// ── TikTok Pixel events ──
function ttq(): any { return (window as any).ttq; }

export function trackTikTokViewContent(product: { id: string; name: string; price: number }) {
  if (typeof window === "undefined" || !ttq()) return;
  ttq().track("ViewContent", {
    content_id: product.id,
    content_name: product.name,
    content_type: "product",
    value: product.price,
    currency: "BRL",
  });
}

export function trackTikTokAddToCart(product: { id: string; name: string; price: number; quantity: number }) {
  if (typeof window === "undefined" || !ttq()) return;
  ttq().track("AddToCart", {
    content_id: product.id,
    content_name: product.name,
    content_type: "product",
    value: product.price * product.quantity,
    currency: "BRL",
    quantity: product.quantity,
  });
}

export function trackTikTokInitiateCheckout(value: number) {
  if (typeof window === "undefined" || !ttq()) return;
  ttq().track("InitiateCheckout", { value, currency: "BRL" });
}

export function trackTikTokPurchase(params: { orderId: string; value: number }) {
  if (typeof window === "undefined" || !ttq()) return;
  ttq().track("CompletePayment", {
    content_type: "product",
    order_id: params.orderId,
    value: params.value,
    currency: "BRL",
  });
}

// ── Google events ──
function gtag(...args: any[]) {
  if (typeof window === "undefined" || !(window as any).gtag) return;
  (window as any).gtag(...args);
}

export function trackGoogleViewItem(product: { id: string; name: string; price: number; category?: string }) {
  gtag("event", "view_item", {
    currency: "BRL",
    value: product.price,
    items: [{ item_id: product.id, item_name: product.name, price: product.price, item_category: product.category || "Quadros" }],
  });
}

export function trackGoogleAddToCart(product: { id: string; name: string; price: number; quantity: number; category?: string }) {
  gtag("event", "add_to_cart", {
    currency: "BRL",
    value: product.price * product.quantity,
    items: [{ item_id: product.id, item_name: product.name, price: product.price, quantity: product.quantity, item_category: product.category || "Quadros" }],
  });
}

export function trackGoogleBeginCheckout(value: number, items: Array<{ id: string; name: string; price: number; quantity: number }>) {
  gtag("event", "begin_checkout", {
    currency: "BRL",
    value,
    items: items.map(i => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity })),
  });
}

export function trackGooglePurchase(params: {
  orderId: string; value: number; items: Array<{ id: string; name: string; price: number; quantity: number }>;
  googleAdsId?: string; purchaseLabel?: string;
}) {
  const AW_ID = (window as any).__GA_AW_ID || "";
  const LABEL = (window as any).__GA_PURCHASE_LABEL || "";

  gtag("event", "purchase", {
    transaction_id: params.orderId,
    currency: "BRL",
    value: params.value,
    items: params.items.map(i => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity })),
  });

  // Google Ads conversion
  if (AW_ID && LABEL) {
    gtag("event", "conversion", {
      send_to: `${AW_ID}/${LABEL}`,
      value: params.value,
      currency: "BRL",
      transaction_id: params.orderId,
    });
  }
}

// ── Enhanced Conversions: set user data before purchase ──
export async function setEnhancedConversionsData(data: { email?: string; phone?: string; name?: string; address?: { zip?: string; city?: string; state?: string } }) {
  if (typeof window === "undefined") return;

  const parts = (data.name || "").trim().split(" ");
  const userData: any = {};

  if (data.email) {
    userData.email = data.email.trim().toLowerCase();
    userData.sha256_email_address = await sha256(data.email);
  }
  if (data.phone) {
    const ph = "+55" + data.phone.replace(/\D/g, "");
    userData.phone_number = ph;
    userData.sha256_phone_number = await sha256(ph);
  }
  if (parts[0]) userData.first_name = parts[0].toLowerCase();
  if (parts[1]) userData.last_name = parts.slice(1).join(" ").toLowerCase();
  if (data.address?.zip) userData.address = { postal_code: data.address.zip, country: "BR", region: data.address.state, city: data.address.city };

  gtag("set", "user_data", userData);

  // TikTok Advanced Matching
  if ((window as any).ttq && data.email) {
    (window as any).ttq.identify({
      email: data.email.trim().toLowerCase(),
      phone_number: data.phone ? "+55" + data.phone.replace(/\D/g, "") : undefined,
    });
  }
}
