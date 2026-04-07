import os
import re
import json


def parse_memory_graph(file_path=None):
    """
    Parse Hermes Agent memory files into a knowledge graph.
    
    Handles two formats:
    1. Curated MEMORY.md (~/.hermes/MEMORY.md) - full Markdown with ## headers
    2. Agent memories/MEMORY.md (~/.hermes/memories/MEMORY.md) - §-delimited entries
    
    The curated MEMORY.md contains rich structured content (h2 sections, h3 subsections,
    bullet lists) which becomes the main graph.
    
    The memories/MEMORY.md contains §-delimited entries which are shown as flat items.
    """
    if file_path is None:
        # Default: curated MEMORY.md
        file_path = os.path.expanduser('~/.hermes/MEMORY.md')
    
    nodes = []
    links = []
    
    # Root node
    nodes.append({
        "id": "Memory",
        "label": "Hukommelse",
        "type": "root",
        "group": 0
    })
    
    node_set = {"Memory"}
    
    def add_node(id_val, label, n_type, group, content=None):
        if id_val not in node_set:
            node_data = {
                "id": id_val,
                "label": label,
                "type": n_type,
                "group": group
            }
            if content:
                node_data["content"] = content
            nodes.append(node_data)
            node_set.add(id_val)
    
    if not os.path.exists(file_path):
        # Fallback: try memories/MEMORY.md
        alt_path = os.path.expanduser('~/.hermes/memories/MEMORY.md')
        if os.path.exists(alt_path):
            file_path = alt_path
    
    if not os.path.exists(file_path):
        return {"nodes": nodes, "links": links}
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Detect format: §-delimited vs Markdown headers
    has_section_markers = '\n§\n' in content or content.startswith('§')
    has_markdown_headers = bool(re.search(r'^#{1,3}\s+', content, re.MULTILINE))
    
    if has_section_markers and not has_markdown_headers:
        # Agent format: §-delimited entries
        # Split by § delimiter (accounting for possible leading/trailing §)
        raw_entries = content.split('\n§\n')
        entries = [e.strip() for e in raw_entries if e.strip() and not e.strip().startswith('§')]
        
        # Create a "Curated Memory" category for §-delimited entries
        add_node("h2_curated", "Curated Memory", "category", 1, content="Agent curated entries")
        links.append({"source": "Memory", "target": "h2_curated", "value": 5})
        
        for i, entry in enumerate(entries):
            # Clean up the entry for display
            clean = entry.strip()
            if not clean:
                continue
            
            # First line as title, rest as content
            lines = clean.split('\n')
            title = lines[0].strip()
            body = '\n'.join(lines[1:]).strip() if len(lines) > 1 else ""
            
            # Truncate title for label
            label = (title[:35] + '...') if len(title) > 38 else title
            
            # Create subcategory per entry (use index to ensure uniqueness)
            sub_id = f"h3_entry_{i}"
            add_node(sub_id, label[:20], "subcategory", 2, content=clean[:200])
            links.append({"source": "h2_curated", "target": sub_id, "value": 3})
            
            # If entry has bullet points, add them as items
            if body:
                bullet_lines = [l.strip() for l in body.split('\n') if l.strip().startswith('- ')]
                for j, bullet in enumerate(bullet_lines[:5]):  # Max 5 items per entry
                    item_text = bullet[2:].strip()
                    if item_text:
                        item_label = (item_text[:25] + '...') if len(item_text) > 28 else item_text
                        item_id = f"leaf_{sub_id}_{j}"
                        add_node(item_id, item_label, "item", 3, content=item_text)
                        links.append({"source": sub_id, "target": item_id, "value": 1})
    
    else:
        # Curated Markdown format: ## headers, ### subheaders, - bullet items
        lines = content.split('\n')
        
        current_h2 = None
        current_h3 = None
        
        for line in lines:
            line_stripped = line.strip()
            if not line_stripped:
                continue
            
            # H2 Headers (e.g. ## Jonas Abde)
            h2_match = re.match(r'^##\s+(.+)$', line_stripped)
            if h2_match:
                full_header = h2_match.group(1).strip()
                label = full_header.split('—')[0].strip()
                node_id = f"h2_{label.replace(' ', '_')[:30]}"
                add_node(node_id, label, "category", 1, content=full_header)
                links.append({"source": "Memory", "target": node_id, "value": 5})
                current_h2 = node_id
                current_h3 = None
                continue
            
            # H3 Headers (e.g. ### Hvem han er)
            h3_match = re.match(r'^###\s+(.+)$', line_stripped)
            if h3_match and current_h2:
                label = h3_match.group(1).strip()
                node_id = f"h3_{current_h2}_{label.replace(' ', '_')[:25]}"
                add_node(node_id, label, "subcategory", 2, content=label)
                links.append({"source": current_h2, "target": node_id, "value": 3})
                current_h3 = node_id
                continue
            
            # List items (e.g. - 24 år or * item)
            list_match = re.match(r'^[-*]\s+(.+)$', line_stripped)
            if list_match and current_h3:
                raw_content = list_match.group(1).strip()
                # Clean markdown bold (**text** -> text)
                raw_content = re.sub(r'\*\*(.+?)\*\*', r'\1', raw_content)
                # Clean markdown links
                raw_content = re.sub(r'\[(.+?)\]\(.+?\)', r'\1', raw_content)
                display_label = (raw_content[:30] + '...') if len(raw_content) > 33 else raw_content
                node_id = f"leaf_{current_h3}_{raw_content[:15].replace(' ', '_')}"
                add_node(node_id, display_label, "item", 3, content=raw_content)
                links.append({"source": current_h3, "target": node_id, "value": 1})
                continue
    
    # Filter out links that point to missing nodes
    valid_links = [l for l in links if l["source"] in node_set and l["target"] in node_set]

    return {"nodes": nodes, "links": valid_links}


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        path = sys.argv[1]
    else:
        # Try curated MEMORY.md first, then memories/MEMORY.md
        curated = os.path.expanduser('~/.hermes/MEMORY.md')
        agent_mem = os.path.expanduser('~/.hermes/memories/MEMORY.md')
        path = curated if os.path.exists(curated) else agent_mem
    
    graph = parse_memory_graph(path)
    print(json.dumps(graph, indent=2))
