from __future__ import annotations

import os
import re
from collections import Counter
from datetime import datetime, timezone
from math import log, sqrt
from typing import Iterable

from flask import Flask, jsonify, request

TOKEN_PATTERN = re.compile(r"[a-z0-9]+")

app = Flask(__name__)


def normalize_text(value: object) -> str:
    return str(value or "").strip().lower()


def normalize_key(value: object) -> str:
    normalized = normalize_text(value)
    return re.sub(r"[^a-z0-9]+", "_", normalized).strip("_")


def tokenize_text(value: object) -> list[str]:
    return TOKEN_PATTERN.findall(normalize_text(value))


def safe_float(value: object, default: float = 0.0) -> float:
    try:
        numeric_value = float(value)
    except (TypeError, ValueError):
        return default

    if numeric_value != numeric_value:
        return default

    return numeric_value


def safe_int(value: object, default: int = 0) -> int:
    return int(round(safe_float(value, default)))


def get_primary_price(product: dict) -> float | None:
    prices = [
        safe_float(product.get("pricePerHour"), float("nan")),
        safe_float(product.get("pricePerDay"), float("nan")),
        safe_float(product.get("pricePerWeek"), float("nan")),
        safe_float(product.get("pricePerMonth"), float("nan")),
    ]
    valid_prices = [price for price in prices if price == price]
    if not valid_prices:
        return None

    return min(valid_prices)


def build_popularity_score(product: dict) -> float:
    avg_rating = safe_float(product.get("avgRating"))
    total_rentals = safe_int(product.get("totalRentals"))
    total_reviews = safe_int(product.get("totalReviews"))
    view_count = safe_int(product.get("viewCount"))

    return (
        avg_rating * 4.0
        + total_rentals * 1.5
        + total_reviews * 0.8
        + min(view_count, 1000) * 0.02
        + (3.0 if bool(product.get("isFeatured")) else 0.0)
    )


def age_in_days(value: object) -> float | None:
    if not value:
        return None

    try:
        iso_value = str(value).replace("Z", "+00:00")
        created_at = datetime.fromisoformat(iso_value)
    except ValueError:
        return None

    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    delta = datetime.now(timezone.utc) - created_at.astimezone(timezone.utc)
    return max(delta.total_seconds() / 86400.0, 0.0)


def score_to_repetitions(score: float, scale: float = 1.0, maximum: int = 12) -> int:
    return max(1, min(int(round(score * scale)), maximum))


def weighted_token_series(entries: Iterable[dict], prefix: str, scale: float) -> list[str]:
    tokens: list[str] = []

    for entry in entries:
        key = normalize_key(entry.get("key"))
        if not key:
            continue

        repetitions = score_to_repetitions(safe_float(entry.get("score")), scale=scale)
        tokens.extend([f"{prefix}_{key}"] * repetitions)

    return tokens


def build_product_tokens(product: dict) -> list[str]:
    tokens: list[str] = []

    title_tokens = tokenize_text(product.get("title"))
    description_tokens = tokenize_text(product.get("description"))
    category_id = normalize_key(product.get("categoryId"))
    category_name_tokens = tokenize_text(product.get("categoryName"))
    city_key = normalize_key(product.get("city"))
    city_tokens = tokenize_text(product.get("city"))
    condition_key = normalize_key(product.get("condition"))
    tags = [normalize_key(tag) for tag in product.get("tags") or [] if normalize_key(tag)]

    tokens.extend(title_tokens * 3)
    tokens.extend(description_tokens)

    if category_id:
        tokens.extend([f"category_{category_id}"] * 5)

    for token in category_name_tokens:
        tokens.extend([f"category_name_{token}"] * 2)
        tokens.append(token)

    if city_key:
        tokens.extend([f"city_{city_key}"] * 3)
        tokens.extend(city_tokens)

    if condition_key:
        tokens.extend([f"condition_{condition_key}"] * 2)

    for tag in tags:
        tokens.extend([f"tag_{tag}"] * 4)
        tokens.extend(tokenize_text(tag))

    if not tokens:
        return ["listing"]

    return tokens


def build_profile_tokens(profile: dict) -> list[str]:
    tokens: list[str] = []

    tokens.extend(weighted_token_series(profile.get("categories") or [], "category", 0.4))
    tokens.extend(weighted_token_series(profile.get("cities") or [], "city", 0.8))
    tokens.extend(weighted_token_series(profile.get("tags") or [], "tag", 0.6))

    for entry in profile.get("searchTerms") or []:
        term = normalize_text(entry.get("key"))
        repetitions = score_to_repetitions(safe_float(entry.get("score")), scale=1.2, maximum=10)
        for token in tokenize_text(term):
            tokens.extend([token] * repetitions)

    if not tokens:
        return ["discovery"]

    return tokens


