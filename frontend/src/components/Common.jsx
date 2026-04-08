import React, { useEffect, useState } from "react";
import {
  formatDateTime,
  formatMoney,
  getPriceLabel,
  getPrimaryImage,
  truncateText,
} from "../lib/airent";

function getCategoryCardMonogram(name) {
  const letters = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("");

  return (letters.slice(0, 2) || "AR").toUpperCase();
}

export function MessageText({ message, id }) {
  const text = typeof message === "string" ? message : message?.text || "";
  const type = typeof message === "string" ? "" : message?.type || "";
  const className = `message${type ? ` message--${type}` : ""}`;

  return (
    <p className={className} id={id}>
      {text}
    </p>
  );
}

export function EmptyState({ message }) {
  return <div className="empty-state">{message}</div>;
}

export function SectionHeading({
  eyebrow,
  title,
  note,
  linkHref,
  linkLabel,
  compact = false,
  children,
}) {
  return (
    <div className={`section-heading${compact ? " section-heading--compact" : ""}`}>
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {note ? <p className="section-note">{note}</p> : null}
      </div>
      {children ||
        (linkHref && linkLabel ? (
          <a className="section-link" href={linkHref}>
            {linkLabel}
          </a>
        ) : null)}
    </div>
  );
}

export function PaginationBar({ pagination, label, onPrevious, onNext }) {
  if (!pagination || pagination.totalPages <= 1) {
    return null;
  }

  return (
    <div className="pagination-bar">
      <button
        type="button"
        className="btn btn--secondary"
        onClick={onPrevious}
        disabled={!pagination.hasPreviousPage}
      >
        Previous
      </button>
      <span>{label || `Page ${pagination.page} of ${pagination.totalPages}`}</span>
      <button
        type="button"
        className="btn btn--secondary"
        onClick={onNext}
        disabled={!pagination.hasNextPage}
      >
        Next
      </button>
    </div>
  );
}

