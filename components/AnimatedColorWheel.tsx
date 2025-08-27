import React from 'react'
import { View, StyleSheet } from 'react-native'
import { PanGestureHandler } from 'react-native-gesture-handler'
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
  withSpring
} from 'react-native-reanimated'
import Svg, { Defs, Stop, RadialGradient, Circle } from 'react-native-svg'

interface AnimatedColorWheelProps {
  size: number
  onColorChange: (color: string) => void
  initialColor?: string
}

const AnimatedColorWheel: React.FC<AnimatedColorWheelProps> = ({
  size,
  onColorChange,
  initialColor = '#ff0000'
}) => {
  const centerX = size / 2
  const centerY = size / 2
  const radius = (size - 40) / 2

  // Animated values for the selector position
  const translateX = useSharedValue(centerX)
  const translateY = useSharedValue(centerY - radius * 0.8)
  const scale = useSharedValue(1)

  // Convert HSV to RGB
  const hsvToRgb = (h: number, s: number, v: number) => {
    const c = v * s
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
    const m = v - c

    let r = 0, g = 0, b = 0
    
    if (h < 60) {
      r = c; g = x; b = 0
    } else if (h < 120) {
      r = x; g = c; b = 0
    } else if (h < 180) {
      r = 0; g = c; b = x
    } else if (h < 240) {
      r = 0; g = x; b = c
    } else if (h < 300) {
      r = x; g = 0; b = c
    } else {
      r = c; g = 0; b = x
    }

    const finalR = Math.round((r + m) * 255)
    const finalG = Math.round((g + m) * 255)
    const finalB = Math.round((b + m) * 255)

    return `rgb(${finalR}, ${finalG}, ${finalB})`
  }

  // Convert RGB to HEX
  const rgbToHex = (rgb: string) => {
    const matches = rgb.match(/rgb\((\d+), (\d+), (\d+)\)/)
    if (!matches) return '#000000'
    
    const r = parseInt(matches[1])
    const g = parseInt(matches[2])
    const b = parseInt(matches[3])
    
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
  }

  // Calculate color based on position
  const calculateColor = (x: number, y: number) => {
    const deltaX = x - centerX
    const deltaY = y - centerY
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    
    if (distance > radius) return initialColor
    
    // Calculate angle (hue)
    let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI)
    if (angle < 0) angle += 360
    
    // Calculate saturation based on distance from center
    const saturation = Math.min(distance / radius, 1)
    
    // Fixed value (brightness)
    const value = 1
    
    const rgb = hsvToRgb(angle, saturation, value)
    return rgbToHex(rgb)
  }

  const gestureHandler = useAnimatedGestureHandler({
    onStart: () => {
      scale.value = withSpring(1.2)
    },
    onActive: (event) => {
      const x = event.x
      const y = event.y
      
      // Check if the touch is within the wheel
      const deltaX = x - centerX
      const deltaY = y - centerY
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
      
      if (distance <= radius) {
        translateX.value = x
        translateY.value = y
        
        // Calculate and report color
        runOnJS((x: number, y: number) => {
          const color = calculateColor(x, y)
          onColorChange(color)
        })(x, y)
      }
    },
    onEnd: () => {
      scale.value = withSpring(1)
    }
  })

  const selectorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value - 15 },
      { translateY: translateY.value - 15 },
      { scale: scale.value }
    ]
  }))

  // Create color stops for the radial gradient
  const createColorStops = () => {
    const stops = []
    for (let i = 0; i <= 12; i++) {
      const hue = (i * 30) % 360
      const color = hsvToRgb(hue, 1, 1)
      const hex = rgbToHex(color)
      stops.push(
        <Stop key={i} offset={`${(i / 12) * 100}%`} stopColor={hex} />
      )
    }
    return stops
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View style={styles.wheelContainer}>
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id="colorWheel" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="white" />
                <Stop offset="100%" stopColor="transparent" />
              </RadialGradient>
              <RadialGradient id="hueGradient" cx="50%" cy="50%" r="50%">
                {createColorStops()}
              </RadialGradient>
            </Defs>
            
            {/* Hue circle */}
            <Circle
              cx={centerX}
              cy={centerY}
              r={radius}
              fill="url(#hueGradient)"
            />
            
            {/* Saturation overlay */}
            <Circle
              cx={centerX}
              cy={centerY}
              r={radius}
              fill="url(#colorWheel)"
            />
          </Svg>
          
          {/* Color selector dot */}
          <Animated.View style={[styles.selector, selectorStyle]} />
        </Animated.View>
      </PanGestureHandler>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelContainer: {
    position: 'relative',
  },
  selector: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'white',
    borderWidth: 3,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  }
})

export default AnimatedColorWheel