def term_frequency(tokens: list[str]) -> Counter:
    return Counter(tokens)


def compute_idf(documents: list[list[str]]) -> dict[str, float]:
    document_count = len(documents)
    document_frequency: Counter = Counter()

    for document in documents:
        document_frequency.update(set(document))

    return {
        term: log((1.0 + document_count) / (1.0 + frequency)) + 1.0
        for term, frequency in document_frequency.items()
    }


def build_vector(tokens: list[str], idf: dict[str, float]) -> dict[str, float]:
    counts = term_frequency(tokens)
    return {
        term: (1.0 + log(count)) * idf.get(term, 1.0)
        for term, count in counts.items()
    }


def vector_norm(vector: dict[str, float]) -> float:
    return sqrt(sum(value * value for value in vector.values())) or 1.0


def cosine_similarity(left: dict[str, float], right: dict[str, float]) -> float:
    if not left or not right:
        return 0.0

    if len(left) > len(right):
        left, right = right, left

    numerator = sum(value * right.get(term, 0.0) for term, value in left.items())
    denominator = vector_norm(left) * vector_norm(right)
    if denominator <= 0:
        return 0.0

    return numerator / denominator


def shared_tag_count(left_tags: Iterable[object], right_tags: Iterable[object]) -> int:
    left = {normalize_key(tag) for tag in left_tags if normalize_key(tag)}
    right = {normalize_key(tag) for tag in right_tags if normalize_key(tag)}
    return len(left.intersection(right))


def has_search_match(product: dict, search_terms: Iterable[dict]) -> bool:
    searchable_text = " ".join(
        [
            normalize_text(product.get("title")),
            normalize_text(product.get("description")),
            " ".join(normalize_text(tag) for tag in product.get("tags") or []),
        ]
    )

    for entry in search_terms:
        for token in tokenize_text(entry.get("key")):
            if token and token in searchable_text:
                return True

    return False


def score_personalized_candidate(
    product: dict,
    profile: dict,
    profile_vector: dict[str, float],
    product_vector: dict[str, float],
) -> dict:
    category_scores = {
        normalize_key(entry.get("key")): safe_float(entry.get("score"))
        for entry in profile.get("categories") or []
    }
    city_scores = {
        normalize_key(entry.get("key")): safe_float(entry.get("score"))
        for entry in profile.get("cities") or []
    }
    tag_scores = {
        normalize_key(entry.get("key")): safe_float(entry.get("score"))
        for entry in profile.get("tags") or []
    }
    search_terms = profile.get("searchTerms") or []

    content_similarity = cosine_similarity(profile_vector, product_vector)
    popularity_score = build_popularity_score(product)
    category_boost = min(category_scores.get(normalize_key(product.get("categoryId")), 0.0), 30.0)
    city_boost = min(city_scores.get(normalize_key(product.get("city")), 0.0), 20.0)
    tag_boost = sum(
        min(tag_scores.get(normalize_key(tag), 0.0), 10.0)
        for tag in product.get("tags") or []
    )
    search_boost = 8.0 if has_search_match(product, search_terms) else 0.0
    freshness_days = age_in_days(product.get("createdAt"))
    freshness_boost = 0.0
    if freshness_days is not None:
        freshness_boost = max(0.0, 6.0 - min(freshness_days, 30.0) * 0.2)

    score = (
        content_similarity * 100.0
        + category_boost
        + city_boost
        + min(tag_boost, 25.0)
        + search_boost
        + popularity_score * 0.35
        + freshness_boost
    )

    reasons: list[str] = []
    if content_similarity >= 0.12:
        reasons.append("language patterns align with your activity")
    if category_boost > 0:
        reasons.append("matches categories you interact with")
    if city_boost > 0:
        reasons.append("matches your preferred locations")
    if tag_boost > 0:
        reasons.append("matches tags you engage with")
    if search_boost > 0:
        reasons.append("relates to your recent searches")
    if bool(product.get("isFeatured")):
        reasons.append("featured listing")
    if not reasons and popularity_score > 0:
        reasons.append("strong marketplace engagement")

    return {
        "productId": product.get("id"),
        "score": round(score, 2),
        "reasons": reasons[:4],
    }