export function ProductCard({
  product,
  showWishlist = false,
  isSaved = false,
  onToggleWishlist,
}) {
  const detailsUrl = `/html/product-details.html?id=${encodeURIComponent(product.id)}`;
  const imageUrl = getPrimaryImage(product);

  return (
    <article className="product-card">
      <a className="product-card__media" href={detailsUrl}>
        <img
          className="product-card__image"
          src={imageUrl}
          alt={product.title || "Product image"}
        />
      </a>
      <div className="product-card__body">
        <div className="product-card__meta">
          <span className="tag">{product.category?.name || "General"}</span>
          <span className="product-card__city">
            {product.city || product.owner?.city || "Unknown city"}
          </span>
        </div>
        <div className="product-card__top">
          <div>
            <h3 className="product-card__title">
              <a href={detailsUrl}>{product.title || "Untitled listing"}</a>
            </h3>
            <p className="compact-text">
              {truncateText(product.description || "No description available.", 110)}
            </p>
          </div>
        </div>
        <div className="product-card__bottom">
          <div>
            <p className="product-card__price">{getPriceLabel(product)}</p>
            <p className="compact-text">
              {product.status || "available"}
              {product.avgRating
                ? ` | Rating ${Number(product.avgRating).toFixed(1)}`
                : ""}
            </p>
          </div>
          <div className="hero__actions">
            <a className="btn btn--ghost btn--small" href={detailsUrl}>
              Details
            </a>
            {showWishlist ? (
              <button
                type="button"
                className="btn btn--secondary btn--small"
                onClick={() => onToggleWishlist?.(product.id, isSaved)}
              >
                {isSaved ? "Saved" : "Save"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export function CategoryCard({ category }) {
  const listingCount = Number(category?._count?.products || 0);
  const availabilityLabel = listingCount
    ? `${listingCount} live listing${listingCount === 1 ? "" : "s"}`
    : "Fresh collection";

  return (
    <article className="category-card">
      <div className="category-card__panel">
        <div className="category-card__meta">
          <span className="category-card__glyph" aria-hidden="true">
            {getCategoryCardMonogram(category.name)}
          </span>
          <span className="category-card__count">{availabilityLabel}</span>
        </div>

        <div className="category-card__content">
          <span className="category-card__eyebrow">Rental category</span>
          <h3>{category.name}</h3>
          <p>
            {truncateText(
              category.description ||
                "Browse curated rentals, compare live availability, and move into requests faster.",
              104,
            )}
          </p>
        </div>

        <div className="category-card__footer">
          <a
            className="category-card__cta"
            href={`/html/products.html?categoryId=${encodeURIComponent(category.id)}`}
          >
            Explore category
          </a>
        </div>
      </div>
    </article>
  );
}

export function CityCard({ city }) {
  return (
    <a
      className="city-card"
      href={`/html/products.html?city=${encodeURIComponent(city.name)}`}
    >
      <img
        className="city-card__image"
        src={city.imageUrl}
        alt={`${city.name} listings`}
      />
      <span className="city-card__scrim" />
      <div className="city-card__body">
        <span className="city-card__count">
          {city.count} listing{city.count === 1 ? "" : "s"}
        </span>
        <h3>{city.name}</h3>
        <span className="city-card__link">Browse city</span>
      </div>
    </a>
  );
}

export function DetailFactGrid({ facts }) {
  return (
    <div className="detail-facts">
      {facts.map(([label, value]) => (
        <div className="detail-fact" key={label}>
          <span className="detail-fact__label">{label}</span>
          <span className="detail-fact__value">{value}</span>
        </div>
      ))}
    </div>
  );
}

function formatCountdown(endDate, now) {
  const endTime = new Date(endDate).getTime();
  if (!Number.isFinite(endTime)) {
    return { text: "", isElapsed: false };
  }

  const diffMs = endTime - now;
  if (diffMs <= 0) {
    return {
      text: `Scheduled finish reached: ${formatDateTime(endDate)}`,
      isElapsed: true,
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];

  if (days) parts.push(`${days}d`);
  if (days || hours) parts.push(`${hours}h`);
  if (days || hours || minutes) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return {
    text: `Time left: ${parts.join(" ")}`,
    isElapsed: false,
  };
}

function RentalCountdown({ endDate }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  if (!endDate) {
    return null;
  }

  const countdown = formatCountdown(endDate, now);
  if (!countdown.text) {
    return null;
  }

  return (
    <p
      className={`list-item__meta ${
        countdown.isElapsed ? "list-item__meta--warning" : "list-item__meta--accent"
      }`}
    >
      {countdown.text}
    </p>
  );
}

function formatRentalStatusLabel(status) {
  return String(status || "rental")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function RentalListItem({ rental, listType, onAction, showOwner = false }) {
  const actions = [];
  const detailsUrl = `/html/product-details.html?id=${encodeURIComponent(rental.productId)}`;
  const imageUrl = getPrimaryImage(rental.product);
  const productCity =
    rental.product?.city || rental.owner?.city || rental.renter?.city || "Unknown city";
  const counterpartRole = showOwner ? "Owner" : "Renter";
  const counterpartName = showOwner
    ? rental.owner?.name || "Unknown"
    : rental.renter?.name || "Unknown";
  const rentalStatusLabel = formatRentalStatusLabel(rental.status);
  const rentalPeriodLabel = formatRentalStatusLabel(rental.rentalPeriodType || "Flexible");
  const listingStatusLabel = rental.product?.status
    ? formatRentalStatusLabel(rental.product.status)
    : "Unavailable";
  let timelineLabel = "Update";
  let timelineValue = "Awaiting the next step";

  if (rental.status === "completed" && rental.actualReturnDate) {
    timelineLabel = "Finished at";
    timelineValue = formatDateTime(rental.actualReturnDate);
  } else if (["approved", "active"].includes(rental.status) && rental.endDate) {
    timelineLabel = "Scheduled finish";
    timelineValue = formatDateTime(rental.endDate);
  } else if (rental.status === "pending") {
    timelineValue = "Awaiting approval";
  } else if (rental.status === "cancelled") {
    timelineValue = "Cancelled";
  } else if (rental.status === "rejected") {
    timelineValue = "Rejected";
  } else if (rental.status === "overdue") {
    timelineValue = "Past the scheduled return";
  }

  if (listType === "bookings" && ["pending", "approved"].includes(rental.status)) {
    actions.push(["cancel", "Cancel", "btn--secondary"]);
  }
  if (listType === "requests" && rental.status === "pending") {
    actions.push(["approve", "Approve", "btn--primary"]);
    actions.push(["reject", "Reject", "btn--secondary"]);
  }
  if (listType === "requests" && rental.status === "approved") {
    actions.push(["start", "Start", "btn--secondary"]);
  }
  if (listType === "requests" && rental.status === "active") {
    actions.push(["complete", "Complete", "btn--secondary"]);
  }

  return (
    <article className="product-card rental-card">
      <a className="product-card__media rental-card__media" href={detailsUrl}>
        <img
          className="product-card__image"
          src={imageUrl}
          alt={rental.product?.title || "Rental product image"}
        />
      </a>

      <div className="product-card__body rental-card__body">
        <div className="product-card__meta">
          <span className="tag">{rental.product?.category?.name || "General"}</span>
          <span className="product-card__city">{productCity}</span>
        </div>

        <div className="rental-card__headline">
          <div className="rental-card__title-block">
            <div className="rental-card__fact-tags">
              <span className="tag tag--light">{rentalStatusLabel}</span>
              <span className="tag">{rentalPeriodLabel}</span>
            </div>
            <h3 className="product-card__title">
              <a href={detailsUrl}>{rental.product?.title || "Rental"}</a>
            </h3>
            <p className="product-card__summary rental-card__summary">
              {truncateText(
                rental.product?.description || "No description available.",
                120,
              )}
            </p>
          </div>
          <div className="rental-card__price-block">
            <span className="rental-card__price-label">Total price</span>
            <p className="product-card__price">{formatMoney(rental.totalPrice)}</p>
            <p className="compact-text">{getPriceLabel(rental.product)}</p>
          </div>
        </div>

        <div className="rental-card__detail-grid">
          <div className="rental-card__fact">
            <span className="rental-card__fact-label">{counterpartRole}</span>
            <span className="rental-card__fact-value">{counterpartName}</span>
          </div>
          <div className="rental-card__fact">
            <span className="rental-card__fact-label">Starts</span>
            <span className="rental-card__fact-value">{formatDateTime(rental.startDate)}</span>
          </div>
          <div className="rental-card__fact">
            <span className="rental-card__fact-label">{timelineLabel}</span>
            <span className="rental-card__fact-value">{timelineValue}</span>
          </div>
          <div className="rental-card__fact">
            <span className="rental-card__fact-label">Listing</span>
            <span className="rental-card__fact-value">{listingStatusLabel}</span>
          </div>
        </div>

        {rental.status === "active" && rental.endDate ? (
          <div className="rental-card__notice">
            <RentalCountdown endDate={rental.endDate} />
          </div>
        ) : null}

        <div className="product-card__bottom rental-card__bottom">
          <p className="compact-text rental-card__listing-note">
            {showOwner ? "Renter-side booking view" : "Owner-side rental control"}
          </p>
          <div className="listing-actions rental-card__actions">
            <a className="btn btn--ghost btn--small" href={detailsUrl}>
              View Product
            </a>
            {actions.map(([action, label, variant]) => (
              <button
                key={action}
                type="button"
                className={`btn ${variant} btn--small`}
                onClick={() => onAction?.(action, rental.id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
