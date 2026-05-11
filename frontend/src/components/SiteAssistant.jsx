import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchApi, getResultMessage } from "../lib/airent";

function createMessage(role, content, options = {}) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    suggestions: Array.isArray(options.suggestions) ? options.suggestions : [],
    ephemeral: Boolean(options.ephemeral),
  };
}

function getConversationStorageKey({ user, page, assistantContext }) {
  const viewerKey = user?.id || "guest";
  const pageKey = page || "unknown";
  const contextKey = assistantContext?.productId || "default";

  return `ai_rent_site_assistant:${viewerKey}:${pageKey}:${contextKey}`;
}

function getPageLabel(page) {
  switch (page) {
    case "home":
      return "the home page";
    case "products":
      return "the listings page";
    case "product-details":
      return "this listing page";
    case "profile":
      return "the profile area";
    case "wishlist":
      return "your wishlist";
    case "my-listings":
      return "your listings workspace";
    case "bookings":
      return "your bookings page";
    case "rentals":
      return "your rentals page";
    case "login":
      return "the login page";
    case "register":
      return "the registration page";
    default:
      return "this page";
  }
}

function buildWelcomeMessage({ page, assistantContext, user }) {
  if (page === "product-details" && assistantContext?.productTitle) {
    return `Ask me about ${assistantContext.productTitle}. I can explain the pricing, availability, reviews, and what to ask the owner before renting.`;
  }

  if (page === "products") {
    return "I can help you refine filters, understand your search results, and explain how renting works once you find a listing you like.";
  }

  if (!user) {
    return `I can help you navigate AI Rent from ${getPageLabel(
      page,
    )}. Ask about browsing, account setup, or how the rental flow works.`;
  }

  return `I can help you move faster from ${getPageLabel(
    page,
  )}. Ask about listings, wishlist actions, bookings, rentals, notifications, or listing your own item.`;
}

function buildStarterSuggestions({ page, assistantContext, user }) {
  if (page === "product-details" && assistantContext?.productId) {
    return [
      "Summarize this listing",
      "Explain the pricing",
      "What should I ask the owner?",
    ];
  }

  if (page === "products") {
    return [
      "How do I improve these results?",
      "How do filters work here?",
      "How do recommendations work?",
    ];
  }

  if (!user) {
    return [
      "How do I create an account?",
      "Can I rent without logging in?",
      "How do I contact an owner?",
    ];
  }

  return [
    "How do I list my own item?",
    "Where are my bookings?",
    "How do notifications work?",
  ];
}

function normalizeStoredMessages(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim(),
    )
    .map((item) => ({
      id:
        typeof item.id === "string" && item.id.trim()
          ? item.id
          : `${item.role}-${Math.random().toString(36).slice(2, 8)}`,
      role: item.role,
      content: item.content.trim(),
      suggestions: Array.isArray(item.suggestions)
        ? item.suggestions.filter(
            (prompt) => typeof prompt === "string" && prompt.trim(),
          )
        : [],
      ephemeral: false,
    }));
}

