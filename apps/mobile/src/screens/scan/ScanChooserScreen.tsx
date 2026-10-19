/**
 * Screen: ScanChooserScreen
 * Elements:
 * - Screen Name: Scan
 * - Subtitle ("Choose an action to proceed with scanning")
 * - "Add stock" button (navigates to ScanBarcode with mode = 'add')
 * - "Record sold items" button (navigates to ScanBarcode with mode = 'sell')
 * - "View History" button (navigates to History)
 */
import React from 'react';
import { View, Text, Button } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ScanStackParamList, 'ScanChooser'>;

export default function ScanChooserScreen({ navigation }: Props) {
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Scan</Text>
      <Text style={{ color: 'gray', marginTop: 4 }}>
        Choose an action to proceed with scanning
      </Text>

      <View style={{ marginTop: 32, gap: 16 }}>
        <Button
          title="Add stock"
          onPress={() => navigation.navigate('ScanBarcode', { mode: 'add' })}
        />
        <Button
          title="Record sold items"
          onPress={() => navigation.navigate('ScanBarcode', { mode: 'sell' })}
        />
        <Button
          title="View History"
          onPress={() => navigation.navigate('History')}
          color="gray"
        />
      </View>
    </View>
  );
}
