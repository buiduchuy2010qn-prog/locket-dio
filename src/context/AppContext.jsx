// src/context/AppContext.jsx
import React, { createContext, useContext } from "react";
import {
  useCamera,
  useLoading,
  useNavigation,
} from "../stores";

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // Sử dụng custom hooks
  const navigation = useNavigation();
  const camera = useCamera();
  const useloading = useLoading();

  return (
    <AppContext.Provider
      value={{
        navigation,
        camera,
        useloading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
