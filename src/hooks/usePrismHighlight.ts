import { useEffect } from "react";
import Prism from "@/lib/prism";

// Import languages you need
import "prismjs/components/prism-markup";
import "prismjs/components/prism-markup-templating"
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-json";
import "prismjs/components/prism-python";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-css";
import "prismjs/components/prism-java";

export function usePrismHighlight(dependency?: any) {
  useEffect(() => {
    Prism.highlightAll();
  }, [dependency]);
}
