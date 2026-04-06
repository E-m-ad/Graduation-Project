import { useCallback, useEffect, useState } from "react";
import { getStoredUser, loadCurrentUser, logout } from "./airent";

export function useSession({ refreshOnMount = true } = {}) {
  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(refreshOnMount);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      if (!refreshOnMount) {
        setLoading(false);
        return;
      }

      const nextUser = await loadCurrentUser();
      if (!active) {
        return;
      }

      setUser(nextUser);
      setLoading(false);
    }

    hydrate();

    return () => {
      active = false;
    };
  }, [refreshOnMount]);

  async function refreshUser(force = true) {
    const nextUser = await loadCurrentUser(force);
    setUser(nextUser);
    return nextUser;
  }

  async function handleLogout() {
    await logout();
    setUser(null);
    window.location.href = "/";
  }

  return {
    user,
    loading,
    setUser,
    refreshUser,
    logout: handleLogout,
  };
}

export function useMessageState(initialText = "", initialType = "") {
  const [message, setMessage] = useState({
    text: initialText,
    type: initialType,
  });

  const show = useCallback((text, type = "") => {
    setMessage({ text, type });
  }, []);

  return [message, show];
}
