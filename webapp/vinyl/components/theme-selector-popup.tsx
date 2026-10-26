import { useState } from 'react'
import { Palette, Check, Disc } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VinylDesignType } from '@/hooks/use-theme'
import Image from 'next/image'

// Custom Random icon component using the provided SVG
const RandomIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
  >
    <path d="m18 14 4 4-4 4"/>
    <path d="m18 2 4 4-4 4"/>
    <path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22"/>
    <path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"/>
    <path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"/>
  </svg>
)

interface ThemeOption {
  id: string
  name: string
  preview: () => JSX.Element
}

interface VinylDesignOption {
  id: VinylDesignType
  name: string
  imagePath: string
}

interface ThemeSelectorPopupProps {
  currentTheme: string
  onThemeChange: (theme: string) => void
  currentAlbumImage?: string
  currentVinylDesign: VinylDesignType
  onVinylDesignChange: (design: VinylDesignType) => void
}

// Theme preview skeleton components
const WhiteThemePreview = () => (
  <div className="w-full h-16 bg-white border border-gray-200 rounded-md overflow-hidden">
    <div className="h-3 bg-gray-50 border-b border-gray-100"></div>
    <div className="p-2 space-y-1">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-gray-100 rounded"></div>
        <div className="flex-1 space-y-1">
          <div className="h-2 bg-gray-200 rounded w-3/4"></div>
          <div className="h-1.5 bg-gray-100 rounded w-1/2"></div>
        </div>
      </div>
      <div className="flex justify-center gap-1 mt-2">
        <div className="w-4 h-4 bg-gray-300 rounded-full"></div>
        <div className="w-4 h-4 bg-gray-200 rounded-full"></div>
        <div className="w-4 h-4 bg-gray-200 rounded-full"></div>
      </div>
    </div>
  </div>
)

const DarkThemePreview = () => (
  <div className="w-full h-16 rounded-md overflow-hidden" style={{ backgroundColor: '#262624', border: '1px solid #3a3a37' }}>
    <div className="h-3 border-b" style={{ backgroundColor: '#2d2d2a', borderColor: '#3a3a37' }}></div>
    <div className="p-2 space-y-1">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded" style={{ backgroundColor: '#333330' }}></div>
        <div className="flex-1 space-y-1">
          <div className="h-2 rounded w-3/4" style={{ backgroundColor: '#f5f5f5' }}></div>
          <div className="h-1.5 rounded w-1/2" style={{ backgroundColor: '#b3b3b3' }}></div>
        </div>
      </div>
      <div className="flex justify-center gap-1 mt-2">
        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#f5f5f5' }}></div>
        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#333330' }}></div>
        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#333330' }}></div>
      </div>
    </div>
  </div>
)

const AmoledThemePreview = () => (
  <div className="w-full h-16 bg-black border border-gray-800 rounded-md overflow-hidden">
    <div className="h-3 bg-black border-b border-gray-800"></div>
    <div className="p-2 space-y-1">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-gray-900 rounded"></div>
        <div className="flex-1 space-y-1">
          <div className="h-2 bg-gray-800 rounded w-3/4"></div>
          <div className="h-1.5 bg-gray-900 rounded w-1/2"></div>
        </div>
      </div>
      <div className="flex justify-center gap-1 mt-2">
        <div className="w-4 h-4 bg-gray-700 rounded-full"></div>
        <div className="w-4 h-4 bg-gray-800 rounded-full"></div>
        <div className="w-4 h-4 bg-gray-800 rounded-full"></div>
      </div>
    </div>
  </div>
)

const AlbumThemePreview = ({ albumImage }: { albumImage?: string }) => (
  <div className="w-full h-16 rounded-md overflow-hidden relative">
    {albumImage ? (
      <>
        <div 
          className="absolute inset-0 bg-gradient-to-br from-purple-500/80 via-pink-500/80 to-blue-500/80"
          style={{
            backgroundImage: `linear-gradient(135deg, rgba(139, 69, 19, 0.8), rgba(160, 82, 45, 0.8), rgba(210, 180, 140, 0.8))`,
          }}
        ></div>
        <div className="relative z-10 h-3 bg-black/20 border-b border-white/20"></div>
        <div className="relative z-10 p-2 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white/20 rounded border border-white/30"></div>
            <div className="flex-1 space-y-1">
              <div className="h-2 bg-white/30 rounded w-3/4"></div>
              <div className="h-1.5 bg-white/20 rounded w-1/2"></div>
            </div>
          </div>
          <div className="flex justify-center gap-1 mt-2">
            <div className="w-4 h-4 bg-white/40 rounded-full"></div>
            <div className="w-4 h-4 bg-white/20 rounded-full"></div>
            <div className="w-4 h-4 bg-white/20 rounded-full"></div>
          </div>
        </div>
      </>
    ) : (
      <>
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500"></div>
        <div className="relative z-10 h-3 bg-black/20 border-b border-white/20"></div>
        <div className="relative z-10 p-2 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white/20 rounded border border-white/30"></div>
            <div className="flex-1 space-y-1">
              <div className="h-2 bg-white/30 rounded w-3/4"></div>
              <div className="h-1.5 bg-white/20 rounded w-1/2"></div>
            </div>
          </div>
          <div className="flex justify-center gap-1 mt-2">
            <div className="w-4 h-4 bg-white/40 rounded-full"></div>
            <div className="w-4 h-4 bg-white/20 rounded-full"></div>
            <div className="w-4 h-4 bg-white/20 rounded-full"></div>
          </div>
        </div>
      </>
    )}
  </div>
)

