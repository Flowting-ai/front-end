import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

DEFAULT_TARGETS = {
    "Tokens Usage",
    "Active Consumers",
    "Command Action",
    "Command Center",
    "Persona Table",
    "Bulk Actions",
    "Persona updated",
    "Your Personas",
}


def color_to_hex(color: Dict[str, Any]) -> str:
    """Convert an RGBA color dict into #RRGGBB / #RRGGBBAA."""

    def clamp(value: float) -> int:
        return max(0, min(255, round(value * 255)))

    r = clamp(color.get("r", 0.0))
    g = clamp(color.get("g", 0.0))
    b = clamp(color.get("b", 0.0))
    a = clamp(color.get("a", 1.0))
    if a == 255:
        return f"#{r:02X}{g:02X}{b:02X}"
    return f"#{r:02X}{g:02X}{b:02X}{a:02X}"


def simplify_paint(paint: Dict[str, Any]) -> Dict[str, Any]:
    paint_type = paint.get("type")
    simplified: Dict[str, Any] = {"type": paint_type, "opacity": paint.get("opacity", 1.0)}
    if paint_type == "SOLID" and "color" in paint:
        simplified["color"] = color_to_hex(paint["color"])
    elif paint_type == "IMAGE":
        simplified["imageRef"] = paint.get("imageRef")
        simplified["scaleMode"] = paint.get("scaleMode")
    return simplified


def summarize_node(
    node: Dict[str, Any],
    parents: List[Dict[str, Any]],
    path_parts: List[str],
    include_children: bool = False,
) -> Dict[str, Any]:
    bbox = node.get("absoluteBoundingBox") or {}
    layout_info = {
        "layoutMode": node.get("layoutMode"),
        "primaryAxisSizingMode": node.get("primaryAxisSizingMode"),
        "counterAxisSizingMode": node.get("counterAxisSizingMode"),
        "primaryAxisAlignItems": node.get("primaryAxisAlignItems"),
        "counterAxisAlignItems": node.get("counterAxisAlignItems"),
        "itemSpacing": node.get("itemSpacing"),
        "layoutWrap": node.get("layoutWrap"),
        "layoutGrow": node.get("layoutGrow"),
        "layoutAlign": node.get("layoutAlign"),
    }

    padding = {
        "left": node.get("paddingLeft"),
        "right": node.get("paddingRight"),
        "top": node.get("paddingTop"),
        "bottom": node.get("paddingBottom"),
    }

    strokes = [simplify_paint(stroke) for stroke in (node.get("strokes") or [])]
    fills = [simplify_paint(fill) for fill in (node.get("fills") or [])]

    ancestor_summaries = []
    for depth, ancestor in enumerate(parents):
        anc_bbox = ancestor.get("absoluteBoundingBox") or {}
        ancestor_summaries.append(
            {
                "name": ancestor.get("name") or ancestor.get("id"),
                "type": ancestor.get("type"),
                "depth": depth,
                "bbox": {
                    "x": anc_bbox.get("x"),
                    "y": anc_bbox.get("y"),
                    "width": anc_bbox.get("width"),
                    "height": anc_bbox.get("height"),
                },
                "layoutMode": ancestor.get("layoutMode"),
                "itemSpacing": ancestor.get("itemSpacing"),
            }
        )

    node_name = node.get("name") or node.get("id")
    node_summary: Dict[str, Any] = {
        "name": node_name,
        "path": " > ".join(path_parts + [node_name]),
        "type": node.get("type"),
        "bbox": {
            "x": bbox.get("x"),
            "y": bbox.get("y"),
            "width": bbox.get("width"),
            "height": bbox.get("height"),
        },
        "fills": fills,
        "strokes": strokes,
        "cornerRadius": node.get("cornerRadius"),
        "individualCornerRadius": node.get("rectangleCornerRadii"),
        "padding": padding,
        "layout": layout_info,
        "effects": node.get("effects"),
        "childrenCount": len(node.get("children") or []),
        "ancestors": ancestor_summaries,
    }

    if node.get("type") == "TEXT":
        node_summary["textStyle"] = node.get("style")
        node_summary["characters"] = node.get("characters")

    if include_children:
        child_summaries = []
        for child in node.get("children") or []:
            child_summaries.append(
                summarize_node(child, parents + [node], path_parts + [node_name], True)
            )
        node_summary["children"] = child_summaries

    return node_summary


def main(argv: List[str]) -> None:
    parser = argparse.ArgumentParser(description="Extract helpful metrics from a Figma node JSON dump.")
    parser.add_argument(
        "targets",
        nargs="*",
        help="Node names to capture. Defaults to a curated set for the persona admin layout.",
    )
    parser.add_argument(
        "--match-mode",
        choices=["exact", "contains"],
        default="exact",
        help="Exact matches compare full strings; contains matches when the target is a substring of the text content.",
    )
    parser.add_argument(
        "--include-children",
        action="store_true",
        help="Include recursive summaries of matched nodes' children.",
    )
    parser.add_argument(
        "--file",
        default=str(Path(__file__).resolve().parent.parent / "figma-node-26-1861.json"),
        help="Path to the Figma node JSON file.",
    )
    args = parser.parse_args(argv)

    path = Path(args.file)
    if not path.exists():
        raise SystemExit(f"{path} not found")

    data = json.loads(path.read_text(encoding="utf-8-sig"))
    root = data["nodes"]["26:1861"]["document"]

    targets = set(args.targets) if args.targets else DEFAULT_TARGETS

    results = []
    stack: List[Tuple[Dict[str, Any], List[Dict[str, Any]], List[str]]] = [(root, [], [])]
    while stack:
        node, parents, path_parts = stack.pop()
        name = node.get("name") or node.get("id")
        next_path = path_parts + [name]
        node_text = node.get("characters") if node.get("type") == "TEXT" else None
        normalized_text = node_text.strip() if isinstance(node_text, str) else None
        text_match = False
        if normalized_text:
            if args.match_mode == "contains":
                text_match = any(t in normalized_text for t in targets)
            else:
                text_match = normalized_text in targets

        if (node.get("name") and node.get("name") in targets) or text_match:
            results.append(summarize_node(node, parents, path_parts, args.include_children))
        for child in node.get("children") or []:
            stack.append((child, parents + [node], next_path))

    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main(sys.argv[1:])
