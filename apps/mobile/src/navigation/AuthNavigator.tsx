/**
 * Stack Navigator: AuthNavigator
 * Contains:
 * - Welcome
 * - SignIn
 * - CreateAccount
 * - ForgotPassword
 */
import React from 'react';
import { TouchableOpacity } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ArrowLeft } from 'lucide-react-native';
import { AuthStackParamList } from './types';
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import SignInScreen from '../screens/auth/SignInScreen';
import CreateAccountScreen from '../screens/auth/CreateAccountScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import { COLORS, FONTS } from '../theme';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator initialRouteName="Welcome">
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SignIn"
        component={SignInScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CreateAccount"
        component={CreateAccountScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={({ navigation }) => ({
          title: 'Forgot Password',
          headerTitleAlign: 'center',
          headerTitleStyle: {
            fontFamily: FONTS.bold,
            fontSize: 17,
            color: COLORS.text,
          },
          headerStyle: { backgroundColor: '#FEF7E6' },
          headerShadowVisible: false,
          headerTintColor: COLORS.text,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('SignIn'))}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ paddingRight: 12, paddingVertical: 4 }}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <ArrowLeft size={22} color={COLORS.text} strokeWidth={2.2} />
            </TouchableOpacity>
          ),
        })}
      />
    </Stack.Navigator>
  );
}
