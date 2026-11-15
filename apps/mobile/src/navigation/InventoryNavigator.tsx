/**
 * Stack Navigator: InventoryNavigator
 * Contains:
 * - InventoryList
 * - ProductDetail
 */
import React from 'react';
import { TouchableOpacity } from 'react-native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft } from 'lucide-react-native';
import { InventoryStackParamList } from './types';
import InventoryListScreen from '../screens/inventory/InventoryListScreen';
import ProductDetailScreen from '../screens/inventory/ProductDetailScreen';
import EditProductScreen from '../screens/inventory/EditProductScreen';

import { COLORS, FONTS } from '../theme';

const Stack = createNativeStackNavigator<InventoryStackParamList>();

export default function InventoryNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="InventoryList"
      screenOptions={({ navigation }: { navigation: NativeStackNavigationProp<InventoryStackParamList> }) => ({
        headerTitleAlign: 'center',
        headerTitleStyle: {
          fontFamily: FONTS.bold,
          fontSize: 16,
          color: COLORS.text,
        },
        headerStyle: { backgroundColor: '#FEF7E6' },
        headerShadowVisible: false,
        headerTintColor: COLORS.text,
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('InventoryList'))}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ paddingRight: 12, paddingVertical: 4 }}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ArrowLeft size={22} color={COLORS.text} strokeWidth={2.2} />
          </TouchableOpacity>
        ),
      })}
    >
      <Stack.Screen
        name="InventoryList"
        component={InventoryListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{
          title: 'Product Details',
        }}
      />
      <Stack.Screen
        name="EditProduct"
        component={EditProductScreen}
        options={{ title: 'Edit Product' }}
      />
    </Stack.Navigator>
  );
}
