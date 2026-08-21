"use strict";

const TARGET_SELECTOR = 'a[data-headline-restored="true"]';
const ORIGINAL_HEADLINE_SELECTOR = '[class="cpft_link_headline r-37j5jr"]';
const INSERTED_MARKER = "data-x-headline-link-details";
const POPUP_MARKER = "data-x-headline-url-popup";

function abbreviateHrefText(text, fullUrl) {
  try {
    const url = new URL(fullUrl);
    const directories = url.pathname.split("/").filter(Boolean);
    if (directories.length >= 2) {
      return `${url.origin}/${directories[0]}/...`;
    }
  } catch {
    // The normal text-length rule still applies when the URL is malformed.
  }

  return text.length > 30 ? `${text.slice(0, 25)}...` : text;
}

function abbreviateTitleText(text) {
  return text.length > 80 ? `${text.slice(0, 50)}...` : text;
}

function createPopupMessage(fullUrl) {
  const fragment = document.createDocumentFragment();
  fragment.append("URL全文：");

  const link = document.createElement("a");
  link.href = fullUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = fullUrl;
  link.style.color = "rgb(29, 155, 240)";
  fragment.append(link);

  const warning = document.createElement("span");
  warning.style.display = "block";
  warning.style.marginTop = "4px";
  warning.textContent = "新しいタブで開きます。※URLの安全は保障されていません。十分ご注意ください。";
  fragment.append(warning);
  return fragment;
}

async function showUrlPopup(fullUrl) {
  try {
    const layers = document.getElementById("layers");
    if (!layers) {
      return;
    }

    const existingPopup = layers.querySelector(`[${POPUP_MARKER}]`);
    existingPopup?.remove();

    const popupHtml = await fetch(chrome.runtime.getURL("infoPopup.html")).then((response) => response.text());
    const popupDocument = new DOMParser().parseFromString(popupHtml, "text/html");
    const popup = popupDocument.body.firstElementChild;
    if (!popup) {
      return;
    }

    popup.setAttribute(POPUP_MARKER, "true");
    const message = popup.querySelector("[data-x-headline-popup-message]");
    if (message) {
      message.replaceChildren(createPopupMessage(fullUrl));
    }

    popup.querySelector('#e81b27f5-a2a1-45f5-bb5e-c00637461d25')?.addEventListener("click", () => {
      popup.remove();
    });
    layers.appendChild(popup);
  } catch (error) {
    console.error("URL詳細ポップアップを読み込めませんでした。", error);
  }
}

async function addInfoIcon(hrefRow, hrefElement) {
  try {
    const svgHtml = await fetch(chrome.runtime.getURL("infoSvg.html")).then((response) => response.text());
    const svgDocument = new DOMParser().parseFromString(svgHtml, "text/html");
    const svg = svgDocument.querySelector("svg");
    if (!svg) {
      return;
    }

    svg.classList.add("x-headline-link-details__info-icon");
    svg.setAttribute("role", "button");
    svg.setAttribute("tabindex", "0");
    svg.setAttribute("aria-label", "URL詳細を表示");
    const showPopup = (event) => {
      event.preventDefault();
      event.stopPropagation();
      showUrlPopup(hrefElement.dataset.fullUrl || "");
    };
    svg.addEventListener("click", showPopup);
    svg.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        showPopup(event);
      }
    });
    hrefRow.appendChild(svg);
  } catch (error) {
    console.error("URL詳細アイコンを読み込めませんでした。", error);
  }
}

function replaceHrefWithPageTitle(hrefElement, shortUrl) {
  if (!shortUrl) {
    return;
  }

  const request = new XMLHttpRequest();
  request.open("GET", shortUrl, true);
  request.addEventListener("load", () => {
    if (request.status < 200 || request.status >= 400) {
      return;
    }

    const html = new DOMParser().parseFromString(request.responseText, "text/html");
    const fullUrl = request.responseURL || shortUrl;
    hrefElement.dataset.fullUrl = fullUrl;
    const title = html.getElementsByTagName("title")[0];
    if (title) {
      hrefElement.textContent = abbreviateHrefText(title.textContent || fullUrl, fullUrl);
    }
  });
  request.send();
}

function addDetails(anchor) {
  // Do not add another detail element if X re-renders or updates the same link.
  if (anchor.querySelector(`:scope > div[${INSERTED_MARKER}]`)) {
    return;
  }

  const details = document.createElement("div");
  details.setAttribute(INSERTED_MARKER, "true");
  details.className = "x-headline-link-details";
  details.style.padding = "14px";

  const domainAndTitle = anchor.getAttribute("aria-label") || "";
  const shortUrl = anchor.getAttribute("href") || "";

  const href = document.createElement("div");
  href.className = "x-headline-link-details__href";
  href.textContent = abbreviateHrefText(domainAndTitle.split(" ")[0], shortUrl);
  href.dataset.fullUrl = shortUrl;

  const hrefRow = document.createElement("div");
  hrefRow.className = "x-headline-link-details__href-row";
  hrefRow.appendChild(href);

  const ariaLabel = document.createElement("div");
  ariaLabel.className = "x-headline-link-details__aria-label";
  ariaLabel.textContent = abbreviateTitleText(domainAndTitle.split(" ").slice(1).join(" "));

  details.append(hrefRow, ariaLabel);
  anchor.appendChild(details);
  replaceHrefWithPageTitle(href, shortUrl);
  addInfoIcon(hrefRow, href);
}

function removeOriginalHeadlines(root) {
  const removeIfOriginal = (element) => {
    // Never remove anything that belongs to a details element created by this extension.
    if (!element.closest(`[${INSERTED_MARKER}]`)) {
      element.remove();
    }
  };

  if (root instanceof Element && root.matches(ORIGINAL_HEADLINE_SELECTOR)) {
    removeIfOriginal(root);
  }

  root.querySelectorAll(ORIGINAL_HEADLINE_SELECTOR).forEach(removeIfOriginal);
}

function scan(root) {
  if (!(root instanceof Element || root instanceof Document || root instanceof DocumentFragment)) {
    return;
  }

  removeOriginalHeadlines(root);

  if (root instanceof Element && root.matches(TARGET_SELECTOR)) {
    addDetails(root);
  }

  root.querySelectorAll(TARGET_SELECTOR).forEach(addDetails);
}

scan(document);

// X loads and replaces timeline content without a full page navigation.
// A series of updates is processed 0.2 seconds after the final change.
const pendingRoots = new Set();
let scanTimerId;

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      pendingRoots.add(node);
    }
  }

  clearTimeout(scanTimerId);
  scanTimerId = setTimeout(() => {
    for (const root of pendingRoots) {
      scan(root);
      console.log("re-scan");
    }
    pendingRoots.clear();
  }, 200);
});
console.log("act")

observer.observe(document.documentElement, { childList: true, subtree: true });
