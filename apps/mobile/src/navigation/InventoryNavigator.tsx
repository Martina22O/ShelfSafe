/**
 * Stack Navigator: InventoryNavigator
 * Contains:
 * - InventoryList
 * - ProductDetail
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { InventoryStackParamList } from './types';
import InventoryListScreen from '../screens/inventory/InventoryListScreen';
import ProductDetailScreen from '../screens/inventory/ProductDetailScreen';

const Stack = createNativeStackNavigator<InventoryStackParamList>();

export default function InventoryNavigator() {
  return (
    <Stack.Navigator initialRouteName="InventoryList">
      <Stack.Screen
        name="InventoryList"
        component={InventoryListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{ title: 'Product Details' }}
      />
    </Stack.Navigator>
  );
}
