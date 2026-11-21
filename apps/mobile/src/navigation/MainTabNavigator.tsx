/**
 * Tab Navigator: MainTabNavigator
 * Reference: docs/design/mobile/02-home/dashboard_mobile.png
 * Features:
 * - Brand Deep Green bottom bar (#254e06)
 * - Raised circular Amber Scan button (#faab06)
 * - Crisp active indicator pills and status colors
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator, BottomTabBarButtonProps, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, Package, Bell, User, ScanBarcode } from 'lucide-react-native';
import { MainTabParamList } from './types';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import InventoryNavigator from './InventoryNavigator';
import ScanNavigator from './ScanNavigator';
import NotificationsScreen from '../screens/alerts/NotificationsScreen';
import ProfileNavigator from './ProfileNavigator';
import { COLORS, FONTS } from '../theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Custom Tab Bar Icons using lucide-react-native
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const color = focused ? COLORS.white : COLORS.tabBarInactive;

  if (name === 'Home') {
    return <LayoutDashboard size={20} color={color} strokeWidth={2} />;
  }

  if (name === 'Inventory') {
    return <Package size={20} color={color} strokeWidth={2} />;
  }

  if (name === 'Alerts') {
    return <Bell size={20} color={color} strokeWidth={2} />;
  }

  if (name === 'Profile') {
    return <User size={20} color={color} strokeWidth={2} />;
  }

  return null;
}

// Raised Center Scan Button for native Android TabBar
function ScanTabBarButton(props: BottomTabBarButtonProps) {
  const handlePress = (e: any) => {
    props.onPress?.(e);
  };

  return (
    <PlatformPressable
      {...props}
      onPress={handlePress}
      style={[
        props.style,
        styles.scanButtonContainer,
      ]}
      pressOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Scan Barcode or Add Stock"
    >
      <View style={styles.scanButtonCircle}>
        <ScanBarcode size={22} color="#181413" strokeWidth={2.2} />
        <Text style={styles.scanButtonLabel}>SCAN</Text>
      </View>
    </PlatformPressable>
  );
}

// Dedicated, reliable Web / iPhone PWA TabBar
// Separates the 52px icon/label row from the bottom safe-area spacer completely.
// Ensures tab labels are 100% visible, vertically centered, and never clipped.
function WebTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.webTabBarContainer}>
      <View style={styles.webTabBarRow}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const { options } = descriptors[route.key];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (route.name === 'ScanTab') {
              navigation.navigate('ScanTab', { screen: 'ScanChooser' });
              return;
            }

            if (route.name === 'InventoryTab' && isFocused) {
              navigation.navigate('InventoryTab', { screen: 'InventoryList' });
              return;
            }

            if (route.name === 'ProfileTab' && isFocused) {
              navigation.navigate('ProfileTab', { screen: 'Profile' });
              return;
            }

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          if (route.name === 'ScanTab') {
            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                style={styles.webScanButtonWrapper}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Scan Barcode or Add Stock"
              >
                <View style={styles.scanButtonCircle}>
                  <ScanBarcode size={22} color="#181413" strokeWidth={2.2} />
                  <Text style={styles.scanButtonLabel}>SCAN</Text>
                </View>
              </TouchableOpacity>
            );
          }

          let labelText = 'Home';
          let iconName = 'Home';
          if (route.name === 'InventoryTab') {
            labelText = 'Inventory';
            iconName = 'Inventory';
          } else if (route.name === 'AlertsTab') {
            labelText = 'Alerts';
            iconName = 'Alerts';
          } else if (route.name === 'ProfileTab') {
            labelText = 'Profile';
            iconName = 'Profile';
          }

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.webTabItem}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={labelText}
            >
              <TabIcon name={iconName} focused={isFocused} />
              <Text
                style={[
                  styles.webTabLabel,
                  { color: isFocused ? COLORS.white : COLORS.tabBarInactive },
                ]}
                numberOfLines={1}
              >
                {labelText}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {/* Reserved bottom safe-area spacer for iPhone Safari / Home Screen PWA */}
      <View style={styles.webSafeAreaSpacer} />
    </View>
  );
}

