(() => {
  const NBSP = "\u00A0";
  const words = [
    "и",
    "а",
    "но",
    "да",
    "в",
    "во",
    "на",
    "к",
    "ко",
    "с",
    "со",
    "у",
    "о",
    "об",
    "обо",
    "от",
    "до",
    "по",
    "за",
    "из",
    "изо",
    "над",
    "под",
    "при",
    "без",
    "для",
    "про"
  ];

  // Используем разделитель по пробельным символам, т.к. \b не работает с кириллицей в JS.
  const pattern = new RegExp(`(^|[\\s${NBSP}])(${words.join("|")})(\\s+)`, "giu");
  const skipTags = new Set(["script", "style", "textarea", "code", "pre", "button", "input", "select"]);

  const hasNoNbsp = (node) => {
    let current = node;
    while (current) {
      if (current.nodeType === Node.ELEMENT_NODE && current.hasAttribute("data-no-nbsp")) {
        return true;
      }
      current = current.parentNode;
    }
    return false;
  };

  const processTextNode = (node) => {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const value = node.nodeValue;
    if (!value) return;
    if (!pattern.test(value)) {
      pattern.lastIndex = 0;
      return;
    }
    pattern.lastIndex = 0;
    node.nodeValue = value.replace(pattern, (match, before, prep) => {
      return `${before}${prep}${NBSP}`;
    });
  };

  const processTree = (root) => {
    if (!root || hasNoNbsp(root)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentNode;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.nodeName.toLowerCase();
        if (skipTags.has(tag)) return NodeFilter.FILTER_REJECT;
        if (hasNoNbsp(parent)) return NodeFilter.FILTER_REJECT;
        const text = node.nodeValue;
        if (!text) return NodeFilter.FILTER_REJECT;
        pattern.lastIndex = 0;
        return pattern.test(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    const nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }
    nodes.forEach(processTextNode);
  };

  const init = () => {
    processTree(document.body);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "characterData") {
          processTextNode(mutation.target);
          return;
        }
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            processTextNode(node);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            processTree(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
