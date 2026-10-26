"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Laptop, Smartphone, Speaker, Tv, Computer, Radio, ChevronDown } from "lucide-react"

interface Device {
  id: string
  is_active: boolean
  is_private_session: boolean
  is_restricted: boolean
  name: string
  type: string
  volume_percent: number
}

interface SpotifyConnectProps {
  devices: Device[]
  currentDevice: Device | null
  onTransferPlayback: (deviceId: string) => Promise<boolean>
  isPremium: boolean
  theme?: string
}

export function SpotifyConnect({ devices, currentDevice, onTransferPlayback, isPremium, theme }: SpotifyConnectProps) {
  const [isTransferring, setIsTransferring] = useState(false)
  
  const getDeviceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'computer':
        return <Laptop className="w-4 h-4" />
      case 'smartphone':
        return <Smartphone className="w-4 h-4" />
      case 'speaker':
        return <Speaker className="w-4 h-4" />
      case 'tv':
        return <Tv className="w-4 h-4" />
      case 'casted_video':
        return <Tv className="w-4 h-4" />
      case 'automobile':
        return <Radio className="w-4 h-4" />
      default:
        return <Computer className="w-4 h-4" />
    }
  }
  
  const getDeviceName = (device: Device | null) => {
    if (!device) return "No active device"
    
    // Clean up device name for web player
    if (device.name.includes('Web Player')) {
      const browser = device.name.split('(')[1]?.split(')')[0] || 'Web'
      return `Playing on ${browser}`
    }
    
    return `Playing on ${device.name}`
  }
  
  const handleTransfer = async (deviceId: string) => {
    if (isTransferring || !isPremium) return
    
    setIsTransferring(true)
    try {
      await onTransferPlayback(deviceId)
    } finally {
      setIsTransferring(false)
    }
  }
  
  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="px-4 py-2 rounded-full bg-green-500/20 hover:bg-green-500/30 backdrop-blur-md border border-green-500/30 flex items-center gap-2 transition-all"
            style={{
              color: theme === 'white' ? '#14532d' : '#dcfce7' // Dark green for light mode, light green for others
            }}
          >
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-medium">
              {getDeviceName(currentDevice)}
            </span>
            <ChevronDown className="w-3 h-3 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-64">
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            Connect to a device
          </div>
          <DropdownMenuSeparator />
          
          {devices.length === 0 ? (
            <div className="px-2 py-3 text-sm text-muted-foreground text-center">
              No devices available
            </div>
          ) : (
            devices.map((device) => (
              <DropdownMenuItem
                key={device.id}
                onClick={() => handleTransfer(device.id)}
                disabled={device.is_active || !isPremium || isTransferring}
                className="flex items-center gap-3 py-2"
              >
                <div className="flex-shrink-0">
                  {getDeviceIcon(device.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {device.name}
                  </div>
                  {device.is_active && (
                    <div className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" />
                      Currently playing
                    </div>
                  )}
                </div>
                {device.volume_percent !== null && (
                  <div className="text-xs text-muted-foreground">
                    {device.volume_percent}%
                  </div>
                )}
              </DropdownMenuItem>
            ))
          )}
          
          {!isPremium && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-2 text-xs text-muted-foreground">
                Premium required to transfer playback
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}