import React, { forwardRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Keyboard,
  Pressable,
  ScrollView,
  ScrollViewProps,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

export interface KeyboardAwareScreenProps extends ScrollViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  bottomOffset?: number;
  extraKeyboardSpace?: number;
}

const KeyboardAvoidingViewComponent = KeyboardAvoidingView as any;

export const KeyboardAwareScreen = forwardRef<any, KeyboardAwareScreenProps>(
  (
    {
      children,
      style,
      contentContainerStyle,
      bottomOffset = 24,
      extraKeyboardSpace = 0,
      keyboardShouldPersistTaps = 'handled',
      keyboardDismissMode = 'on-drag',
      showsVerticalScrollIndicator = false,
      scrollEnabled,
      ...rest
    },
    ref
  ) => {
    const isWeb = Platform.OS === 'web';

    useEffect(() => {
      return () => {
        // Dismiss keyboard when screen unmounts / navigates away
        if (!isWeb) {
          Keyboard.dismiss();
        }
      };
    }, [isWeb]);

    // On Web / iPhone Safari PWA:
    // 1. Do NOT wrap children in <Pressable onPress={Keyboard.dismiss}> because in
    //    react-native-web a native click on any child <TextInput> (<input>) bubbles
    //    to the first PressResponder ancestor and immediately calls Keyboard.dismiss() (input.blur()).
    // 2. Do NOT use keyboardDismissMode="on-drag" on Web because react-native-web's
    //    ScrollView._handleScroll calls dismissKeyboard() on ANY scroll event, including
    //    iOS Safari's automatic scroll-into-view when the software keyboard opens.
    // 3. Keep scrollEnabled={true} on Web because Keyboard.addListener is a no-op in
    //    react-native-web and scrollEnabled={false} applies touch-action: none.
    if (isWeb) {
      return (
        <ScrollView
          ref={ref}
          style={[styles.container, style]}
          contentContainerStyle={[
            styles.scrollContent,
            contentContainerStyle,
            bottomOffset > 0 ? { paddingBottom: bottomOffset + extraKeyboardSpace } : null,
          ]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          scrollEnabled={true}
          {...rest}
        >
          <View style={styles.pressableContent}>{children}</View>
        </ScrollView>
      );
    }

    return (
      <KeyboardAvoidingViewComponent
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? bottomOffset + extraKeyboardSpace : 0}
      >
        <ScrollView
          ref={ref}
          style={[styles.container, style]}
          contentContainerStyle={[
            styles.scrollContent,
            contentContainerStyle,
            bottomOffset > 0 ? { paddingBottom: bottomOffset + extraKeyboardSpace } : null,
          ]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          keyboardDismissMode={keyboardDismissMode}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          scrollEnabled={scrollEnabled}
          {...rest}
        >
          <Pressable
            style={styles.pressableContent}
            onPress={Keyboard.dismiss}
            accessible={false}
          >
            {children}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingViewComponent>
    );
  }
);

KeyboardAwareScreen.displayName = 'KeyboardAwareScreen';

export default KeyboardAwareScreen;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  pressableContent: {
    flexGrow: 1,
  },
});
