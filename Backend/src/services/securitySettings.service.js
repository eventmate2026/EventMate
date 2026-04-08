import SecuritySettings from "../models/SecuritySettings.model.js";
import User from "../models/User.model.js";
import { revokeEverySession } from "./session.service.js";

const DEFAULT_SETTINGS = {
  maxFailedLoginAttempts: 5,
  lockoutDurationMinutes: 30,
  accessTokenLifetimeMinutes: 15,
  refreshTokenLifetimeDays: 7,
  notifyOnLockout: true,
  maintenanceMode: false,
  lastRotatedAt: null,
  tokenInvalidBefore: null,
};

export const getSecuritySettings = async () => {
  let settings = await SecuritySettings.findOne();
  if (!settings) {
    settings = await SecuritySettings.create(DEFAULT_SETTINGS);
  }
  return settings;
};

export const updateSecuritySettings = async (updates = {}, userId = null) => {
  const settings = await getSecuritySettings();
  Object.assign(settings, updates);
  if (userId) settings.updatedBy = userId;
  await settings.save();
  return settings;
};

export const invalidateAllSessions = async (userId = null, { rotate = false } = {}) => {
  const settings = await getSecuritySettings();
  const now = new Date();
  settings.tokenInvalidBefore = now;
  if (rotate) settings.lastRotatedAt = now;
  if (userId) settings.updatedBy = userId;
  await settings.save();

  await Promise.all([
    User.updateMany({}, { $set: { refreshToken: null } }),
    revokeEverySession({ reason: rotate ? "ROTATED_SIGNING_KEY" : "FORCED_LOGOUT" }),
  ]);
  return settings;
};

export const toSecuritySettingsDto = (settings) => ({
  maxFailedLoginAttempts: settings.maxFailedLoginAttempts,
  lockoutDurationMinutes: settings.lockoutDurationMinutes,
  accessTokenLifetimeMinutes: settings.accessTokenLifetimeMinutes,
  refreshTokenLifetimeDays: settings.refreshTokenLifetimeDays,
  notifyOnLockout: settings.notifyOnLockout,
  maintenanceMode: settings.maintenanceMode,
  lastRotatedAt: settings.lastRotatedAt,
  tokenInvalidBefore: settings.tokenInvalidBefore,
  updatedAt: settings.updatedAt,
});
