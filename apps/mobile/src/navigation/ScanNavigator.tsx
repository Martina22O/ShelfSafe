/**
 * Stack Navigator: ScanNavigator
 * Contains:
 * - ScanChooser
 * - ScanBarcode
 * - TypeBarcode
 * - AddStockForm
 * - NewProduct
 * - AddStockDone
 * - SaleList
 * - ConfirmSale
 * - SaleDone
 * - History
 */
import React from 'react';
import { TouchableOpacity, Platform } from 'react-native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft } from 'lucide-react-native';
import { ScanStackParamList } from './types';
import ScanChooserScreen from '../screens/scan/ScanChooserScreen';
import ScanBarcodeScreen from '../screens/scan/ScanBarcodeScreen';
import TypeBarcodeScreen from '../screens/scan/TypeBarcodeScreen';
import AddStockFormScreen from '../screens/scan/AddStockFormScreen';
import NewProductScreen from '../screens/scan/NewProductScreen';
import AddStockDoneScreen from '../screens/scan/AddStockDoneScreen';
import SaleListScreen from '../screens/scan/SaleListScreen';
import ConfirmSaleScreen from '../screens/scan/ConfirmSaleScreen';
import SaleDoneScreen from '../screens/scan/SaleDoneScreen';
import HistoryScreen from '../screens/scan/HistoryScreen';
import { COLORS, FONTS } from '../theme';

const Stack = createNativeStackNavigator<ScanStackParamList>();

export default function ScanNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="ScanChooser"
      screenOptions={({ navigation }: { navigation: NativeStackNavigationProp<ScanStackParamList> }) => ({
        headerTitleAlign: 'center',
        headerTitleStyle: {
          fontFamily: FONTS.bold,
          fontSize: 17,
          color: COLORS.text,
        },
        headerStyle: {
          backgroundColor: '#FDF7E3',
          ...(Platform.OS === 'web'
            ? { height: 'calc(44px + env(safe-area-inset-top, 0px))' as any }
            : {}),
        },
        headerStatusBarHeight:
          Platform.OS === 'web'
            ? ('env(safe-area-inset-top, 0px)' as any)
            : undefined,
        headerShadowVisible: false,
        headerTintColor: COLORS.text,
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('ScanChooser'))}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ paddingRight: 12, paddingVertical: 4, justifyContent: 'center' }}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ArrowLeft size={22} color={COLORS.text} strokeWidth={2.2} />
          </TouchableOpacity>
        ),
      })}
    >
      <Stack.Screen
        name="ScanChooser"
        component={ScanChooserScreen}
        options={{
          title: 'Scan',
          headerLeft: () => null,
          headerStyle: {
            backgroundColor: '#FEF7E6',
            ...(Platform.OS === 'web'
              ? { height: 'calc(44px + env(safe-area-inset-top, 0px))' as any }
              : {}),
          },
        }}
      />
      <Stack.Screen
        name="ScanBarcode"
        component={ScanBarcodeScreen}
        options={({ route }) => ({
          title:
            route.params?.mode === 'add'
              ? 'Scan Barcode (Add Stock)'
              : 'Scan Barcode (Sell)',
          headerStyle: {
            backgroundColor: '#FDF7E3',
            ...(Platform.OS === 'web'
              ? { height: 'calc(44px + env(safe-area-inset-top, 0px))' as any }
              : {}),
          },
        })}
      />
      <Stack.Screen
        name="TypeBarcode"
        component={TypeBarcodeScreen}
        options={({ route }) => ({
          title:
            route.params?.mode === 'add'
              ? 'Type Barcode (Add Stock)'
              : 'Type Barcode (Sell)',
          headerStyle: {
            backgroundColor: '#FDF7E3',
            ...(Platform.OS === 'web'
              ? { height: 'calc(44px + env(safe-area-inset-top, 0px))' as any }
              : {}),
          },
        })}
      />
      <Stack.Screen
        name="AddStockForm"
        component={AddStockFormScreen}
        options={{
          title: 'Add Stock Batch',
          headerStyle: { backgroundColor: '#FDF7E3' },
        }}
      />
      <Stack.Screen
        name="NewProduct"
        component={NewProductScreen}
        options={{ title: 'New Product' }}
      />
      <Stack.Screen
        name="AddStockDone"
        component={AddStockDoneScreen}
        options={{ title: 'Stock Added', headerBackVisible: false, headerLeft: () => null }}
      />
      <Stack.Screen
        name="SaleList"
        component={SaleListScreen}
        options={{
          title: 'Sale List',
          headerStyle: { backgroundColor: '#FDF7E3' },
        }}
      />
      <Stack.Screen
        name="ConfirmSale"
        component={ConfirmSaleScreen}
        options={{ title: 'Review Sale', headerBackVisible: false, headerLeft: () => null }}
      />
      <Stack.Screen
        name="SaleDone"
        component={SaleDoneScreen}
        options={{ title: 'Sale Done', headerBackVisible: false, headerLeft: () => null }}
      />
      <Stack.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: 'Sales History' }}
      />
    </Stack.Navigator>
  );
}
