import hljs from 'highlight.js/lib/core';

// Import languages - Verified available languages only
// Web Development
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import less from 'highlight.js/lib/languages/less';
import graphql from 'highlight.js/lib/languages/graphql';

// Systems Programming
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import rust from 'highlight.js/lib/languages/rust';
import go from 'highlight.js/lib/languages/go';
import csharp from 'highlight.js/lib/languages/csharp';
import java from 'highlight.js/lib/languages/java';
import kotlin from 'highlight.js/lib/languages/kotlin';
import scala from 'highlight.js/lib/languages/scala';
import swift from 'highlight.js/lib/languages/swift';
import objectivec from 'highlight.js/lib/languages/objectivec';
import d from 'highlight.js/lib/languages/d';

// Scripting Languages
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import php from 'highlight.js/lib/languages/php';
import perl from 'highlight.js/lib/languages/perl';
import lua from 'highlight.js/lib/languages/lua';
import bash from 'highlight.js/lib/languages/bash';
import shell from 'highlight.js/lib/languages/shell';
import powershell from 'highlight.js/lib/languages/powershell';

// Functional Languages
import haskell from 'highlight.js/lib/languages/haskell';
import elixir from 'highlight.js/lib/languages/elixir';
import erlang from 'highlight.js/lib/languages/erlang';
import clojure from 'highlight.js/lib/languages/clojure';
import scheme from 'highlight.js/lib/languages/scheme';
import lisp from 'highlight.js/lib/languages/lisp';
import ocaml from 'highlight.js/lib/languages/ocaml';
import fsharp from 'highlight.js/lib/languages/fsharp';

// JVM Languages
import groovy from 'highlight.js/lib/languages/groovy';

// Mobile Development
import dart from 'highlight.js/lib/languages/dart';

// Data Science & ML
import r from 'highlight.js/lib/languages/r';
import matlab from 'highlight.js/lib/languages/matlab';
import julia from 'highlight.js/lib/languages/julia';

// Database
import sql from 'highlight.js/lib/languages/sql';

// Markup & Documentation
import markdown from 'highlight.js/lib/languages/markdown';
import latex from 'highlight.js/lib/languages/latex';

// Configuration & Data
import yaml from 'highlight.js/lib/languages/yaml';
import ini from 'highlight.js/lib/languages/ini';
import protobuf from 'highlight.js/lib/languages/protobuf';

// DevOps & Infrastructure
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import makefile from 'highlight.js/lib/languages/makefile';
import cmake from 'highlight.js/lib/languages/cmake';
import nginx from 'highlight.js/lib/languages/nginx';
import apache from 'highlight.js/lib/languages/apache';

// Assembly & Low-level
import armasm from 'highlight.js/lib/languages/armasm';
import x86asm from 'highlight.js/lib/languages/x86asm';
import llvm from 'highlight.js/lib/languages/llvm';

// Other Languages
import vbnet from 'highlight.js/lib/languages/vbnet';
import delphi from 'highlight.js/lib/languages/delphi';
import fortran from 'highlight.js/lib/languages/fortran';
import vim from 'highlight.js/lib/languages/vim';
import diff from 'highlight.js/lib/languages/diff';
import plaintext from 'highlight.js/lib/languages/plaintext';

// CUDA & GPU Programming (uses C++ syntax)
import cudacpp from 'highlight.js/lib/languages/cpp';


