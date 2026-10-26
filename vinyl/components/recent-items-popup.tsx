import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'
import Image from 'next/image'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Track {
  id: string
  name: string
  uri: string
  artists: Array<{ name: string }>
  album: {
    name: string
    images: Array<{ url: string }>
  }
  played_at?: string
}

interface Playlist {
  id: string
  name: string
  uri: string
  images: Array<{ url: string }>
  tracks: { total: number }
}

interface Album {
  id: string
  name: string
  uri: string
  artists: Array<{ name: string }>
  images: Array<{ url: string }>
}

interface RecentItemsPopupProps {
  onPlay: (uri: string, contextUri?: string) => void
  isPremium: boolean
}

export function RecentItemsPopup({ onPlay, isPremium }: RecentItemsPopupProps) {
  const [recentItems, setRecentItems] = useState<{
    tracks: Track[]
    playlists: Playlist[]
    albums: Album[]
  }>({ tracks: [], playlists: [], albums: [] })
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (isOpen && isPremium) {
      fetchRecentItems()
    }
  }, [isOpen, isPremium])

  const fetchRecentItems = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/spotify/recent')
      if (response.ok) {
        const data = await response.json()
        setRecentItems(data)
      }
    } catch (error) {
      console.error('Error fetching recent items:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePlayTrack = (track: Track) => {
    onPlay(track.uri)
    setIsOpen(false)
  }

  const handlePlayPlaylist = (playlist: Playlist) => {
    onPlay('', playlist.uri)
    setIsOpen(false)
  }

  const handlePlayAlbum = (album: Album) => {
    onPlay('', album.uri)
    setIsOpen(false)
  }

  if (!isPremium) {
    return null
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Clock className="w-4 h-4" />
          <span className="hidden sm:inline">Recent</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        {isLoading ? (
          <div className="p-4 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          </div>
        ) : (
          <Tabs defaultValue="tracks" className="w-full">
            <TabsList className="w-full rounded-none border-b">
              <TabsTrigger value="tracks" className="flex-1">Songs</TabsTrigger>
              <TabsTrigger value="playlists" className="flex-1">Playlists</TabsTrigger>
              <TabsTrigger value="albums" className="flex-1">Albums</TabsTrigger>
            </TabsList>
            
            <TabsContent value="tracks" className="m-0">
              <ScrollArea className="h-[400px]">
                <div className="p-2">
                  {recentItems.tracks.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => handlePlayTrack(track)}
                      className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg transition-colors text-left"
                    >
                      <Image
                        src={track.album.images[0]?.url || '/placeholder_album.png'}
                        alt={track.name}
                        width={48}
                        height={48}
                        className="rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{track.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {track.artists.map(a => a.name).join(', ')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="playlists" className="m-0">
              <ScrollArea className="h-[400px]">
                <div className="p-2">
                  {recentItems.playlists.map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={() => handlePlayPlaylist(playlist)}
                      className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg transition-colors text-left"
                    >
                      <Image
                        src={playlist.images?.[0]?.url || '/placeholder_album.png'}
                        alt={playlist.name}
                        width={48}
                        height={48}
                        className="rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{playlist.name}</p>
                        <p className="text-xs text-gray-500">
                          {playlist.tracks.total} tracks
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="albums" className="m-0">
              <ScrollArea className="h-[400px]">
                <div className="p-2">
                  {recentItems.albums.map((album) => (
                    <button
                      key={album.id}
                      onClick={() => handlePlayAlbum(album)}
                      className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg transition-colors text-left"
                    >
                      <Image
                        src={album.images?.[0]?.url || '/placeholder_album.png'}
                        alt={album.name}
                        width={48}
                        height={48}
                        className="rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{album.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {album.artists.map(a => a.name).join(', ')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </PopoverContent>
    </Popover>
  )
}