const OrangeThemePreview = () => (
  <div className="w-full h-16 rounded-md overflow-hidden" style={{ backgroundColor: '#fb8500' }}>
    <div className="h-3 border-b" style={{ backgroundColor: '#f77f00', borderColor: '#f77f00' }}></div>
    <div className="p-2 space-y-1">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded" style={{ backgroundColor: '#ffb703' }}></div>
        <div className="flex-1 space-y-1">
          <div className="h-2 rounded w-3/4" style={{ backgroundColor: '#241E1C' }}></div>
          <div className="h-1.5 rounded w-1/2" style={{ backgroundColor: '#3D342F' }}></div>
        </div>
      </div>
      <div className="flex justify-center gap-1 mt-2">
        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#241E1C' }}></div>
        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#3D342F' }}></div>
        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#3D342F' }}></div>
      </div>
    </div>
  </div>
)

export function ThemeSelectorPopup({ currentTheme, onThemeChange, currentAlbumImage, currentVinylDesign, onVinylDesignChange }: ThemeSelectorPopupProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Helper function to render design icon - fixes complex ternary compilation issue
  const renderDesignIcon = (design: VinylDesignOption) => {
    if (design.id === 'random') {
      return (
        <div className="w-full h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
          <RandomIcon className="w-5 h-5 text-white" />
        </div>
      )
    }
    
    if (design.id === 'default') {
      return (
        <div className="w-full h-full bg-gradient-to-r from-blue-500 to-teal-500 rounded-full flex items-center justify-center">
          <RandomIcon className="w-5 h-5 text-white" />
        </div>
      )
    }
    
    return (
      <Image
        src={design.imagePath}
        alt={design.name}
        fill
        className="object-contain rounded-full"
        style={{
          animation: 'spin 60s linear infinite',
        }}
      />
    )
  }

  const vinylDesignOptions: VinylDesignOption[] = [
    {
      id: 'default',
      name: 'Classic',
      imagePath: '/record.svg'
    },
    {
      id: 'random',
      name: 'Random',
      imagePath: '/record.svg' // Use default SVG for random preview
    },
    {
      id: 'design1',
      name: 'Design 1',
      imagePath: '/Vinyl Record Design Aug 14 2025.png'
    },
    {
      id: 'design2',
      name: 'Design 2',
      imagePath: '/Vinyl Record Design Aug 14 2025 (1).png'
    },
    {
      id: 'design3',
      name: 'Design 3',
      imagePath: '/Vinyl Record Design Aug 14 2025 (2).png'
    },
    {
      id: 'design4',
      name: 'Design 4',
      imagePath: '/Vinyl Record Design Aug 14 2025 (3).png'
    },
    {
      id: 'design5',
      name: 'Design 5',
      imagePath: '/Vinyl Record Design Aug 14 2025 (4).png'
    },
    {
      id: 'design6',
      name: 'Design 6',
      imagePath: '/Vinyl Record Design Aug 14 2025 (5).png'
    }
  ]

  const themeOptions: ThemeOption[] = [
    {
      id: 'white',
      name: 'Light',
      preview: () => <WhiteThemePreview />
    },
    {
      id: 'dark',
      name: 'Dark',
      preview: () => <DarkThemePreview />
    },
    {
      id: 'amoled',
      name: 'AMOLED',
      preview: () => <AmoledThemePreview />
    },
    {
      id: 'album',
      name: 'Album',
      preview: () => <AlbumThemePreview albumImage={currentAlbumImage} />
    },
    {
      id: 'orange',
      name: 'Orange',
      preview: () => <OrangeThemePreview />
    }
  ]

  const handleThemeSelect = (themeId: string) => {
    onThemeChange(themeId)
    // Keep popup open after selection, like recents popup
  }

  const handleVinylDesignSelect = (designId: VinylDesignType) => {
    onVinylDesignChange(designId)
    // Keep popup open after selection, like recents popup
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Palette className="w-4 h-4" />
          <span className="hidden sm:inline">Themes</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <Tabs defaultValue="themes" className="w-full">
          <TabsList className="grid w-full grid-cols-2 m-2">
            <TabsTrigger value="themes" className="gap-2">
              <Palette className="w-4 h-4" />
              Themes
            </TabsTrigger>
            <TabsTrigger value="vinyl" className="gap-2">
              <Disc className="w-4 h-4" />
              Vinyl Designs
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="themes" className="p-4 pt-0">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Choose Theme</h3>
              <div className="grid grid-cols-1 gap-3">
                {themeOptions.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => handleThemeSelect(theme.id)}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors text-left group relative"
                  >
                    <div className="w-20 h-16 flex-shrink-0">
                      {theme.preview()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{theme.name}</p>
                        {currentTheme === theme.id && (
                          <Check className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="vinyl" className="p-4 pt-0">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Choose Vinyl Design</h3>
              <div className="grid grid-cols-3 gap-2">
                {vinylDesignOptions.map((design) => (
                  <button
                    key={design.id}
                    onClick={() => handleVinylDesignSelect(design.id)}
                    className="flex flex-col items-center gap-2 p-3 hover:bg-gray-50 rounded-lg transition-colors group relative min-h-[80px]"
                  >
                    <div className="w-10 h-10 relative flex-shrink-0">
                      {renderDesignIcon(design)}
                    </div>
                    <div className="text-center flex-1 flex items-center justify-center">
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-medium leading-tight">{design.name}</p>
                        {currentVinylDesign === design.id && (
                          <Check className="w-3 h-3 text-green-600 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}
