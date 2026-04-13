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

// Otimiza e reescreve URL de imagem para CDN próprio
// Usa f_jpg em vez de f_auto porque o CDN Worker nao passa Accept header,
// fazendo Cloudinary retornar JPEG XL (nao suportado em Chrome)
function optimizeCloudinaryUrl(url: string, width = 600) {
  if (!url) return url
  const cdnUrl = url.replace(/^https?:\/\/res\.cloudinary\.com\/[^/]+\//, "https://cdn.ladocristao.com.br/")
  if (!cdnUrl.includes("cdn.ladocristao.com.br")) return url
  const transform = `f_jpg,q_auto,w_${width}`
  if (/\/image\/upload\/[a-z]/.test(cdnUrl)) {
    return cdnUrl.replace(/\/image\/upload\/[^/]+\//, `/image/upload/${transform}/`)
  }
  return cdnUrl.replace("/image/upload/", `/image/upload/${transform}/`)
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

  return {
    id: p.id,
    name: p.title || p.name,
    title: p.title || p.name,
    price,
    description: p.description || "",
    category: p.category_id || p.category || "Quadros",
    stock: p.stock ?? 50,
    images,
    slug: p.handle || p.slug,
    badge: p.badge,
    discount: p.discount,
    specs: p.specs || [
      { label: "Tamanho", value: "60x90cm" },
      { label: "Material", value: "Canvas Poliester Premium" },
      { label: "Moldura", value: "Madeira Reflorestamento" },
    ],
  }
}
