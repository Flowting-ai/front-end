const EXTENSION_HYDRATION_ATTRIBUTES = ["bis_skin_checked"] as const;

function removeExtensionHydrationAttributes() {
  const selector = EXTENSION_HYDRATION_ATTRIBUTES
    .map((attribute) => `[${attribute}]`)
    .join(",");

  for (const attribute of EXTENSION_HYDRATION_ATTRIBUTES) {
    document.documentElement.removeAttribute(attribute);
  }

  document.querySelectorAll(selector).forEach((element) => {
    for (const attribute of EXTENSION_HYDRATION_ATTRIBUTES) {
      element.removeAttribute(attribute);
    }
  });
}

if (process.env.NODE_ENV === "development") {
  try {
    removeExtensionHydrationAttributes();
  } catch {
    // Instrumentation should never block hydration.
  }
}

export {};
