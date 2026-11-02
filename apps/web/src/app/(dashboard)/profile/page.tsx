'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase/client';
import { useStoreSettings } from '../../../context/StoreSettingsContext';
import { saveStoreDetails, saveNearExpiryDays } from '../../../lib/storeSettings';
import { isDatabaseError, formatErrorMessage } from '../../../lib/error';
import { ConfirmModal } from '../../../components/ConfirmModal';

const QUICK_CHOICES = [3, 7, 14, 30] as const;

function mapAuthPasswordError(error: unknown): string {
  if (!error) return 'Failed to update password';
  const msg =
    typeof error === 'string'
      ? error
      : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : '';
  const lower = msg.toLowerCase();
  if (
    lower.includes('weak') ||
    lower.includes('at least') ||
    lower.includes('pwned') ||
    lower.includes('security')
  ) {
    return 'Password is too weak. Please choose a stronger password with at least 8 characters.';
  }
  if (
    lower.includes('same') ||
    lower.includes('different') ||
    lower.includes('should be different')
  ) {
    return 'New password cannot be the same as your current password.';
  }
  if (
    lower.includes('rate limit') ||
    lower.includes('too many') ||
    lower.includes('requests')
  ) {
    return 'Too many attempts. Please wait a few moments and try again.';
  }
  if (
    lower.includes('invalid') ||
    lower.includes('credentials') ||
    lower.includes('grant')
  ) {
    return 'Current password is incorrect';
  }
  if (isDatabaseError(error)) {
    return formatErrorMessage(error);
  }
  return 'Not sure if this was saved. Reload the page and check';
}

function validateContactNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null; // optional
  if (trimmed.length > 30) {
    return 'Contact number cannot exceed 30 characters';
  }
  // Allow only digits, spaces, +, -, (, )
  if (!/^[0-9\s+\-()]+$/.test(trimmed)) {
    return 'Contact number can only contain digits, spaces, +, -, and parentheses ()';
  }
  return null;
}

// -------------------------------------------------------------
// SUB-COMPONENT: Edit Name Section
// -------------------------------------------------------------
function EditNameSection({
  initialName,
  userEmail,
  isSavingAny,
  onSaveStart,
  onSaveEnd,
  onNameSaved,
}: {
  initialName: string;
  userEmail: string;
  isSavingAny: boolean;
  onSaveStart: () => void;
  onSaveEnd: () => void;
  onNameSaved: (newName: string) => void;
}) {
  const [nameInput, setNameInput] = useState(initialName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleOpenConfirm = () => {
    setNameError(null);
    setNameSuccess(null);
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setNameError('Name cannot be empty');
      return;
    }
    if (trimmed.length > 100) {
      setNameError('Name cannot exceed 100 characters');
      return;
    }
    setShowConfirm(true);
  };

  const handleExecuteSave = async () => {
    setShowConfirm(false);
    setSavingName(true);
    onSaveStart();
    setNameError(null);
    setNameSuccess(null);

    const trimmed = nameInput.trim();

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const currentMetadata = user?.user_metadata || {};

      const { error } = await supabase.auth.updateUser({
        data: {
          ...currentMetadata,
          name: trimmed,
        },
      });

      if (error) {
        if (isDatabaseError(error)) {
          setNameError(formatErrorMessage(error));
        } else {
          setNameError('Not sure if this was saved. Reload the page and check');
        }
        return;
      }

      setNameInput(trimmed);
      setNameSuccess('Name updated successfully');
      onNameSaved(trimmed);
    } catch (err: unknown) {
      if (isDatabaseError(err)) {
        setNameError(formatErrorMessage(err));
      } else {
        setNameError('Not sure if this was saved. Reload the page and check');
      }
    } finally {
      setSavingName(false);
      onSaveEnd();
    }
  };

  return (
    <section className="bg-white border border-gray-200 rounded p-5 shadow-sm space-y-4">
      <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">
        Account
      </h2>

      {nameSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded">
          {nameSuccess}
        </div>
      )}
      {nameError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded">
          {nameError}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label
            htmlFor="user-display-name"
            className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1"
          >
            Display Name
          </label>
          <input
            id="user-display-name"
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            disabled={savingName || isSavingAny}
            maxLength={100}
            placeholder="Enter your name"
            className="w-full max-w-md px-3 py-2 text-sm border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100 disabled:text-gray-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Current display name:{' '}
            <span className="font-medium text-gray-800">
              {initialName || 'Not set'}
            </span>
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
            Email Address
          </label>
          <input
            type="email"
            value={userEmail}
            disabled
            readOnly
            className="w-full max-w-md px-3 py-2 text-sm border border-gray-200 bg-gray-50 text-gray-500 rounded cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 mt-1">
            Email changes are not available yet.
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleOpenConfirm}
            disabled={
              savingName ||
              isSavingAny ||
              !nameInput.trim() ||
              nameInput.trim() === initialName
            }
            className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {savingName ? 'Saving name...' : 'Save Name'}
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirm}
        title="Update Name"
        message={`Are you sure you want to change your display name to "${nameInput.trim()}"?`}
        confirmText="Confirm"
        cancelText="Cancel"
        isSaving={savingName}
        onConfirm={handleExecuteSave}
        onCancel={() => !savingName && setShowConfirm(false)}
      />
    </section>
  );
}

