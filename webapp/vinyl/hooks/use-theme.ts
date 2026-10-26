'use client'

import { useState, useEffect, useCallback } from 'react'

export type ThemeType = 'white' | 'dark' | 'amoled' | 'album' | 'orange'
export type VinylDesignType = 'default' | 'design1' | 'design2' | 'design3' | 'design4' | 'design5' | 'design6' | 'random'

interface UseThemeReturn {
  theme: ThemeType
  setTheme: (theme: ThemeType) => void
  albumGradient: string | null
  setAlbumGradient: (gradient: string | null) => void
  albumBackgroundUrl: string | null
  setAlbumBackgroundUrl: (url: string | null) => void
  vinylDesign: VinylDesignType
  setVinylDesign: (design: VinylDesignType) => void
}

const THEME_STORAGE_KEY = 'vinyl-theme'
const ALBUM_GRADIENT_STORAGE_KEY = 'vinyl-album-gradient'
const ALBUM_BG_URL_STORAGE_KEY = 'vinyl-album-bg-url'
const VINYL_DESIGN_STORAGE_KEY = 'vinyl-design'

export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<ThemeType>('white')
  const [albumGradient, setAlbumGradientState] = useState<string | null>(null)
  const [albumBackgroundUrl, setAlbumBackgroundUrlState] = useState<string | null>(null)
  const [vinylDesign, setVinylDesignState] = useState<VinylDesignType>('default')

  // Load theme from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeType
      const savedGradient = localStorage.getItem(ALBUM_GRADIENT_STORAGE_KEY)
      const savedBgUrl = localStorage.getItem(ALBUM_BG_URL_STORAGE_KEY)
      const savedVinylDesign = localStorage.getItem(VINYL_DESIGN_STORAGE_KEY) as VinylDesignType
      
      if (savedTheme && ['white', 'dark', 'amoled', 'album', 'orange'].includes(savedTheme)) {
        setThemeState(savedTheme)
      }
      
      if (savedGradient) {
        setAlbumGradientState(savedGradient)
      }
      
      if (savedBgUrl) {
        setAlbumBackgroundUrlState(savedBgUrl)
      }
      
      if (savedVinylDesign && ['default', 'design1', 'design2', 'design3', 'design4', 'design5', 'design6', 'random'].includes(savedVinylDesign)) {
        setVinylDesignState(savedVinylDesign)
      }
    }
  }, [])

  // Apply theme to document root
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = document.documentElement
      
      // Remove all theme classes
      root.classList.remove('theme-white', 'theme-dark', 'theme-amoled', 'theme-album', 'theme-orange')
      
      // Add current theme class
      root.classList.add(`theme-${theme}`)
      
      // For album theme, apply the gradient and determine text color
      if (theme === 'album') {
        if (albumGradient) {
          root.style.setProperty('--album-gradient', albumGradient)
          
          // Extract the first color from the gradient to determine text color
          const firstColorMatch = albumGradient.match(/rgb\(\d+,\s*\d+,\s*\d+\)/)
          if (firstColorMatch) {
            const contrastColor = getContrastColor(firstColorMatch[0])
            root.style.setProperty('--album-text-color', contrastColor === 'light' ? '#ffffff' : '#000000')
            root.style.setProperty('--album-bg-color', contrastColor === 'light' ? '#000000' : '#ffffff')
          } else {
            root.style.setProperty('--album-text-color', '#ffffff')
            root.style.setProperty('--album-bg-color', '#000000')
          }
        }
        if (albumBackgroundUrl) {
          root.style.setProperty('--album-bg-url', albumBackgroundUrl)
        }
      }
    }
  }, [theme, albumGradient])

  const setTheme = useCallback((newTheme: ThemeType) => {
    setThemeState(newTheme)
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    }
  }, [])

  const setAlbumGradient = useCallback((gradient: string | null) => {
    setAlbumGradientState(gradient)
    if (typeof window !== 'undefined') {
      if (gradient) {
        localStorage.setItem(ALBUM_GRADIENT_STORAGE_KEY, gradient)
      } else {
        localStorage.removeItem(ALBUM_GRADIENT_STORAGE_KEY)
      }
    }
  }, [])

  const setAlbumBackgroundUrl = useCallback((url: string | null) => {
    setAlbumBackgroundUrlState(url)
    if (typeof window !== 'undefined') {
      if (url) {
        localStorage.setItem(ALBUM_BG_URL_STORAGE_KEY, url)
      } else {
        localStorage.removeItem(ALBUM_BG_URL_STORAGE_KEY)
      }
    }
  }, [])

  const setVinylDesign = useCallback((design: VinylDesignType) => {
    setVinylDesignState(design)
    if (typeof window !== 'undefined') {
      localStorage.setItem(VINYL_DESIGN_STORAGE_KEY, design)
    }
  }, [])

  return {
    theme,
    setTheme,
    albumGradient,
    setAlbumGradient,
    albumBackgroundUrl,
    setAlbumBackgroundUrl,
    vinylDesign,
    setVinylDesign
  }
}