def score_similar_candidate(
    base_product: dict,
    candidate: dict,
    base_vector: dict[str, float],
    candidate_vector: dict[str, float],
) -> dict:
    content_similarity = cosine_similarity(base_vector, candidate_vector)
    category_match = normalize_key(candidate.get("categoryId")) == normalize_key(
        base_product.get("categoryId")
    )
    city_match = normalize_key(candidate.get("city")) == normalize_key(base_product.get("city"))
    condition_match = normalize_key(candidate.get("condition")) == normalize_key(
        base_product.get("condition")
    )
    shared_tags = shared_tag_count(base_product.get("tags") or [], candidate.get("tags") or [])

    base_price = get_primary_price(base_product)
    candidate_price = get_primary_price(candidate)
    price_score = 0.0
    if base_price is not None and candidate_price is not None:
        difference_ratio = abs(base_price - candidate_price) / max(base_price, candidate_price, 1.0)
        price_score = max(0.0, 12.0 - difference_ratio * 12.0)

    score = (
        content_similarity * 95.0
        + (32.0 if category_match else 0.0)
        + min(shared_tags * 8.0, 24.0)
        + (10.0 if city_match else 0.0)
        + (5.0 if condition_match else 0.0)
        + price_score
        + build_popularity_score(candidate) * 0.25
    )

    reasons: list[str] = []
    if content_similarity >= 0.18:
        reasons.append("similar description and tags")
    if category_match:
        reasons.append("same category")
    if shared_tags > 0:
        reasons.append("shared tags")
    if city_match:
        reasons.append("same city")
    if condition_match:
        reasons.append("similar condition")
    if price_score > 0:
        reasons.append("similar price range")
    if not reasons:
        reasons.append("similar overall profile")

    return {
        "productId": candidate.get("id"),
        "score": round(score, 2),
        "reasons": reasons[:4],
    }


def rank_personalized_candidates(payload: dict) -> list[dict]:
    profile = payload.get("profile") or {}
    candidates = payload.get("candidates") or []

    if not candidates:
        return []

    profile_tokens = build_profile_tokens(profile)
    product_tokens = [build_product_tokens(product) for product in candidates]
    idf = compute_idf([profile_tokens, *product_tokens])
    profile_vector = build_vector(profile_tokens, idf)
    product_vectors = [build_vector(tokens, idf) for tokens in product_tokens]

    ranked = [
        score_personalized_candidate(product, profile, profile_vector, product_vector)
        for product, product_vector in zip(candidates, product_vectors)
    ]

    ranked.sort(key=lambda item: item["score"], reverse=True)
    return ranked


def rank_similar_candidates(payload: dict) -> list[dict]:
    base_product = payload.get("baseProduct") or {}
    candidates = payload.get("candidates") or []

    if not base_product or not candidates:
        return []

    base_tokens = build_product_tokens(base_product)
    candidate_tokens = [build_product_tokens(product) for product in candidates]
    idf = compute_idf([base_tokens, *candidate_tokens])
    base_vector = build_vector(base_tokens, idf)
    candidate_vectors = [build_vector(tokens, idf) for tokens in candidate_tokens]

    ranked = [
        score_similar_candidate(base_product, candidate, base_vector, candidate_vector)
        for candidate, candidate_vector in zip(candidates, candidate_vectors)
    ]

    ranked.sort(key=lambda item: item["score"], reverse=True)
    return ranked


@app.get("/healthz")
def healthz():
    return jsonify(
        {
            "status": "ok",
            "service": "ai-recommender",
            "framework": "flask",
        }
    )


@app.post("/score/recommendations")
def score_recommendations():
    payload = request.get_json(silent=True) or {}
    items = rank_personalized_candidates(payload)
    return jsonify({"items": items})


@app.post("/score/similar")
def score_similar():
    payload = request.get_json(silent=True) or {}
    items = rank_similar_candidates(payload)
    return jsonify({"items": items})


if __name__ == "__main__":
    port = int(os.environ.get("PORT") or os.environ.get("RECOMMENDER_PORT", "5050"))
    host = os.environ.get("HOSTNAME") or os.environ.get("RECOMMENDER_HOST") or "::"

    try:
        app.run(host=host, port=port)
    except OSError:
        if host == "::" and not os.environ.get("HOSTNAME") and not os.environ.get("RECOMMENDER_HOST"):
            print(
                "IPv6 bind failed for the AI recommender, falling back to 0.0.0.0",
                flush=True,
            )
            app.run(host="0.0.0.0", port=port)
        else:
            raise
