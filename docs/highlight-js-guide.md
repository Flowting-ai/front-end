# Highlight.js Code Syntax Highlighting

This project uses Highlight.js for code syntax highlighting with comprehensive language support and multiple theme options.

## 🌈 Changing Themes

### Method 1: Quick Change (Recommended)
Edit `src/app/globals.css` and change the Highlight.js import line:

```css
/* Current (GitHub Light) */
@import "highlight.js/styles/github.css";

/* Change to any theme you like */
@import "highlight.js/styles/github-dark.css";
@import "highlight.js/styles/monokai.css";
@import "highlight.js/styles/atom-one-dark.css";
```

### Method 2: Explore All Themes
See the full list of available themes in `src/lib/highlight-themes.ts`

## 🎨 Popular Themes

### Light Themes
- `github.css` - GitHub light theme (default)
- `atom-one-light.css` - Atom One Light
- `xcode.css` - Xcode style
- `vs.css` - Visual Studio
- `stackoverflow-light.css` - Stack Overflow light
- `solarized-light.css` - Solarized light
- `intellij-light.css` - IntelliJ light

### Dark Themes
- `github-dark.css` - GitHub dark theme
- `atom-one-dark.css` - Atom One Dark
- `monokai.css` - Monokai
- `vs2015.css` - VS Code dark theme
- `dracula.css` - Dracula
- `nord.css` - Nord
- `night-owl.css` - Night Owl
- `tomorrow-night-blue.css` - Tomorrow Night
- `tokyo-night-dark.css` - Tokyo Night
- `stackoverflow-dark.css` - Stack Overflow dark
- `solarized-dark.css` - Solarized dark
- `gruvbox-dark.css` - Gruvbox dark
- `zenburn.css` - Zenburn

## 💻 Supported Languages (80+)

The following programming languages and formats are automatically highlighted:

### Web Development
- JavaScript (js, jsx)
- TypeScript (ts, tsx)
- HTML/XML (html, xml, svg, markup, xhtml)
- CSS (css)
- SCSS/Sass (scss, sass)
- Less (less)
- Stylus (stylus)
- JSON (json)
- GraphQL (graphql, gql)

### Backend Languages
- Python (py, python)
- Java (java)
- C (c)
- C++ (cpp, c++, cc, h, hpp)
- C# (cs, csharp)
- Go (go, golang)
- Rust (rs, rust)
- PHP (php)
- Ruby (rb, ruby)
- Elixir (ex, exs, elixir)
- Erlang (erl, erlang)
- Scala (scala)
- Kotlin (kt, kotlin)
- Swift (swift)
- Objective-C (objc, objectivec, objective-c)
- Dart (dart)
- D (d)
- Zig (zig)
- Groovy (groovy)

### Scripting & Shell
- Bash (bash, sh)
- Shell (shell)
- PowerShell (ps, ps1, powershell)
- Perl (pl, perl)
- Lua (lua)

### Functional Languages
- Haskell (hs, haskell)
- Clojure (clj, cljs, clojure)
- Scheme (scm, scheme)
- Lisp (lisp)
- OCaml (ml, ocaml)
- F# (fs, fsharp)

### Data Science & ML
- R (r)
- MATLAB (matlab)
- Julia (jl, julia)

### Database
- SQL (sql)

### Data & Config
- YAML (yaml, yml)
- TOML (toml)
- INI (ini)
- Properties (properties)
- Markdown (md, markdown)
- LaTeX (tex, latex)
- AsciiDoc (adoc, asciidoc)
- Diff/Patch (diff, patch)
- Protobuf (proto, protobuf)

### DevOps & Tools
- Dockerfile (dockerfile, docker)
- Makefile (makefile, make)
- CMake (cmake)
- Nginx (nginx)
- Apache (apache)
- Terraform/HCL (terraform, tf, hcl)

### Assembly & Low-level
- ARM Assembly (armasm, arm)
- x86 Assembly (x86asm, asm, nasm)
- LLVM IR (llvm)

### GPU Programming
- **CUDA (cuda, cu, cuh)** - Full CUDA support for GPU programming!

### Legacy & Other
- VB.NET (vb, vbnet)
- Delphi/Pascal (delphi, pascal)
- Fortran (fortran, f90, f95)
- COBOL (cobol)
- BASIC (basic)
- Ada (ada)
- Prolog (prolog)
- Smalltalk (smalltalk)
- Vim Script (vim)
- Plain Text (text, txt, plaintext)

## 🔧 Usage in Components

The syntax highlighting is automatically applied to all code blocks. Simply use the appropriate language identifier:

\`\`\`typescript
function hello(name: string): string {
  return `Hello, ${name}!`;
}
\`\`\`

\`\`\`python
def hello(name):
    return f"Hello, {name}!"
\`\`\`

## 📝 Notes

- The highlighting is applied client-side using the `useHighlightJs` hook
- All registered languages are loaded on-demand
- Theme changes require a page refresh
- The theme CSS is imported globally in `globals.css`

## 🔗 Resources

- [Highlight.js Official Site](https://highlightjs.org/)
- [All Available Themes Demo](https://highlightjs.org/demo)
- [Language Support Documentation](https://github.com/highlightjs/highlight.js/blob/main/SUPPORTED_LANGUAGES.md)