// Utility function to extract dominant colors from an image and generate a gradient
export async function generateAlbumGradient(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        resolve('linear-gradient(135deg, #667eea 0%, #764ba2 100%)')
        return
      }
      
      // Scale down for performance while maintaining quality
      const maxSize = 100
      const scale = Math.min(maxSize / img.width, maxSize / img.height)
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        
        // Extract all pixels and group by color similarity
        const colorMap = new Map()
        const step = 4 // Sample every 4th pixel for performance
        
        for (let i = 0; i < data.length; i += step * 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const a = data[i + 3]
          
          // Skip transparent pixels
          if (a < 128) continue
          
          // Group similar colors together (reduce precision)
          const bucket = `${Math.floor(r/20)*20},${Math.floor(g/20)*20},${Math.floor(b/20)*20}`
          colorMap.set(bucket, (colorMap.get(bucket) || 0) + 1)
        }
        
        // Sort colors by frequency and get top colors
        const sortedColors = Array.from(colorMap.entries())
          .sort(([,a], [,b]) => b - a)
          .slice(0, 6)
          .map(([color]) => {
            const [r, g, b] = color.split(',').map(Number)
            return { r, g, b }
          })
        
        if (sortedColors.length === 0) {
          resolve('linear-gradient(135deg, #667eea 0%, #764ba2 100%)')
          return
        }
        
        // Create Apple Music-style vibrant gradients
        const enhancedColors = sortedColors.map(({r, g, b}, index) => {
          // Convert to HSL for better color manipulation
          const max = Math.max(r, g, b) / 255
          const min = Math.min(r, g, b) / 255
          const diff = max - min
          const sum = max + min
          let h = 0, s = 0, l = sum / 2
          
          if (diff !== 0) {
            s = l > 0.5 ? diff / (2 - sum) : diff / sum
            
            const rNorm = r / 255
            const gNorm = g / 255
            const bNorm = b / 255
            
            switch (max) {
              case rNorm:
                h = ((gNorm - bNorm) / diff + (g < b ? 6 : 0)) / 6
                break
              case gNorm:
                h = ((bNorm - rNorm) / diff + 2) / 6
                break
              case bNorm:
                h = ((rNorm - gNorm) / diff + 4) / 6
                break
            }
          }
          
          // Enhance saturation significantly (Apple Music style)
          s = Math.min(1, s * 2.2)
          
          // Adjust lightness for depth - create light and dark variants
          if (index === 0) {
            l = Math.max(0.4, Math.min(0.75, l * 1.1)) // Primary color - slightly brighter
          } else if (index === 1) {
            l = Math.max(0.25, Math.min(0.6, l * 0.85)) // Secondary - darker
          } else {
            l = index % 2 === 0 ? Math.max(0.3, l * 0.9) : Math.min(0.8, l * 1.2)
          }
          
          // Convert back to RGB
          const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1
            if (t > 1) t -= 1
            if (t < 1/6) return p + (q - p) * 6 * t
            if (t < 1/2) return q
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
            return p
          }
          
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s
          const p = 2 * l - q
          
          const newR = Math.round(hue2rgb(p, q, h + 1/3) * 255)
          const newG = Math.round(hue2rgb(p, q, h) * 255)
          const newB = Math.round(hue2rgb(p, q, h - 1/3) * 255)
          
          // Add opacity for layering effect
          return index === 0 ? `rgba(${newR}, ${newG}, ${newB}, 1)` : `rgba(${newR}, ${newG}, ${newB}, 0.9)`
        })
        
        // Create Apple Music-style complex gradient with multiple color stops
        let gradient
        if (enhancedColors.length >= 4) {
          // Rich multi-color gradient with smooth transitions
          gradient = `radial-gradient(ellipse at top left, ${enhancedColors[0]} 0%, transparent 50%),
                      radial-gradient(ellipse at top right, ${enhancedColors[1]} 0%, transparent 50%),
                      radial-gradient(ellipse at bottom left, ${enhancedColors[2]} 0%, transparent 50%),
                      radial-gradient(ellipse at bottom right, ${enhancedColors[3]} 0%, transparent 50%),
                      linear-gradient(180deg, ${enhancedColors[0]} 0%, ${enhancedColors[1]} 100%)`
        } else if (enhancedColors.length >= 3) {
          gradient = `radial-gradient(ellipse at top, ${enhancedColors[0]} 0%, transparent 60%),
                      radial-gradient(ellipse at bottom left, ${enhancedColors[1]} 0%, transparent 60%),
                      radial-gradient(ellipse at bottom right, ${enhancedColors[2]} 0%, transparent 60%),
                      linear-gradient(135deg, ${enhancedColors[0]} 0%, ${enhancedColors[1]} 50%, ${enhancedColors[2]} 100%)`
        } else if (enhancedColors.length === 2) {
          gradient = `radial-gradient(ellipse at top left, ${enhancedColors[0]} 0%, transparent 70%),
                      radial-gradient(ellipse at bottom right, ${enhancedColors[1]} 0%, transparent 70%),
                      linear-gradient(135deg, ${enhancedColors[0]} 0%, ${enhancedColors[1]} 100%)`
        } else {
          gradient = `radial-gradient(ellipse at center, ${enhancedColors[0]} 0%, transparent 70%),
                      linear-gradient(135deg, ${enhancedColors[0]} 0%, ${enhancedColors[0]} 100%)`
        }
        
        resolve(gradient)
      } catch (error) {
        console.error('Error extracting colors:', error)
        resolve('linear-gradient(135deg, #667eea 0%, #764ba2 100%)')
      }
    }
    
    img.onerror = () => {
      resolve('linear-gradient(135deg, #667eea 0%, #764ba2 100%)')
    }
    
    img.src = imageUrl
  })
}

