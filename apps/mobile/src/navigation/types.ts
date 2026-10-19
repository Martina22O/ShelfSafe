export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  ForgotPassword: undefined;
};

export type InventoryStackParamList = {
  InventoryList: undefined;
  ProductDetail: { productId?: string; productName?: string } | undefined;
};

export type ScanStackParamList = {
  ScanChooser: undefined;
  ScanBarcode: { mode: 'add' | 'sell' };
  TypeBarcode: { mode: 'add' | 'sell' } | undefined;
  AddStockForm: { barcode?: string; productName?: string } | undefined;
  NewProduct: { barcode?: string } | undefined;
  AddStockDone: { units?: number; batchCode?: string; expiryDate?: string } | undefined;
  SaleList: undefined;
  ConfirmSale: undefined;
  SaleDone: { count?: number } | undefined;
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
  InventoryTab: undefined;
  ScanTab: undefined;
  AlertsTab: undefined;
  ProfileTab: undefined;
};
