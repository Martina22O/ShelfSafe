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
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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

const Stack = createNativeStackNavigator<ScanStackParamList>();

export default function ScanNavigator() {
  return (
    <Stack.Navigator initialRouteName="ScanChooser">
      <Stack.Screen
        name="ScanChooser"
        component={ScanChooserScreen}
        options={{ title: 'Scan' }}
      />
      <Stack.Screen
        name="ScanBarcode"
        component={ScanBarcodeScreen}
        options={({ route }) => ({
          title:
            route.params?.mode === 'add'
              ? 'Scan Barcode (Add Stock)'
              : 'Scan Barcode (Sell)',
        })}
      />
      <Stack.Screen
        name="TypeBarcode"
        component={TypeBarcodeScreen}
        options={{ title: 'Type Barcode' }}
      />
      <Stack.Screen
        name="AddStockForm"
        component={AddStockFormScreen}
        options={{ title: 'Add Stock' }}
      />
      <Stack.Screen
        name="NewProduct"
        component={NewProductScreen}
        options={{ title: 'New Product' }}
      />
      <Stack.Screen
        name="AddStockDone"
        component={AddStockDoneScreen}
        options={{ title: 'Stock Added', headerBackVisible: false }}
      />
      <Stack.Screen
        name="SaleList"
        component={SaleListScreen}
        options={{ title: 'Items for Sale' }}
      />
      <Stack.Screen
        name="ConfirmSale"
        component={ConfirmSaleScreen}
        options={{ title: 'Confirm Sale' }}
      />
      <Stack.Screen
        name="SaleDone"
        component={SaleDoneScreen}
        options={{ title: 'Sale Done', headerBackVisible: false }}
      />
      <Stack.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: 'Sales History' }}
      />
    </Stack.Navigator>
  );
}