// Utility function to determine if a color is light or dark
export function getContrastColor(backgroundColor: string): 'light' | 'dark' {
  // Extract RGB values from various color formats
  let r, g, b
  
  if (backgroundColor.startsWith('rgb')) {
    const match = backgroundColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (match) {
      r = parseInt(match[1])
      g = parseInt(match[2])
      b = parseInt(match[3])
    }
  } else if (backgroundColor.startsWith('#')) {
    const hex = backgroundColor.slice(1)
    r = parseInt(hex.substr(0, 2), 16)
    g = parseInt(hex.substr(2, 2), 16)
    b = parseInt(hex.substr(4, 2), 16)
  }
  
  if (r === undefined || g === undefined || b === undefined) {
    return 'dark' // Default to dark text
  }
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? 'dark' : 'light'
}

// Utility function to get vinyl design image path
export function getVinylDesignPath(design: VinylDesignType): string {
  // If random is selected, pick a random design
  if (design === 'random') {
    const designs: VinylDesignType[] = ['design1', 'design2', 'design3', 'design4', 'design5', 'design6']
    design = designs[Math.floor(Math.random() * designs.length)]
  }
  
  switch (design) {
    case 'design1':
      return '/Vinyl Record Design Aug 14 2025.png'
    case 'design2':
      return '/Vinyl Record Design Aug 14 2025 (1).png'
    case 'design3':
      return '/Vinyl Record Design Aug 14 2025 (2).png'
    case 'design4':
      return '/Vinyl Record Design Aug 14 2025 (3).png'
    case 'design5':
      return '/Vinyl Record Design Aug 14 2025 (4).png'
    case 'design6':
      return '/Vinyl Record Design Aug 14 2025 (5).png'
    default:
      return '/record.svg'
  }
}
