// src/context/AppContext.jsx
// Split contexts so camera zoom / pinch state does NOT re-render navigation-only UI.
import React, { createContext, useContext, useMemo } from "react";
import { useCamera, useLoading, useNavigation } from "../stores";

const NavigationContext = createContext(null);
const CameraContext = createContext(null);
const LoadingContext = createContext(null);

export const AppProvider = ({ children }) => {
  const navigation = useNavigation();
  const camera = useCamera();
  const useloading = useLoading();

  return (
    <NavigationContext.Provider value={navigation}>
      <CameraContext.Provider value={camera}>
        <LoadingContext.Provider value={useloading}>
          {children}
        </LoadingContext.Provider>
      </CameraContext.Provider>
    </NavigationContext.Provider>
  );
};

/** Prefer selective hooks to avoid cross-slice re-renders. */
export const useAppNavigation = () => {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error("useAppNavigation outside AppProvider");
  return ctx;
};

export const useAppCamera = () => {
  const ctx = useContext(CameraContext);
  if (!ctx) throw new Error("useAppCamera outside AppProvider");
  return ctx;
};

export const useAppLoading = () => {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error("useAppLoading outside AppProvider");
  return ctx;
};

/**
 * Compatibility: still works, but re-renders when ANY slice changes.
 * Prefer useAppNavigation / useAppCamera / useAppLoading for hot paths.
 */
export const useApp = () => {
  const navigation = useAppNavigation();
  const camera = useAppCamera();
  const useloading = useAppLoading();
  return useMemo(
    () => ({ navigation, camera, useloading }),
    [navigation, camera, useloading],
  );
};
