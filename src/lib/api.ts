const API_URL = import.meta.env.PUBLIC_API_URL || "https://api.ladocristao.com.br/api"

export async function fetchAPI<T>(path: string): Promise<T> {
  const res = await fetch(API_URL + path, {
    headers: { "Content-Type": "application/json" },
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
  return res.json()
}

export async function fetchProducts(limit = 500) {
  try {
    const data = await fetchAPI<{ products: any[]; count: number }>(`/store/products?limit=${limit}`)
    return data.products.map(normalizeProduct)
  } catch (e) {
    console.error("Failed to fetch products from API, using static data:", e)
    return null // fallback to static
  }
}

export async function fetchProductByHandle(handle: string) {
  try {
    const data = await fetchAPI<{ product: any }>(`/store/products/${handle}`)
    return normalizeProduct(data.product)
  } catch (e) {
    console.error(`Failed to fetch product ${handle}:`, e)
    return null
  }
}

export async function fetchCategories() {
  try {
    const data = await fetchAPI<{ categories: any[] }>("/store/categories")
    return data.categories
  } catch (e) {
    console.error("Failed to fetch categories:", e)
    return null
  }
}

export async function fetchHomeLayout() {
  try {
    const data = await fetchAPI<{ layout: any }>("/store/home-layout")
    return data.layout
  } catch (e) {
    console.error("Failed to fetch home layout:", e)
    return null
  }
}

export async function fetchBundles() {
  try {
    const data = await fetchAPI<{ bundles: any[] }>("/store/bundles")
    return data.bundles || []
  } catch (e) {
    console.error("Failed to fetch bundles:", e)
    return []
  }
}

// Otimiza URL do Cloudinary adicionando transforms (f_auto, q_auto, w_X)
// Usa Cloudinary direto (CDN proprio ainda nao configurado para ladocristao)
function optimizeCloudinaryUrl(url: string, width = 600) {
  if (!url) return url
  if (!url.includes("res.cloudinary.com") && !url.includes("cdn.ladocristao.com.br")) return url
  const transform = `f_auto,q_auto,w_${width}`
  // Se ja tem transforms no path, substitui
  if (/\/image\/upload\/[a-z]_[^/]+\//.test(url)) {
    return url.replace(/\/image\/upload\/[^/]+\//, `/image/upload/${transform}/`)
  }
  // Sem transforms: injeta apos /image/upload/
  return url.replace("/image/upload/", `/image/upload/${transform}/`)
}

// Normaliza produto da API para o formato que o storefront espera
function normalizeProduct(p: any) {
  const price = p.variants?.[0]?.prices?.[0]?.amount
    ? p.variants[0].prices[0].amount / 100
    : p.price || 97

  const rawImages = p.images?.length
    ? p.images.map((img: any) => {
        const url = typeof img === "string" ? img : img.url
        return url?.startsWith("http") ? url : `https://api.ladocristao.com.br${url}`
      })
    : p.thumbnail
      ? [p.thumbnail.startsWith("http") ? p.thumbnail : `https://api.ladocristao.com.br${p.thumbnail}`]
      : []

  // Otimiza URLs do Cloudinary (400px para cards, 800px para produto)
  const images = rawImages.map((url: string) => optimizeCloudinaryUrl(url, 400))

  // Detecta categoria real
  const rawCategory = (p.category_id || p.category || "").toString().toLowerCase()
  let categoryLabel = "Quadros"
  if (rawCategory.includes("camiseta")) categoryLabel = "Camisetas"
  else if (rawCategory.includes("almofada")) categoryLabel = "Almofadas"
  else if (rawCategory.includes("escultura")) categoryLabel = "Esculturas"

  // Extrai variantes (tamanhos) quando existirem
  const variants = Array.isArray(p.variants)
    ? p.variants.map((v: any) => ({
        id: v.id,
        title: v.title || v.options?.tamanho || "Padrao",
        sku: v.sku,
        size: v.options?.tamanho || v.title,
        price: v.prices?.[0]?.amount ? v.prices[0].amount / 100 : price,
      }))
    : []

  // Specs específicos por categoria
  let specs = p.specs
  if (!specs) {
    if (categoryLabel === "Camisetas") {
      specs = [
        { label: "Material", value: "Toque Algodao Anti-Pilling" },
        { label: "Tamanhos", value: "P, M, G, GG" },
        { label: "Caimento", value: "Feminino" },
        { label: "Estampa", value: "Nao desbota" },
      ]
    } else {
      specs = [
        { label: "Tamanho", value: "60x90cm" },
        { label: "Material", value: "Canvas Poliester Premium" },
        { label: "Moldura", value: "Madeira Reflorestamento" },
      ]
    }
  }

  return {
    id: p.id,
    name: p.title || p.name,
    title: p.title || p.name,
    price,
    description: p.description || "",
    category: categoryLabel,
    stock: p.stock ?? 50,
    images,
    slug: p.handle || p.slug,
    badge: p.badge,
    discount: p.discount,
    variants,
    specs,
  }
}
