/**
 * Component: AuthBackground
 * Shared background layer for all ShelfSafe mobile authentication screens:
 * - Landing (WelcomeScreen)
 * - Sign In (SignInScreen)
 * - Sign Up (CreateAccountScreen)
 *
 * Requirements:
 * - Uses aspect-ratio-preserving CONTAIN behavior (never cover, stretch, or crop).
 * - Image width never exceeds screen width.
 * - Entire ShelfSafe logo, wordmark, and tagline remain visible, centered, and uncropped.
 * - Non-interactive (pointerEvents="none") and decoupled from scroll/keyboard.
 * - Seamless background color (#FCF9EA) matching the mobile-bg.png canvas.
 */
import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet, Dimensions, ScaledSize } from 'react-native';

export default function AuthBackground() {
  // Use physical screen dimensions (not window dimensions), so the background container
  // remains completely fixed and never resizes or shifts when the keyboard opens or closes.
  const [screenDim, setScreenDim] = useState<ScaledSize>(() => Dimensions.get('screen'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ screen }: { screen: ScaledSize }) => {
      setScreenDim(screen);
    });
    return () => subscription?.remove();
  }, []);

  return (
    <View
      style={[
        styles.fixedContainer,
        {
          width: screenDim.width,
          height: screenDim.height,
        },
      ]}
      pointerEvents="none"
    >
      <Image
        source={require('../../assets/designs/mobile-bg.png')}
        style={{
          width: screenDim.width,
          height: screenDim.height,
        }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fixedContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#FCF9EA',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
});