// -------------------------------------------------------------
// SUB-COMPONENT: Store Details Section
// -------------------------------------------------------------
function StoreDetailsSection({
  storeName,
  contactNumber,
  settingsLoading,
  settingsError,
  isSavingAny,
  onSaveStart,
  onSaveEnd,
  onRefreshSettings,
  onReloadSettings,
}: {
  storeName: string | null;
  contactNumber: string | null;
  settingsLoading: boolean;
  settingsError: string | null;
  isSavingAny: boolean;
  onSaveStart: () => void;
  onSaveEnd: () => void;
  onRefreshSettings: () => Promise<void>;
  onReloadSettings: () => Promise<void>;
}) {
  const [storeNameInput, setStoreNameInput] = useState(storeName || '');
  const [contactNumberInput, setContactNumberInput] = useState(contactNumber || '');
  const [storeError, setStoreError] = useState<string | null>(null);
  const [storeSuccess, setStoreSuccess] = useState<string | null>(null);
  const [savingStore, setSavingStore] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleOpenConfirm = () => {
    setStoreError(null);
    setStoreSuccess(null);

    const trimmedStoreName = storeNameInput.trim();
    if (trimmedStoreName.length > 100) {
      setStoreError('Store name cannot exceed 100 characters');
      return;
    }

    const contactErr = validateContactNumber(contactNumberInput);
    if (contactErr) {
      setStoreError(contactErr);
      return;
    }

    setShowConfirm(true);
  };

  const handleExecuteSave = async () => {
    setShowConfirm(false);
    setSavingStore(true);
    onSaveStart();
    setStoreError(null);
    setStoreSuccess(null);

    const trimmedStoreName = storeNameInput.trim() || null;
    const trimmedContact = contactNumberInput.trim() || null;

    try {
      const res = await saveStoreDetails({
        storeName: trimmedStoreName,
        contactNumber: trimmedContact,
      });

      if (res.kind === 'db_error') {
        setStoreError(res.message);
        return;
      }

      if (res.kind === 'network_error') {
        setStoreError('Not sure if this was saved. Reload the page and check');
        await onReloadSettings();
        return;
      }

      await onRefreshSettings();
      setStoreSuccess('Store details updated successfully');
    } catch (err: unknown) {
      if (isDatabaseError(err)) {
        setStoreError(formatErrorMessage(err));
      } else {
        setStoreError('Not sure if this was saved. Reload the page and check');
        await onReloadSettings();
      }
    } finally {
      setSavingStore(false);
      onSaveEnd();
    }
  };

  return (
    <section className="bg-white border border-gray-200 rounded p-5 shadow-sm space-y-4">
      <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">
        Store Details
      </h2>

      {storeSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded">
          {storeSuccess}
        </div>
      )}
      {storeError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded">
          {storeError}
        </div>
      )}

      {settingsError ? (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded flex items-center justify-between">
          <span>Failed to load store settings: {settingsError}</span>
          <button
            type="button"
            onClick={() => onReloadSettings()}
            className="underline font-semibold ml-2 text-red-900"
          >
            Retry
          </button>
        </div>
      ) : settingsLoading ? (
        <p className="text-xs text-gray-500">Loading store details...</p>
      ) : (
        <div className="space-y-3">
          <div>
            <label
              htmlFor="store-name-input"
              className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1"
            >
              Store Name (Optional)
            </label>
            <input
              id="store-name-input"
              type="text"
              value={storeNameInput}
              onChange={(e) => setStoreNameInput(e.target.value)}
              disabled={savingStore || isSavingAny}
              maxLength={100}
              placeholder="Not set yet"
              className="w-full max-w-md px-3 py-2 text-sm border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Current:{' '}
              <span className="font-medium text-gray-800">
                {storeName || 'Not set yet'}
              </span>
            </p>
          </div>

          <div>
            <label
              htmlFor="store-contact-number"
              className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1"
            >
              Contact Number (Optional)
            </label>
            <input
              id="store-contact-number"
              type="text"
              value={contactNumberInput}
              onChange={(e) => setContactNumberInput(e.target.value)}
              disabled={savingStore || isSavingAny}
              maxLength={30}
              placeholder="Not set yet"
              className="w-full max-w-md px-3 py-2 text-sm border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Current:{' '}
              <span className="font-medium text-gray-800">
                {contactNumber || 'Not set yet'}
              </span>
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Allowed: digits, spaces, +, -, and parentheses (). Max 30 characters.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleOpenConfirm}
              disabled={
                savingStore ||
                isSavingAny ||
                Boolean(settingsError) ||
                (storeNameInput.trim() === (storeName || '') &&
                  contactNumberInput.trim() === (contactNumber || ''))
              }
              className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {savingStore ? 'Saving details...' : 'Save Store Details'}
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirm}
        title="Update Store Details"
        message="Are you sure you want to update your store details?"
        confirmText="Confirm"
        cancelText="Cancel"
        isSaving={savingStore}
        onConfirm={handleExecuteSave}
        onCancel={() => !savingStore && setShowConfirm(false)}
      />
    </section>
  );
}

