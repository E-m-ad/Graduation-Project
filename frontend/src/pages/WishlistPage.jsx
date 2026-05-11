import React, { useEffect, useState } from "react";
import "../styles/wishlist.css";
import {
  fetchWishlistPage,
  getDefaultAuthenticatedPath,
  redirectToLogin,
  removeWishlistItem,
} from "../lib/airent";
import { useActionDialog, useMessageState, useSession } from "../lib/hooks";
import {
  ActionDialog,
  EmptyState,
  MessageText,
  PaginationBar,
  ProductCard,
  SectionHeading,
} from "../components/Common";
import { SiteLayout } from "../components/Layout";

function SavedWishlistCard({ item, onRemove }) {
  const product = item.product || {};
  const wishlistProduct = {
    ...product,
    id: product.id || item.productId,
  };

  return (
    <ProductCard
      product={wishlistProduct}
      showWishlist
      isSaved
      onToggleWishlist={onRemove}
      actionLayout="icon-top"
    />
  );
}

const CURSOR_CONFIG = {
  wishlist: {
    enabled: false,
    color: "#000000",
    targetSelector: "body",
    activeSelectors: [],
    deactiveSelectors: [],
  },
};

export function WishlistPage({ page }) {
  const { user, loading, logout } = useSession();
  const { dialog, setDialog, closeDialog, confirmDialog } = useActionDialog();
  const [message, showMessage] = useMessageState("");
  const [savedPage, setSavedPage] = useState(1);
  const [savedItems, setSavedItems] = useState([]);
  const [savedPagination, setSavedPagination] = useState(null);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [busyProductId, setBusyProductId] = useState("");

  useEffect(() => {
    document.title = "Wishlist | AI Rent";
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      redirectToLogin();
      return;
    }

    if (!loading && user?.role === "admin") {
      window.location.href = getDefaultAuthenticatedPath(user);
    }
  }, [loading, user]);

  useEffect(() => {
    let active = true;

    async function loadSavedItems() {
      if (loading || !user || user.role === "admin") {
        return;
      }

      setLoadingSaved(true);
      const result = await fetchWishlistPage({ page: savedPage, limit: 6 });

      if (!active) {
        return;
      }

      setLoadingSaved(false);

      if (!result.ok || !result.data?.success) {
        setSavedItems([]);
        setSavedPagination(null);
        showMessage(result.data?.message || "Unable to load your wishlist.", "error");
        return;
      }

      setSavedItems(result.data.data?.wishlists || []);
      setSavedPagination(result.data.data?.pagination || null);
    }

    loadSavedItems();

    return () => {
      active = false;
    };
  }, [loading, savedPage, showMessage, user]);

  async function reloadSavedItems() {
    const result = await fetchWishlistPage({ page: savedPage, limit: 6 });
    if (!result.ok || !result.data?.success) {
      setSavedItems([]);
      setSavedPagination(null);
      return;
    }

    setSavedItems(result.data.data?.wishlists || []);
    setSavedPagination(result.data.data?.pagination || null);
  }

  async function handleRemoveSaved(productId) {
    const shouldRemove = await confirmDialog({
      title: "Remove saved item?",
      message: "This product will be removed from your wishlist.",
      confirmLabel: "Remove item",
      cancelLabel: "Keep item",
      tone: "danger",
    });
    if (!shouldRemove) {
      return;
    }

    setBusyProductId(productId);
    const result = await removeWishlistItem(productId);
    setBusyProductId("");

    showMessage(
      result.data?.message || "Wishlist updated.",
      result.ok ? "success" : "error",
    );

    if (!result.ok) {
      return;
    }

    if (savedItems.length === 1 && (savedPagination?.page || 1) > 1) {
      setSavedPage((previous) => previous - 1);
      return;
    }

    await reloadSavedItems();
  }

  return (
    <SiteLayout
      page={page}
      user={user}
      onLogout={logout}
      activeNav="wishlist"
      cursorConfig={CURSOR_CONFIG[page]}
    >
      <MessageText message={message} id="wishlistMessage" />

      <section className="wishlist-sections">
        <article
          className={`surface-panel${savedItems.length ? "" : " surface-panel--empty-state"}`}
        >
          <SectionHeading title="Saved items" compact />
          <div
            className={`card-grid wishlist-saved-grid${savedItems.length ? "" : " is-empty"}`}
          >
            {savedItems.length ? (
              savedItems.map((item) => (
                <div key={item.id}>
                  <SavedWishlistCard item={item} onRemove={handleRemoveSaved} />
                  {busyProductId === (item.product?.id || item.productId) ? (
                    <p className="compact-text">Updating wishlist...</p>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState
                message={
                  loadingSaved
                    ? "Loading your wishlist..."
                    : "You have not saved any items yet."
                }
              />
            )}
          </div>

          <PaginationBar
            pagination={savedPagination}
            onPrevious={() => setSavedPage((previous) => previous - 1)}
            onNext={() => setSavedPage((previous) => previous + 1)}
          />
        </article>
      </section>
      <ActionDialog
        dialog={dialog}
        setDialog={setDialog}
        onClose={closeDialog}
      />
    </SiteLayout>
  );
}