// Register all languages with their aliases
// Web Development
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('jsx', javascript);
hljs.registerLanguage('tsx', typescript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('markup', xml);
hljs.registerLanguage('svg', xml);
hljs.registerLanguage('xhtml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('scss', scss);
hljs.registerLanguage('sass', scss);
hljs.registerLanguage('less', less);
hljs.registerLanguage('graphql', graphql);
hljs.registerLanguage('gql', graphql);

// Systems Programming
hljs.registerLanguage('c', c);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c++', cpp);
hljs.registerLanguage('cc', cpp);
hljs.registerLanguage('h', cpp);
hljs.registerLanguage('hpp', cpp);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('rs', rust);
hljs.registerLanguage('go', go);
hljs.registerLanguage('golang', go);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('cs', csharp);
hljs.registerLanguage('java', java);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('kt', kotlin);
hljs.registerLanguage('scala', scala);
hljs.registerLanguage('swift', swift);
hljs.registerLanguage('objectivec', objectivec);
hljs.registerLanguage('objc', objectivec);
hljs.registerLanguage('objective-c', objectivec);
hljs.registerLanguage('d', d);

// Scripting Languages
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('rb', ruby);
hljs.registerLanguage('php', php);
hljs.registerLanguage('perl', perl);
hljs.registerLanguage('pl', perl);
hljs.registerLanguage('lua', lua);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', shell);
hljs.registerLanguage('powershell', powershell);
hljs.registerLanguage('ps', powershell);
hljs.registerLanguage('ps1', powershell);

// Functional Languages
hljs.registerLanguage('haskell', haskell);
hljs.registerLanguage('hs', haskell);
hljs.registerLanguage('elixir', elixir);
hljs.registerLanguage('ex', elixir);
hljs.registerLanguage('exs', elixir);
hljs.registerLanguage('erlang', erlang);
hljs.registerLanguage('erl', erlang);
hljs.registerLanguage('clojure', clojure);
hljs.registerLanguage('clj', clojure);
hljs.registerLanguage('cljs', clojure);
hljs.registerLanguage('scheme', scheme);
hljs.registerLanguage('scm', scheme);
hljs.registerLanguage('lisp', lisp);
hljs.registerLanguage('ocaml', ocaml);
hljs.registerLanguage('ml', ocaml);
hljs.registerLanguage('fsharp', fsharp);
hljs.registerLanguage('fs', fsharp);

// JVM Languages
hljs.registerLanguage('groovy', groovy);

// Mobile Development
hljs.registerLanguage('dart', dart);

// Data Science & ML
hljs.registerLanguage('r', r);
hljs.registerLanguage('matlab', matlab);
hljs.registerLanguage('julia', julia);
hljs.registerLanguage('jl', julia);

// Database
hljs.registerLanguage('sql', sql);

// Markup & Documentation
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('latex', latex);
hljs.registerLanguage('tex', latex);

// Configuration & Data
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('ini', ini);
hljs.registerLanguage('toml', ini); // TOML uses INI syntax
hljs.registerLanguage('protobuf', protobuf);
hljs.registerLanguage('proto', protobuf);

// DevOps & Infrastructure
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('docker', dockerfile);
hljs.registerLanguage('makefile', makefile);
hljs.registerLanguage('make', makefile);
hljs.registerLanguage('cmake', cmake);
hljs.registerLanguage('nginx', nginx);
hljs.registerLanguage('apache', apache);

// Assembly & Low-level
hljs.registerLanguage('armasm', armasm);
hljs.registerLanguage('arm', armasm);
hljs.registerLanguage('x86asm', x86asm);
hljs.registerLanguage('asm', x86asm);
hljs.registerLanguage('nasm', x86asm);
hljs.registerLanguage('llvm', llvm);

// Other Languages
hljs.registerLanguage('vbnet', vbnet);
hljs.registerLanguage('vb', vbnet);
hljs.registerLanguage('delphi', delphi);
hljs.registerLanguage('pascal', delphi);
hljs.registerLanguage('fortran', fortran);
hljs.registerLanguage('f90', fortran);
hljs.registerLanguage('f95', fortran);
hljs.registerLanguage('vim', vim);
hljs.registerLanguage('diff', diff);
hljs.registerLanguage('patch', diff);
hljs.registerLanguage('plaintext', plaintext);
hljs.registerLanguage('text', plaintext);
hljs.registerLanguage('txt', plaintext);

// CUDA & GPU Programming
hljs.registerLanguage('cuda', cudacpp);
hljs.registerLanguage('cu', cudacpp);
hljs.registerLanguage('cuh', cudacpp);

export default hljs;