// -------------------------------------------------------------
// SUB-COMPONENT: Notification Preferences Section
// -------------------------------------------------------------
function NotificationPreferencesSection({
  nearExpiryDays,
  settingsLoading,
  settingsError,
  isSavingAny,
  onSaveStart,
  onSaveEnd,
  onRefreshSettings,
  onReloadSettings,
}: {
  nearExpiryDays: number | null;
  settingsLoading: boolean;
  settingsError: string | null;
  isSavingAny: boolean;
  onSaveStart: () => void;
  onSaveEnd: () => void;
  onRefreshSettings: () => Promise<void>;
  onReloadSettings: () => Promise<void>;
}) {
  const [daysInput, setDaysInput] = useState(
    nearExpiryDays !== null ? String(nearExpiryDays) : ''
  );
  const [expiryError, setExpiryError] = useState<string | null>(null);
  const [expirySuccess, setExpirySuccess] = useState<string | null>(null);
  const [savingExpiry, setSavingExpiry] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const trimmedDays = daysInput.trim();
  const isWholeNumber = /^\d+$/.test(trimmedDays);
  const parsedDays = isWholeNumber ? parseInt(trimmedDays, 10) : NaN;
  const isExpiryValid = !isNaN(parsedDays) && parsedDays >= 1 && parsedDays <= 60;
  const isExpiryUnchanged =
    nearExpiryDays !== null && parsedDays === nearExpiryDays;
  const canSaveExpiry =
    isExpiryValid &&
    !isExpiryUnchanged &&
    !savingExpiry &&
    !isSavingAny &&
    !settingsLoading &&
    !settingsError &&
    nearExpiryDays !== null;

  const handleOpenConfirm = () => {
    setExpiryError(null);
    setExpirySuccess(null);

    if (!isExpiryValid) {
      setExpiryError(
        'Near-expiry threshold must be a whole number between 1 and 60 days'
      );
      return;
    }

    setShowConfirm(true);
  };

  const handleExecuteSave = async () => {
    setShowConfirm(false);
    setSavingExpiry(true);
    onSaveStart();
    setExpiryError(null);
    setExpirySuccess(null);

    try {
      const res = await saveNearExpiryDays(parsedDays);

      if (res.kind === 'db_error') {
        setExpiryError(res.message);
        return;
      }

      if (res.kind === 'network_error') {
        setExpiryError('Not sure if this was saved. Reload the page and check');
        await onReloadSettings();
        return;
      }

      await onRefreshSettings();
      setExpirySuccess('Near-expiry window updated successfully');
    } catch (err: unknown) {
      if (isDatabaseError(err)) {
        setExpiryError(formatErrorMessage(err));
      } else {
        setExpiryError('Not sure if this was saved. Reload the page and check');
        await onReloadSettings();
      }
    } finally {
      setSavingExpiry(false);
      onSaveEnd();
    }
  };

  return (
    <section className="bg-white border border-gray-200 rounded p-5 shadow-sm space-y-4">
      <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">
        Notification Preferences
      </h2>

      <p className="text-xs text-gray-600">
        Products are marked near expiry when they expire within this many days.
      </p>

      {expirySuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded">
          {expirySuccess}
        </div>
      )}
      {expiryError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded">
          {expiryError}
        </div>
      )}

      {settingsError ? (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded flex items-center justify-between">
          <span>Failed to load near-expiry settings: {settingsError}</span>
          <button
            type="button"
            onClick={() => onReloadSettings()}
            className="underline font-semibold ml-2 text-red-900"
          >
            Retry
          </button>
        </div>
      ) : settingsLoading ? (
        <p className="text-xs text-gray-500">Loading near-expiry settings...</p>
      ) : (
        <div className="space-y-3">
          <div>
            <label
              htmlFor="near-expiry-days-input"
              className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1"
            >
              Near-Expiry Window (1 to 60 Days)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="near-expiry-days-input"
                type="number"
                min={1}
                max={60}
                value={daysInput}
                onChange={(e) => setDaysInput(e.target.value)}
                disabled={savingExpiry || isSavingAny}
                placeholder="e.g. 7"
                className="w-32 px-3 py-2 text-sm border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100"
              />
              <span className="text-sm text-gray-600">days</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Current threshold:{' '}
              <span className="font-medium text-gray-800">
                {nearExpiryDays !== null ? `${nearExpiryDays} days` : 'Not loaded'}
              </span>
            </p>
          </div>

          {/* Quick choices */}
          <div>
            <span className="text-xs text-gray-500 block mb-1">Quick choices:</span>
            <div className="flex items-center gap-2">
              {QUICK_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setDaysInput(String(choice))}
                  disabled={savingExpiry || isSavingAny}
                  className={`px-3 py-1 text-xs rounded border transition-colors ${
                    daysInput === String(choice)
                      ? 'bg-emerald-600 text-white border-emerald-600 font-semibold'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {choice} days
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleOpenConfirm}
              disabled={!canSaveExpiry}
              className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {savingExpiry ? 'Saving...' : 'Save Notification Preferences'}
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirm}
        title="Update Near-Expiry Window"
        message={`Are you sure you want to set the near-expiry window to ${parsedDays} days?`}
        confirmText="Confirm"
        cancelText="Cancel"
        isSaving={savingExpiry}
        onConfirm={handleExecuteSave}
        onCancel={() => !savingExpiry && setShowConfirm(false)}
      />
    </section>
  );
}

// -------------------------------------------------------------
// SUB-COMPONENT: Change Password Section
// -------------------------------------------------------------
function ChangePasswordSection({
  userEmail,
  isSavingAny,
  onSaveStart,
  onSaveEnd,
}: {
  userEmail: string;
  isSavingAny: boolean;
  onSaveStart: () => void;
  onSaveEnd: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleOpenConfirm = () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password');
      return;
    }
    if (!newPassword) {
      setPasswordError('Please enter a new password');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('New password cannot be the same as your current password');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setShowConfirm(true);
  };

  const handleExecuteSave = async () => {
    setShowConfirm(false);
    setSavingPassword(true);
    onSaveStart();
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const supabase = createClient();

      if (!userEmail) {
        setPasswordError('User email not found. Please refresh and try again.');
        return;
      }

      // Step 1: Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (signInError) {
        setPasswordError('Current password is incorrect');
        return;
      }

      // Step 2: Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setPasswordError(mapAuthPasswordError(updateError));
        return;
      }

      // Step 3: Clear all three password fields, show success message, stay on page
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess('Password changed successfully');
    } catch (err: unknown) {
      setPasswordError(mapAuthPasswordError(err));
    } finally {
      setSavingPassword(false);
      onSaveEnd();
    }
  };

  return (
    <section className="bg-white border border-gray-200 rounded p-5 shadow-sm space-y-4">
      <h2 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">
        Change Password
      </h2>

      {passwordSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded">
          {passwordSuccess}
        </div>
      )}
      {passwordError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded">
          {passwordError}
        </div>
      )}

      <div className="space-y-3 max-w-md">
        <div>
          <label
            htmlFor="current-password-input"
            className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1"
          >
            Current Password
          </label>
          <input
            id="current-password-input"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={savingPassword || isSavingAny}
            placeholder="Enter current password"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100"
          />
        </div>

        <div>
          <label
            htmlFor="new-password-input"
            className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1"
          >
            New Password
          </label>
          <input
            id="new-password-input"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={savingPassword || isSavingAny}
            placeholder="At least 8 characters"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100"
          />
        </div>

        <div>
          <label
            htmlFor="confirm-new-password-input"
            className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1"
          >
            Confirm New Password
          </label>
          <input
            id="confirm-new-password-input"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={savingPassword || isSavingAny}
            placeholder="Confirm new password"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100"
          />
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleOpenConfirm}
            disabled={
              savingPassword ||
              isSavingAny ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword
            }
            className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {savingPassword ? 'Updating password...' : 'Update Password'}
          </button>
        </div>

        <div className="pt-1">
          <p className="text-xs text-gray-500">
            Password reset by email is not available yet.
          </p>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirm}
        title="Change Password"
        message="Are you sure you want to change your password?"
        confirmText="Confirm"
        cancelText="Cancel"
        isSaving={savingPassword}
        onConfirm={handleExecuteSave}
        onCancel={() => !savingPassword && setShowConfirm(false)}
      />
    </section>
  );
}

// -------------------------------------------------------------
// SUB-COMPONENT: Sign Out Section
// -------------------------------------------------------------
function SignOutSection({
  isSavingAny,
  onClearStoreSettings,
}: {
  isSavingAny: boolean;
  onClearStoreSettings: () => void;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleExecuteSignOut = async () => {
    setShowConfirm(false);
    setSigningOut(true);
    try {
      const supabase = createClient();
      onClearStoreSettings();
      await supabase.auth.signOut();
      router.push('/sign-in');
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  };

  return (
    <section className="bg-white border border-red-200 rounded p-5 shadow-sm space-y-3">
      <h2 className="text-base font-semibold text-red-900 border-b border-red-100 pb-2">
        Sign Out
      </h2>
      <p className="text-xs text-gray-600">
        Sign out of your ShelfSafe account on this device.
      </p>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={isSavingAny || signingOut}
        className="px-4 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-300 rounded hover:bg-red-100 disabled:opacity-50 transition-colors"
      >
        {signingOut ? 'Signing out...' : 'Sign Out'}
      </button>

      <ConfirmModal
        isOpen={showConfirm}
        title="Sign out?"
        message="Are you sure you want to sign out?"
        confirmText="Sign out"
        cancelText="Cancel"
        isSaving={signingOut}
        onConfirm={handleExecuteSignOut}
        onCancel={() => !signingOut && setShowConfirm(false)}
      />
    </section>
  );
}

// -------------------------------------------------------------
// MAIN PROFILE PAGE
// -------------------------------------------------------------
export default function ProfilePage() {
  const router = useRouter();
  const {
    store_name,
    contact_number,
    near_expiry_days,
    loading: settingsLoading,
    error: settingsError,
    refresh: refreshSettings,
    reload: reloadSettings,
    clearStoreSettings,
  } = useStoreSettings();

  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [loadingUser, setLoadingUser] = useState(true);
  const [savingCount, setSavingCount] = useState(0);

  const isSavingAny = savingCount > 0;

  const handleSaveStart = () => setSavingCount((c) => c + 1);
  const handleSaveEnd = () => setSavingCount((c) => Math.max(0, c - 1));

  // Warn before leaving the page while saving
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSavingAny) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSavingAny]);

  // Load user data asynchronously
  useEffect(() => {
    let ignore = false;
    async function fetchUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!ignore && user) {
        setUserName(user.user_metadata?.name || '');
        setUserEmail(user.email || '');
        setLoadingUser(false);
      }
    }
    void fetchUser();
    return () => {
      ignore = true;
    };
  }, []);

  const handleNameSaved = (newName: string) => {
    setUserName(newName);
    router.refresh();
  };

  if (loadingUser) {
    return (
      <div className="py-16 text-center">
        <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-sm text-gray-500">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-sm text-gray-600 mt-1">
          Manage your account identity, store details, and notification preferences.
        </p>
      </div>

      {/* SECTION 1 & 2: Account Identity & Edit Name */}
      <EditNameSection
        key={userName}
        initialName={userName}
        userEmail={userEmail}
        isSavingAny={isSavingAny}
        onSaveStart={handleSaveStart}
        onSaveEnd={handleSaveEnd}
        onNameSaved={handleNameSaved}
      />

      {/* SECTION 3: Store Details */}
      <StoreDetailsSection
        key={`${store_name}-${contact_number}-${settingsLoading}`}
        storeName={store_name}
        contactNumber={contact_number}
        settingsLoading={settingsLoading}
        settingsError={settingsError}
        isSavingAny={isSavingAny}
        onSaveStart={handleSaveStart}
        onSaveEnd={handleSaveEnd}
        onRefreshSettings={refreshSettings}
        onReloadSettings={reloadSettings}
      />

      {/* SECTION 4: Notification Preferences */}
      <NotificationPreferencesSection
        key={`${near_expiry_days}-${settingsLoading}`}
        nearExpiryDays={near_expiry_days}
        settingsLoading={settingsLoading}
        settingsError={settingsError}
        isSavingAny={isSavingAny}
        onSaveStart={handleSaveStart}
        onSaveEnd={handleSaveEnd}
        onRefreshSettings={refreshSettings}
        onReloadSettings={reloadSettings}
      />

      {/* SECTION 5: Change Password */}
      <ChangePasswordSection
        userEmail={userEmail}
        isSavingAny={isSavingAny}
        onSaveStart={handleSaveStart}
        onSaveEnd={handleSaveEnd}
      />

      {/* SECTION 6: Sign Out */}
      <SignOutSection
        isSavingAny={isSavingAny}
        onClearStoreSettings={clearStoreSettings}
      />
    </div>
  );
}