export function SiteAssistant({ page, user, assistantContext }) {
  const storageKey = useMemo(
    () =>
      getConversationStorageKey({
        user,
        page,
        assistantContext,
      }),
    [assistantContext, page, user],
  );
  const starterSuggestions = useMemo(
    () => buildStarterSuggestions({ page, assistantContext, user }),
    [assistantContext, page, user],
  );
  const welcomeMessage = useMemo(
    () =>
      createMessage(
        "assistant",
        buildWelcomeMessage({ page, assistantContext, user }),
        {
          suggestions: starterSuggestions,
          ephemeral: true,
        },
      ),
    [assistantContext, page, starterSuggestions, user],
  );
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const rawValue = window.sessionStorage.getItem(storageKey);
      if (!rawValue) {
        setMessages([]);
        return;
      }

      setMessages(normalizeStoredMessages(JSON.parse(rawValue)));
    } catch {
      setMessages([]);
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify(messages.filter((item) => !item.ephemeral)),
      );
    } catch {
      // Ignore session storage failures and keep the in-memory conversation.
    }
  }, [messages, storageKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      block: "end",
      behavior: "smooth",
    });
  }, [isOpen, messages, submitting]);

  useEffect(() => {
    if (!isOpen || submitting) {
      return;
    }

    textareaRef.current?.focus();
  }, [isOpen, submitting]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const visibleMessages = messages.length ? messages : [welcomeMessage];
  const latestMessage = visibleMessages[visibleMessages.length - 1];
  const activeSuggestions =
    latestMessage?.suggestions?.length > 0
      ? latestMessage.suggestions
      : starterSuggestions;

  async function sendMessage(rawMessage) {
    const message = String(rawMessage || "").trim();
    if (!message || submitting) {
      return;
    }

    const nextUserMessage = createMessage("user", message);
    const nextMessages = [...messages, nextUserMessage];

    setIsOpen(true);
    setError("");
    setDraft("");
    setSubmitting(true);
    setMessages(nextMessages);

    const requestContext = Object.fromEntries(
      Object.entries({
        page,
        pathname: typeof window !== "undefined" ? window.location.pathname : "",
        pageTitle: typeof document !== "undefined" ? document.title || "" : "",
        ...(assistantContext || {}),
      }).filter(
        ([, value]) =>
          value !== undefined &&
          value !== null &&
          !(typeof value === "string" && value.trim() === ""),
      ),
    );

    const result = await fetchApi("/api/v1/assistant/chat", {
      method: "POST",
      auth: Boolean(user),
      body: {
        message,
        history: nextMessages.slice(-8).map((item) => ({
          role: item.role,
          content: item.content,
        })),
        context: requestContext,
      },
    });

    setSubmitting(false);

    if (!result.ok || !result.data?.success || !result.data?.data?.answer) {
      setError(
        getResultMessage(result, "Unable to reach the assistant right now."),
      );
      return;
    }

    setMessages((previous) => [
      ...previous,
      createMessage("assistant", result.data.data.answer, {
        suggestions: result.data.data.suggestedPrompts || [],
      }),
    ]);
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage(draft);
  }

  // return (
  //   <div className={`site-assistant${isOpen ? " is-open" : ""}`}>
  //     {isOpen ? (
  //       <section
  //         className="site-assistant__panel"
  //         role="dialog"
  //         aria-modal="false"
  //         aria-labelledby="siteAssistantTitle"
  //       >
  //         <div className="site-assistant__header">
  //           <div>
  //             <p className="site-assistant__eyebrow">AI Rent Assistant</p>
  //             <h3 id="siteAssistantTitle">Need a quick answer?</h3>
  //           </div>
  //           <button
  //             type="button"
  //             className="btn btn--ghost btn--small"
  //             onClick={() => setIsOpen(false)}
  //           >
  //             Close
  //           </button>
  //         </div>

  //         <div className="site-assistant__messages">
  //           {visibleMessages.map((messageItem) => (
  //             <article
  //               key={messageItem.id}
  //               className={`site-assistant__message site-assistant__message--${messageItem.role}`}
  //             >
  //               <span className="site-assistant__message-label">
  //                 {messageItem.role === "assistant" ? "AI Rent" : "You"}
  //               </span>
  //               <p>{messageItem.content}</p>
  //             </article>
  //           ))}

  //           {submitting ? (
  //             <article className="site-assistant__message site-assistant__message--assistant">
  //               <span className="site-assistant__message-label">AI Rent</span>
  //               <p>Thinking through the best next step...</p>
  //             </article>
  //           ) : null}

  //           <div ref={messagesEndRef} />
  //         </div>

  //         {activeSuggestions.length ? (
  //           <div className="site-assistant__suggestions">
  //             {activeSuggestions.map((suggestion) => (
  //               <button
  //                 key={suggestion}
  //                 type="button"
  //                 className="site-assistant__chip"
  //                 onClick={() => sendMessage(suggestion)}
  //                 disabled={submitting}
  //               >
  //                 {suggestion}
  //               </button>
  //             ))}
  //           </div>
  //         ) : null}

  //         <form className="site-assistant__composer" onSubmit={handleSubmit}>
  //           <label className="site-assistant__label" htmlFor="siteAssistantInput">
  //             Ask a question
  //           </label>
  //           <textarea
  //             id="siteAssistantInput"
  //             ref={textareaRef}
  //             className="textarea site-assistant__textarea"
  //             rows="2"
  //             maxLength="2000"
  //             placeholder="Ask about listings, pricing, renting, wishlist, bookings, or next steps..."
  //             value={draft}
  //             onChange={(event) => setDraft(event.target.value)}
  //           />
  //           <div className="site-assistant__composer-footer">
  //             <p className="compact-text">
  //               {draft.trim().length}/2000 characters
  //             </p>
  //             <button
  //               type="submit"
  //               className="btn btn--primary btn--small"
  //               disabled={submitting || !draft.trim()}
  //             >
  //               {submitting ? "Sending..." : "Send"}
  //             </button>
  //           </div>
  //           {error ? (
  //             <p className="message message--error site-assistant__error">
  //               {error}
  //             </p>
  //           ) : null}
  //         </form>
  //       </section>
  //     ) : null}

  //     <button
  //       type="button"
  //       className="site-assistant__launcher"
  //       onClick={() => setIsOpen((previous) => !previous)}
  //       aria-expanded={isOpen}
  //       aria-controls="siteAssistantTitle"
  //     >
  //       <span className="site-assistant__launcher-icon" aria-hidden="true">
  //         <svg viewBox="0 0 24 24">
  //           <path
  //             d="M6 7.5A3.5 3.5 0 0 1 9.5 4h5A3.5 3.5 0 0 1 18 7.5v5A3.5 3.5 0 0 1 14.5 16H11l-4 4v-4.2A3.5 3.5 0 0 1 6 13V7.5Z"
  //             fill="none"
  //             stroke="currentColor"
  //             strokeWidth="1.8"
  //             strokeLinecap="round"
  //             strokeLinejoin="round"
  //           />
  //           <path
  //             d="M9.5 9.5h5M9.5 12.5h3.5"
  //             fill="none"
  //             stroke="currentColor"
  //             strokeWidth="1.8"
  //             strokeLinecap="round"
  //           />
  //         </svg>
  //       </span>
  //       <span>{isOpen ? "Hide AI Help" : "Ask AI Rent"}</span>
  //     </button>
  //   </div>
  // );
}
