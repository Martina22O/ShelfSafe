export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  ForgotPassword: undefined;
};

export type InventoryStackParamList = {
  InventoryList: undefined;
  ProductDetail: { productId?: string; productName?: string } | undefined;
  EditProduct: { productId: string };
};

export type ScanStackParamList = {
  ScanChooser: undefined;
  ScanBarcode: { mode: 'add' | 'sell' };
  TypeBarcode: { mode: 'add' | 'sell' } | undefined;
  AddStockForm: { productId?: string; barcode?: string; productName?: string } | undefined;
  NewProduct: { barcode?: string; fromScan?: boolean } | undefined;
  AddStockDone: { units?: number; batchCode?: string; expiryDate?: string; productId?: string } | undefined;
  SaleList: undefined;
  ConfirmSale: undefined;
  SaleDone:
    | {
        count?: number;
        scanIds?: string[];
        items?: Array<{ productId: string; name: string; quantity: number }>;
      }
    | undefined;
  History: undefined;
};

export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  EditStore: undefined;
  ChangePassword: undefined;
  NotificationPreferences: undefined;
  SyncStatus: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  InventoryTab: { screen?: keyof InventoryStackParamList; params?: { productId?: string; productName?: string } } | undefined;
  ScanTab: undefined;
  AlertsTab: undefined;
  ProfileTab: undefined;
};
