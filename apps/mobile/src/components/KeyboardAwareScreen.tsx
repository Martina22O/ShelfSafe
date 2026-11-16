import React, { forwardRef, useEffect } from 'react';
import { StyleSheet, ViewStyle, StyleProp, Keyboard } from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewProps,
} from 'react-native-keyboard-controller';

export interface KeyboardAwareScreenProps extends KeyboardAwareScrollViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  bottomOffset?: number;
}

export const KeyboardAwareScreen = forwardRef<any, KeyboardAwareScreenProps>(
  (
    {
      children,
      style,
      contentContainerStyle,
      bottomOffset = 24,
      keyboardShouldPersistTaps = 'handled',
      keyboardDismissMode = 'on-drag',
      showsVerticalScrollIndicator = false,
      ...rest
    },
    ref
  ) => {
    useEffect(() => {
      return () => {
        // Dismiss keyboard when screen unmounts / navigates away
        Keyboard.dismiss();
      };
    }, []);

    return (
      <KeyboardAwareScrollView
        ref={ref}
        style={[styles.container, style]}
        contentContainerStyle={contentContainerStyle}
        bottomOffset={bottomOffset}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        {...rest}
      >
        {children}
      </KeyboardAwareScrollView>
    );
  }
);

KeyboardAwareScreen.displayName = 'KeyboardAwareScreen';

export default KeyboardAwareScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
