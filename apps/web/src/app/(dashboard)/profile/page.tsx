'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Store,
  Bell,
  KeyRound,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Save,
  Phone,
  Mail,
  Lock,
} from 'lucide-react';
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
        error: updateError,
      } = await supabase.auth.updateUser({
        data: { name: trimmed },
      });

      if (updateError) {
        if (isDatabaseError(updateError)) {
          setNameError(formatErrorMessage(updateError));
        } else {
          setNameError('Not sure if this was saved. Reload the page and check');
        }
        return;
      }

      const updatedName = user?.user_metadata?.name || trimmed;
      onNameSaved(updatedName);
      setNameSuccess('Your name has been updated');
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

  const isUnchanged = nameInput.trim() === initialName.trim();

  return (
    <section className="bg-white border border-[#ece3d2] rounded-2xl p-6 shadow-2xs space-y-4">
      <div className="flex items-center gap-2.5 border-b border-[#ece3d2] pb-3">
        <div className="w-8 h-8 rounded-lg bg-[#fef9f0] border border-[#ece3d2] flex items-center justify-center text-[#207429]">
          <User className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#181413]">
            Account Identity
          </h2>
          <p className="text-xs text-[#7a7469]">Your operator name displayed on reports and receipts.</p>
        </div>
      </div>

      {nameSuccess && (
        <div className="p-3 bg-[#f4ffe1] border border-[#207429]/30 text-[#207429] text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#207429]" />
          <span>{nameSuccess}</span>
        </div>
      )}

      {nameError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{nameError}</span>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label
            htmlFor="profile-email-readonly"
            className="block text-xs font-bold uppercase tracking-wide text-[#524c40] mb-1"
          >
            Email Address (Read-only)
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-[#9ca3af] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="profile-email-readonly"
              type="text"
              readOnly
              value={userEmail || '—'}
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#f8faf8] border border-[#ece3d2] rounded-xl text-[#7a7469] cursor-not-allowed select-all"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="profile-name-input"
            className="block text-xs font-bold uppercase tracking-wide text-[#524c40] mb-1"
          >
            Operator Name
          </label>
          <input
            id="profile-name-input"
            type="text"
            maxLength={100}
            value={nameInput}
            onChange={(e) => {
              setNameInput(e.target.value);
              setNameError(null);
            }}
            disabled={savingName || isSavingAny}
            placeholder="e.g. Maria Santos"
            className="w-full px-3 py-2 text-sm bg-white border border-[#ece3d2] rounded-xl text-[#181413] focus:outline-none focus:ring-2 focus:ring-[#207429]"
          />
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleOpenConfirm}
            disabled={savingName || isSavingAny || isUnchanged || !nameInput.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#207429] text-white text-xs font-bold rounded-xl hover:bg-[#185e21] disabled:opacity-50 transition-colors shadow-2xs"
          >
            <Save className="w-3.5 h-3.5" />
            {savingName ? 'Saving...' : 'Save Name'}
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirm}
        title="Update Profile Name"
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

  const isStoreUnchanged =
    storeNameInput.trim() === (storeName || '').trim() &&
    contactNumberInput.trim() === (contactNumber || '').trim();

  return (
    <section className="bg-white border border-[#ece3d2] rounded-2xl p-6 shadow-2xs space-y-4">
      <div className="flex items-center gap-2.5 border-b border-[#ece3d2] pb-3">
        <div className="w-8 h-8 rounded-lg bg-[#fef9f0] border border-[#ece3d2] flex items-center justify-center text-[#207429]">
          <Store className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#181413]">
            Store Details
          </h2>
          <p className="text-xs text-[#7a7469]">Custom retail shop information.</p>
        </div>
      </div>

      {storeSuccess && (
        <div className="p-3 bg-[#f4ffe1] border border-[#207429]/30 text-[#207429] text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#207429]" />
          <span>{storeSuccess}</span>
        </div>
      )}
      {storeError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{storeError}</span>
        </div>
      )}

      {settingsError ? (
        <div className="p-3 bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl flex items-center justify-between">
          <span>Failed to load store settings: {settingsError}</span>
          <button
            type="button"
            onClick={() => onReloadSettings()}
            className="underline font-bold text-red-950"
          >
            Retry
          </button>
        </div>
      ) : settingsLoading ? (
        <p className="text-xs text-[#7a7469]">Loading store details...</p>
      ) : (
        <div className="space-y-3">
          <div>
            <label
              htmlFor="store-name-input"
              className="block text-xs font-bold uppercase tracking-wide text-[#524c40] mb-1"
            >
              Store Name (Optional)
            </label>
            <input
              id="store-name-input"
              type="text"
              maxLength={100}
              value={storeNameInput}
              onChange={(e) => {
                setStoreNameInput(e.target.value);
                setStoreError(null);
              }}
              disabled={savingStore || isSavingAny}
              placeholder="e.g. Aling Nena's Sari-Sari Store"
              className="w-full px-3 py-2 text-sm bg-white border border-[#ece3d2] rounded-xl text-[#181413] focus:outline-none focus:ring-2 focus:ring-[#207429]"
            />
          </div>

          <div>
            <label
              htmlFor="store-contact-input"
              className="block text-xs font-bold uppercase tracking-wide text-[#524c40] mb-1"
            >
              Contact Number (Optional)
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-[#9ca3af] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="store-contact-input"
                type="text"
                maxLength={30}
                value={contactNumberInput}
                onChange={(e) => {
                  setContactNumberInput(e.target.value);
                  setStoreError(null);
                }}
                disabled={savingStore || isSavingAny}
                placeholder="e.g. +63 912 345 6789"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#ece3d2] rounded-xl text-[#181413] focus:outline-none focus:ring-2 focus:ring-[#207429]"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleOpenConfirm}
              disabled={savingStore || isSavingAny || isStoreUnchanged}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#207429] text-white text-xs font-bold rounded-xl hover:bg-[#185e21] disabled:opacity-50 transition-colors shadow-2xs"
            >
              <Save className="w-3.5 h-3.5" />
              {savingStore ? 'Saving...' : 'Save Store Details'}
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirm}
        title="Update Store Details"
        message="Are you sure you want to save these store details?"
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
    nearExpiryDays !== null ? String(nearExpiryDays) : '7'
  );
  const [expiryError, setExpiryError] = useState<string | null>(null);
  const [expirySuccess, setExpirySuccess] = useState<string | null>(null);
  const [savingExpiry, setSavingExpiry] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (nearExpiryDays !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDaysInput(String(nearExpiryDays));
    }
  }, [nearExpiryDays]);

  const parsedDays = parseInt(daysInput.trim(), 10);
  const isExpiryValid =
    !isNaN(parsedDays) &&
    Number.isInteger(parsedDays) &&
    parsedDays >= 1 &&
    parsedDays <= 60;

  const isExpiryUnchanged =
    nearExpiryDays !== null && parsedDays === nearExpiryDays;

  const canSaveExpiry =
    isExpiryValid && !isExpiryUnchanged && !savingExpiry && !isSavingAny;

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
    <section className="bg-white border border-[#ece3d2] rounded-2xl p-6 shadow-2xs space-y-4">
      <div className="flex items-center gap-2.5 border-b border-[#ece3d2] pb-3">
        <div className="w-8 h-8 rounded-lg bg-[#fef9f0] border border-[#ece3d2] flex items-center justify-center text-[#207429]">
          <Bell className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#181413]">
            Notification Preferences
          </h2>
          <p className="text-xs text-[#7a7469]">Configurable near-expiry alert window.</p>
        </div>
      </div>

      <p className="text-xs text-[#7a7469]">
        Batches are marked near expiry when their expiration date falls within this threshold.
      </p>

      {expirySuccess && (
        <div className="p-3 bg-[#f4ffe1] border border-[#207429]/30 text-[#207429] text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#207429]" />
          <span>{expirySuccess}</span>
        </div>
      )}
      {expiryError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{expiryError}</span>
        </div>
      )}

      {settingsError ? (
        <div className="p-3 bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl flex items-center justify-between">
          <span>Failed to load near-expiry settings: {settingsError}</span>
          <button
            type="button"
            onClick={() => onReloadSettings()}
            className="underline font-bold text-red-950 ml-2"
          >
            Retry
          </button>
        </div>
      ) : settingsLoading ? (
        <p className="text-xs text-[#7a7469]">Loading near-expiry settings...</p>
      ) : (
        <div className="space-y-3">
          <div>
            <label
              htmlFor="near-expiry-days-input"
              className="block text-xs font-bold uppercase tracking-wide text-[#524c40] mb-1"
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
                className="w-32 px-3 py-2 text-sm bg-white border border-[#ece3d2] rounded-xl text-[#181413] focus:outline-none focus:ring-2 focus:ring-[#207429]"
              />
              <span className="text-sm font-semibold text-[#524c40]">days</span>
            </div>
            <p className="text-[11px] text-[#999182] mt-1">
              Current active threshold:{' '}
              <span className="font-bold text-[#181413]">
                {nearExpiryDays !== null ? `${nearExpiryDays} days` : 'Not loaded'}
              </span>
            </p>
          </div>

          {/* Quick choices */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#999182] block mb-1.5">
              Quick Choices:
            </span>
            <div className="flex items-center gap-1.5">
              {QUICK_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setDaysInput(String(choice))}
                  disabled={savingExpiry || isSavingAny}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    daysInput === String(choice)
                      ? 'bg-[#207429] text-white shadow-2xs'
                      : 'bg-[#fef9f0] text-[#524c40] border border-[#ece3d2] hover:bg-white'
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
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#207429] text-white text-xs font-bold rounded-xl hover:bg-[#185e21] disabled:opacity-50 transition-colors shadow-2xs"
            >
              <Save className="w-3.5 h-3.5" />
              {savingExpiry ? 'Saving...' : 'Save Notification Window'}
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

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (signInError) {
        setPasswordError('Current password is incorrect');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setPasswordError(mapAuthPasswordError(updateError));
        return;
      }

      setPasswordSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setPasswordError(mapAuthPasswordError(err));
    } finally {
      setSavingPassword(false);
      onSaveEnd();
    }
  };

  return (
    <section className="bg-white border border-[#ece3d2] rounded-2xl p-6 shadow-2xs space-y-4">
      <div className="flex items-center gap-2.5 border-b border-[#ece3d2] pb-3">
        <div className="w-8 h-8 rounded-lg bg-[#fef9f0] border border-[#ece3d2] flex items-center justify-center text-[#207429]">
          <KeyRound className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#181413]">
            Change Password
          </h2>
          <p className="text-xs text-[#7a7469]">Secure your operator credentials.</p>
        </div>
      </div>

      {passwordSuccess && (
        <div className="p-3 bg-[#f4ffe1] border border-[#207429]/30 text-[#207429] text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#207429]" />
          <span>{passwordSuccess}</span>
        </div>
      )}

      {passwordError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{passwordError}</span>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label
            htmlFor="current-password-input"
            className="block text-xs font-bold uppercase tracking-wide text-[#524c40] mb-1"
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
            className="w-full px-3 py-2 text-sm bg-white border border-[#ece3d2] rounded-xl text-[#181413] focus:outline-none focus:ring-2 focus:ring-[#207429]"
          />
        </div>

        <div>
          <label
            htmlFor="new-password-input"
            className="block text-xs font-bold uppercase tracking-wide text-[#524c40] mb-1"
          >
            New Password (Min 8 Characters)
          </label>
          <input
            id="new-password-input"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={savingPassword || isSavingAny}
            placeholder="At least 8 characters"
            className="w-full px-3 py-2 text-sm bg-white border border-[#ece3d2] rounded-xl text-[#181413] focus:outline-none focus:ring-2 focus:ring-[#207429]"
          />
        </div>

        <div>
          <label
            htmlFor="confirm-new-password-input"
            className="block text-xs font-bold uppercase tracking-wide text-[#524c40] mb-1"
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
            className="w-full px-3 py-2 text-sm bg-white border border-[#ece3d2] rounded-xl text-[#181413] focus:outline-none focus:ring-2 focus:ring-[#207429]"
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
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#207429] text-white text-xs font-bold rounded-xl hover:bg-[#185e21] disabled:opacity-50 transition-colors shadow-2xs"
          >
            <Lock className="w-3.5 h-3.5" />
            {savingPassword ? 'Updating password...' : 'Update Password'}
          </button>
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
    <section className="bg-white border border-red-200 rounded-2xl p-6 shadow-2xs space-y-3">
      <div className="flex items-center gap-2.5 border-b border-red-100 pb-3">
        <div className="w-8 h-8 rounded-lg bg-red-50 text-[#d32f2f] flex items-center justify-center">
          <LogOut className="w-4 h-4" />
        </div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#d32f2f]">
          End Session
        </h2>
      </div>
      <p className="text-xs text-[#7a7469]">
        Sign out of your ShelfSafe retail session on this browser.
      </p>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={isSavingAny || signingOut}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#d32f2f] bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 disabled:opacity-50 transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" />
        {signingOut ? 'Signing out...' : 'Sign Out'}
      </button>

      <ConfirmModal
        isOpen={showConfirm}
        title="Sign out of ShelfSafe?"
        message="Are you sure you want to end your current session?"
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
      <div className="py-16 text-center text-[#7a7469] text-sm flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 border-2 border-[#207429] border-t-transparent rounded-full animate-spin" />
        <p className="font-medium">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="pb-2 border-b border-[#ece3d2]/80">
        <h1 className="text-2xl font-black text-[#181413] tracking-tight">Profile &amp; Settings</h1>
        <p className="text-xs text-[#7a7469] mt-1">
          Manage your operator identity, store settings, and near-expiry notification thresholds.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          {/* SECTION 1: Account Identity */}
          <EditNameSection
            key={userName}
            initialName={userName}
            userEmail={userEmail}
            isSavingAny={isSavingAny}
            onSaveStart={handleSaveStart}
            onSaveEnd={handleSaveEnd}
            onNameSaved={handleNameSaved}
          />

          {/* SECTION 2: Store Details */}
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
        </div>

        <div className="space-y-6">
          {/* SECTION 3: Notification Preferences */}
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

          {/* SECTION 4: Change Password */}
          <ChangePasswordSection
            userEmail={userEmail}
            isSavingAny={isSavingAny}
            onSaveStart={handleSaveStart}
            onSaveEnd={handleSaveEnd}
          />

          {/* SECTION 5: Sign Out */}
          <SignOutSection
            isSavingAny={isSavingAny}
            onClearStoreSettings={clearStoreSettings}
          />
        </div>
      </div>
    </div>
  );
}