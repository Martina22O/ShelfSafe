/**
 * Screen: NotificationsScreen
 * Reference: docs/design/04-notifications.png
 * Elements:
 * - Screen Name: Notifications
 * - Subtitle ("Updates automatically when stock changes on any device.")
 * - Value at risk cards:
 *   - "Estimated value at risk – expired" (₱572.00)
 *   - "Estimated value at risk – near expiry" (₱156.00)
 * - Filter pills ("All (2)", "Low Stock (1)", "Near Expiry (1)", "Expired (2)")
 * - Alert cards list (Expired batch, Near expiry, Low stock)
 */
import React, { useState } from 'react';
import { View, Text, Button, ScrollView } from 'react-native';

const FILTERS = ['All (2)', 'Low Stock (1)', 'Near Expiry (1)', 'Expired (2)'];

export default function NotificationsScreen() {
  const [selectedFilter, setSelectedFilter] = useState('All (2)');

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Notifications</Text>
      <Text style={{ color: 'gray', marginTop: 4 }}>
        Updates automatically when stock changes on any device.
      </Text>

      {/* Value at Risk Cards */}
      <View style={{ gap: 12, marginTop: 16 }}>
        <View style={{ borderWidth: 1, borderColor: '#f8d7da', padding: 16 }}>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#721c24' }}>
            ₱572.00
          </Text>
          <Text style={{ color: '#721c24', marginTop: 4 }}>
            Estimated value at risk – expired
          </Text>
        </View>

        <View style={{ borderWidth: 1, borderColor: '#fff3cd', padding: 16 }}>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#856404' }}>
            ₱156.00
          </Text>
          <Text style={{ color: '#856404', marginTop: 4 }}>
            Estimated value at risk – near expiry
          </Text>
        </View>
      </View>

      {/* Filter Pills */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 20 }}>
        {FILTERS.map((f) => (
          <Button
            key={f}
            title={selectedFilter === f ? `• ${f}` : f}
            onPress={() => setSelectedFilter(f)}
          />
        ))}
      </View>

      {/* Alert Items List */}
      <View style={{ marginTop: 20, gap: 12, marginBottom: 40 }}>
        {/* Item 1 */}
        <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: 'bold' }}>Bear Brand Milk 300ml</Text>
            <Text style={{ color: '#d9534f' }}>[Expired batch]</Text>
          </View>
          <Text style={{ marginTop: 4 }}>
            Batch B-AB8889BB expired 14 day(s) ago with 8 unit(s) left.
          </Text>
          <Text style={{ color: 'gray', fontSize: 12, marginTop: 2 }}>
            Expires Sep 28, 2026 • Est. ₱272.00 at ₱34.00/unit
          </Text>
        </View>

        {/* Item 2 */}
        <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: 'bold' }}>Coca-Cola 1.5L</Text>
            <Text style={{ color: '#d9534f' }}>[Expired batch]</Text>
          </View>
          <Text style={{ marginTop: 4 }}>
            Batch B-EB318AA5 expired 6 day(s) ago with 4 unit(s) left.
          </Text>
          <Text style={{ color: 'gray', fontSize: 12, marginTop: 2 }}>
            Expires Oct 6, 2026 • Est. ₱300.00 at ₱75.00/unit
          </Text>
        </View>

        {/* Item 3 */}
        <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: 'bold' }}>Skyflakes Crackers 250g</Text>
            <Text style={{ color: '#f0ad4e' }}>[Near Expiry]</Text>
          </View>
          <Text style={{ marginTop: 4 }}>
            Batch B-99739E25 expires in 9 day(s) with 3 unit(s) left.
          </Text>
          <Text style={{ color: 'gray', fontSize: 12, marginTop: 2 }}>
            Expires Oct 21, 2026 • Est. ₱102.00 at ₱34.00/unit
          </Text>
        </View>

        {/* Item 4 */}
        <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: 'bold' }}>Skyflakes Crackers 250g</Text>
            <Text style={{ color: '#f0ad4e' }}>[Low Stock]</Text>
          </View>
          <Text style={{ marginTop: 4 }}>
            Only 3 sellable unit(s) left (threshold 10).
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
