/**
 * Screen: DashboardScreen
 * Reference: docs/design/02-dashboard.png
 * Elements:
 * - Screen Name: Dashboard
 * - Dynamic greeting reading name/email from signed-in user ("Hello, {name}!")
 * - Subtitle ("Start keeping your shelves in check.")
 * - "View Inventory" CTA button
 * - Stock Overview cards:
 *   1. Total Products
 *   2. Total Units
 *   3. Low Stock
 *   4. Near Expiry
 *   5. Expired
 * - Unit Sold metrics with Daily/Weekly/Monthly selector (Today, This week, This month)
 * - Important Alerts preview with "See all" link
 * - Most-stocked list
 * - Most-sold list
 * - Least-sold list
 * - Low Stock section
 * - Near Expiry section
 * - Expired section
 */
import React, { useState, useEffect } from 'react';
import { View, Text, Button, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../services/supabase';

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const [displayName, setDisplayName] = useState('User');
  const [period, setPeriod] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name =
          user.user_metadata?.name ||
          (user.email ? user.email.split('@')[0] : 'User');
        setDisplayName(name);
      }
    });
  }, []);

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Dashboard</Text>

      {/* Greeting Header */}
      <View style={{ marginTop: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold' }}>
          Hello, {displayName}!
        </Text>
        <Text style={{ color: 'gray', marginTop: 4 }}>
          Start keeping your shelves in check.
        </Text>
      </View>

      {/* CTA Button */}
      <View style={{ marginTop: 16 }}>
        <Button
          title="View Inventory"
          onPress={() => navigation.navigate('InventoryTab')}
        />
      </View>

      {/* Stock Overview Cards */}
      <View style={{ marginTop: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Stock Overview</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, minWidth: 140 }}>
            <Text style={{ color: 'gray' }}>Total Products</Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold' }}>7</Text>
          </View>
          <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, minWidth: 140 }}>
            <Text style={{ color: 'gray' }}>Total Units</Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold' }}>206</Text>
          </View>
          <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, minWidth: 90 }}>
            <Text style={{ color: 'gray' }}>Low Stock</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>1</Text>
          </View>
          <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, minWidth: 90 }}>
            <Text style={{ color: 'gray' }}>Near Expiry</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>2</Text>
          </View>
          <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, minWidth: 90 }}>
            <Text style={{ color: 'gray' }}>Expired</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>1</Text>
          </View>
        </View>
      </View>

      {/* Unit Sold Metrics */}
      <View style={{ marginTop: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Unit Sold</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Button
            title={period === 'Daily' ? '• Daily' : 'Daily'}
            onPress={() => setPeriod('Daily')}
          />
          <Button
            title={period === 'Weekly' ? '• Weekly' : 'Weekly'}
            onPress={() => setPeriod('Weekly')}
          />
          <Button
            title={period === 'Monthly' ? '• Monthly' : 'Monthly'}
            onPress={() => setPeriod('Monthly')}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>0</Text>
            <Text style={{ color: 'gray' }}>Today</Text>
          </View>
          <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>0</Text>
            <Text style={{ color: 'gray' }}>This week</Text>
          </View>
          <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>0</Text>
            <Text style={{ color: 'gray' }}>This month</Text>
          </View>
        </View>
        <Text style={{ color: 'gray', marginTop: 4 }}>No sold items today</Text>
      </View>

      {/* Important Alerts */}
      <View style={{ marginTop: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Important alerts</Text>
          <Button title="See all" onPress={() => navigation.navigate('AlertsTab')} />
        </View>
        <View style={{ marginTop: 8, gap: 8 }}>
          <View style={{ borderWidth: 1, borderColor: '#f8d7da', padding: 8 }}>
            <Text style={{ fontWeight: 'bold', color: '#721c24' }}>Expired batch</Text>
            <Text>Bear Brand Milk 300ml</Text>
          </View>
          <View style={{ borderWidth: 1, borderColor: '#f8d7da', padding: 8 }}>
            <Text style={{ fontWeight: 'bold', color: '#721c24' }}>Expired batch</Text>
            <Text>Coca-Cola 1.5L</Text>
          </View>
          <View style={{ borderWidth: 1, borderColor: '#fff3cd', padding: 8 }}>
            <Text style={{ fontWeight: 'bold', color: '#856404' }}>Near expiry</Text>
            <Text>Skyflakes</Text>
          </View>
          <View style={{ borderWidth: 1, borderColor: '#fff3cd', padding: 8 }}>
            <Text style={{ fontWeight: 'bold', color: '#856404' }}>Low Stock</Text>
            <Text>Skyflakes</Text>
          </View>
        </View>
      </View>

      {/* Most-Stocked */}
      <View style={{ marginTop: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Most-stocked</Text>
        <View style={{ marginTop: 8, gap: 4 }}>
          <Text>• Lucky Me - 60 units</Text>
          <Text>• Biogesic Paracetamol - 50 units</Text>
          <Text>• Coca-Cola 1.5L - 34 units</Text>
          <Text>• Century Tuna - 24 units</Text>
          <Text>• Bear Brand Milk 300ml - 20 units</Text>
        </View>
      </View>

      {/* Most-Sold */}
      <View style={{ marginTop: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Most-sold</Text>
        <Text style={{ color: 'gray', marginTop: 4 }}>No sales yet.</Text>
      </View>

      {/* Least-Sold */}
      <View style={{ marginTop: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Least sold</Text>
        <Text style={{ color: 'gray', marginTop: 4 }}>No sales yet.</Text>
      </View>

      {/* Low Stock Section */}
      <View style={{ marginTop: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Low Stock</Text>
        <Text style={{ marginTop: 4 }}>Skyflakes - 3 left</Text>
      </View>

      {/* Near Expiry Section */}
      <View style={{ marginTop: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Near Expiry</Text>
        <Text style={{ marginTop: 4 }}>Skyflakes - 3 units</Text>
      </View>

      {/* Expired Section */}
      <View style={{ marginTop: 24, marginBottom: 40 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Expired</Text>
        <Text style={{ marginTop: 4 }}>• Bear Brand Milk 300ml</Text>
        <Text style={{ marginTop: 2 }}>• Coca-Cola</Text>
      </View>
    </ScrollView>
  );
}