export default function MainTabNavigator() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);
  const barHeight = 54 + bottomPadding;

  useEffect(() => {
    if (Platform.OS === 'web') {
      console.log('[ShelfSafe PWA Diagnostic] 3. MainTabNavigator mounted, initial tab: HomeTab');
    }
  }, []);

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      tabBar={Platform.OS === 'web' ? (props: BottomTabBarProps) => <WebTabBar {...props} /> : undefined}
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            paddingBottom: bottomPadding,
            height: barHeight,
          },
        ],
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 2,
        },
        tabBarActiveTintColor: COLORS.white,
        tabBarInactiveTintColor: COLORS.tabBarInactive,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={DashboardScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon name="Home" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="InventoryTab"
        component={InventoryNavigator}
        options={{
          title: 'Inventory',
          tabBarIcon: ({ focused }) => <TabIcon name="Inventory" focused={focused} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            if (navigation.isFocused()) {
              navigation.navigate('InventoryTab', { screen: 'InventoryList' });
            }
          },
        })}
      />
      <Tab.Screen
        name="ScanTab"
        component={ScanNavigator}
        initialParams={{ screen: 'ScanChooser' }}
        options={{
          title: 'Scan',
          tabBarButton: (props) => <ScanTabBarButton {...props} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            if (Platform.OS === 'web') {
              const state = navigation.getState();
              console.log('[ShelfSafe PWA Diagnostic] 3. Navigation state before tabPress dispatch:', {
                isFocused: navigation.isFocused(),
                index: state?.index,
                activeRoute: state?.routes?.[state?.index]?.name,
                routes: state?.routes?.map((r: any) => r.name),
              });
            }
            if (navigation.isFocused()) {
              navigation.navigate('ScanTab', { screen: 'ScanChooser' });
            }
            if (Platform.OS === 'web') {
              setTimeout(() => {
                const newState = navigation.getState();
                console.log('[ShelfSafe PWA Diagnostic] 3. Navigation state after tabPress dispatch:', {
                  index: newState?.index,
                  activeRoute: newState?.routes?.[newState?.index]?.name,
                  routes: newState?.routes?.map((r: any) => r.name),
                });
              }, 50);
            }
          },
        })}
      />
      <Tab.Screen
        name="AlertsTab"
        component={NotificationsScreen}
        options={{
          title: 'Alerts',
          tabBarIcon: ({ focused }) => <TabIcon name="Alerts" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileNavigator}
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="Profile" focused={focused} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            if (navigation.isFocused()) {
              navigation.navigate('ProfileTab', { screen: 'Profile' });
            }
          },
        })}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.tabBarBg,
    borderTopWidth: 0,
    paddingTop: 6,
    elevation: 0,
    shadowOpacity: 0,
    overflow: 'visible',
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    marginTop: 2,
  },
  scanButtonContainer: {
    position: 'relative',
    top: -16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  webTabBarContainer: {
    backgroundColor: COLORS.tabBarBg,
    width: '100%',
    overflow: 'visible',
    borderTopWidth: 0,
    zIndex: 100,
  },
  webTabBarRow: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    overflow: 'visible',
  },
  webTabItem: {
    flex: 1,
    height: 52,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  webTabLabel: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    marginTop: 2,
    textAlign: 'center',
  },
  webScanButtonWrapper: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 110,
  },
  webSafeAreaSpacer: {
    height: ('env(safe-area-inset-bottom, 0px)' as any),
  },
  scanButtonCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.amber,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.tabBarBg,
    transform: [{ translateY: -14 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  scanButtonLabel: {
    fontSize: 8,
    fontWeight: '900',
    fontFamily: FONTS.black,
    color: '#181413',
    marginTop: 1,
    letterSpacing: 0.5,
  },
});
